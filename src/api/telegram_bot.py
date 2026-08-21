import os
import json
import asyncio
import logging
import sys
from aiogram import Bot, Dispatcher, types
from aiogram.filters import Command, CommandObject
from aiogram.enums import ParseMode
from aiogram.types import BufferedInputFile, FSInputFile, BotCommand, InlineKeyboardMarkup, InlineKeyboardButton, CallbackQuery
from aiogram.client.default import DefaultBotProperties
from langchain_core.messages import HumanMessage
from fastapi import Request, BackgroundTasks
import time
import src.api.db as db
from src.agent.graph import SUPERVISOR_NAME
from src.api.logging_utils import setup_query_logger, generate_query_id
from src.agent.upstox_tools import pending_tool_futures
from src.agent.upstox_client_manager import is_sandbox_mode, thread_sandbox_modes

logger = logging.getLogger(__name__)
# Ensure errors and logs are output to console for visibility
_ch = logging.StreamHandler(sys.stdout)
_ch.setFormatter(logging.Formatter('%(asctime)s - %(name)s - %(levelname)s - %(message)s'))
logger.addHandler(_ch)
logger.setLevel(logging.INFO)

# Global set to keep strong references to running tasks so they don't get garbage collected mid-execution
_running_tasks = set()


_graph = None

def set_graph(graph):
    global _graph
    _graph = graph

import re
def format_for_telegram(text: str) -> str:
    """Converts standard LLM markdown to Telegram HTML."""
    if not text:
        return text
    
    # Escape existing HTML chars so we don't break the parser if the LLM uses < or >
    text = text.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")
    
    # Convert GFM Bold (**text**) to <b>text</b>
    text = re.sub(r'\*\*(.*?)\*\*', r'<b>\1</b>', text, flags=re.DOTALL)
    
    # Convert GFM Headers (### Header) to <b>Header</b>
    text = re.sub(r'^(#{1,6})\s*(.*)', r'<b>\2</b>', text, flags=re.MULTILINE)
    
    # Convert GFM Italic (*text* or _text_) to <i>text</i>
    text = re.sub(r'(?<!\*)\*(?!\s)(.*?)(?<!\s)\*(?!\*)', r'<i>\1</i>', text)
    text = re.sub(r'(?<!_)_(?!\s)(.*?)(?<!\s)_(?!_)', r'<i>\1</i>', text)
    
    # Convert GFM Strikethrough (~~text~~) to <s>text</s>
    text = re.sub(r'~~(.*?)~~', r'<s>\1</s>', text, flags=re.DOTALL)
    
    # Convert GFM Code block (```lang code ```) to <pre><code class="language-lang">code</code></pre>
    text = re.sub(r'```(\w+)?\n(.*?)```', lambda m: f'<pre><code class="language-{m.group(1)}">{m.group(2)}</code></pre>' if m.group(1) else f'<pre>{m.group(2)}</pre>', text, flags=re.DOTALL)
    
    # Convert GFM Inline code (`code`) to <code>code</code>
    text = re.sub(r'`(.*?)`', r'<code>\1</code>', text)
    
    # Convert GFM Links ([text](url)) to <a href="url">text</a>
    text = re.sub(r'\[(.*?)\]\((.*?)\)', r'<a href="\2">\1</a>', text)
    
    return text

bot = None
dp = Dispatcher()

from aiogram import F
@dp.callback_query(F.data.startswith('confirm_') | F.data.startswith('cancel_'))
async def handle_order_confirmation(callback_query: CallbackQuery):
    action, conf_id = callback_query.data.split('_', 1)
    logger.info(f"Received CallbackQuery: action={action}, conf_id={conf_id}. Currently pending confirmation IDs: {list(pending_tool_futures.keys())}")
    
    if conf_id not in pending_tool_futures:
        await callback_query.answer("This order confirmation has expired or is invalid.", show_alert=True)
        await callback_query.message.edit_reply_markup(reply_markup=None)
        return
        
    future = pending_tool_futures[conf_id]
    
    if action == "cancel":
        if not future.done():
            future.set_result("cancel")
        await callback_query.answer("Order cancelled.")
        await callback_query.message.edit_text(callback_query.message.text + "\n\n❌ <b>Order Cancelled by User</b>")
    elif action == "confirm":
        if not future.done():
            future.set_result("confirm")
        await callback_query.answer("Order confirmed! Agent is executing...")
        await callback_query.message.edit_text(callback_query.message.text + "\n\n✅ <b>Order Confirmed</b>")

@dp.message(Command("new"))
async def cmd_new(message: types.Message):
    chat_id = str(message.chat.id)
    thread_id = await db.reset_telegram_thread(chat_id)
    if thread_id:
        await message.answer("Context cleared. Starting a fresh conversation.")
    else:
        await message.answer("❌ Failed to start a new session. Database might not be initialized.")

@dp.message(Command("toggle"))
async def cmd_toggle(message: types.Message, command: CommandObject):
    chat_id = str(message.chat.id)
    thread_id = await db.get_or_create_telegram_thread(chat_id)
    if thread_id:
        if thread_id not in thread_sandbox_modes:
            mode_str = await db.get_setting(f"mode_{thread_id}")
            thread_sandbox_modes[thread_id] = (mode_str == "sandbox")
            
        new_mode = not thread_sandbox_modes[thread_id]
        thread_sandbox_modes[thread_id] = new_mode
        await db.set_setting(f"mode_{thread_id}", "sandbox" if new_mode else "live")
        
        if new_mode:
            msg = "🔄 <b>Mode Switched:</b> You are now in <b>Sandbox Mode</b>. All orders will be simulated and no real money will be used."
        else:
            msg = "⚠️ <b>Mode Switched:</b> You are now in <b>LIVE Mode</b>. All orders will be placed on your actual Upstox account. Proceed with caution!"
            
        await message.answer(msg)
        
        if command.args:
            await process_query(message, command.args)

@dp.message(Command("start", "help"))
async def cmd_start(message: types.Message):
    chat_id = str(message.chat.id)
    await db.get_or_create_telegram_thread(chat_id)
    
    welcome_text = (
        "👋 <b>Welcome to DeepTrade!</b>\n\n"
        "Send me a stock ticker or a financial query to begin.\n"
        "Use /new to clear my memory and start a fresh conversation.\n\n"
        "<b>Available Commands:</b>\n"
        "📊 <code>/analyse &lt;ticker&gt;</code> - Perform a comprehensive financial analysis\n"
        "📰 <code>/news &lt;topic&gt;</code> - Fetch and summarize the latest news\n"
        "🔍 <code>/deepdive &lt;topic&gt;</code> - Conduct an in-depth research report\n"
        "🔄 <code>/toggle</code> - Toggle between Live and Sandbox trading mode\n"
        "🔐 <code>/totp</code> - View or scan your 2FA QR code\n"
        "♻️ <code>/reset_2fa</code> - Generate a fresh new 2FA secret key"
    )
    
    root_dir = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
    logo_path = os.path.join(root_dir, "assets", "logo.png")
    if not os.path.exists(logo_path):
        logo_path = os.path.join(root_dir, "logo.png")

    if os.path.exists(logo_path):
        try:
            photo = FSInputFile(logo_path)
            await message.answer_photo(photo=photo, caption=welcome_text, parse_mode=ParseMode.HTML)
            return
        except Exception as e:
            logger.error(f"Failed to send logo photo with start command: {e}")

    await message.answer(welcome_text, parse_mode=ParseMode.HTML)

@dp.message(Command("analyse"))
async def cmd_analyse(message: types.Message, command: CommandObject):
    if not command.args:
        await message.answer("Please provide a ticker. Example: `/analyse AAPL`")
        return
    query_text = f"Perform a comprehensive financial analysis on: {command.args}"
    await process_query(message, query_text)

@dp.message(Command("news"))
async def cmd_news(message: types.Message, command: CommandObject):
    if not command.args:
        await message.answer("Please provide a ticker or topic. Example: `/news AAPL`")
        return
    query_text = f"Fetch and summarize the latest news for: {command.args}"
    await process_query(message, query_text)

@dp.message(Command("deepdive"))
async def cmd_deepdive(message: types.Message, command: CommandObject):
    if not command.args:
        await message.answer("Please provide a ticker or topic. Example: `/deepdive AAPL`")
        return
    query_text = f"Conduct a comprehensive, deep-dive research report on: {command.args}"
    await process_query(message, query_text)

@dp.message(Command("totp", "2fa", "setup_2fa"))
async def cmd_totp(message: types.Message):
    admin_chat_id = await db.get_setting("ADMIN_CHAT_ID")
    chat_id = str(message.chat.id)
    if admin_chat_id and chat_id != admin_chat_id:
        await message.answer("❌ Unauthorized. Only the primary administrator can access 2FA settings.")
        return
        
    secret = os.environ.get("WEB_OTP_SECRET")
    if not secret:
        import pyotp
        secret = pyotp.random_base32()
        os.environ["WEB_OTP_SECRET"] = secret
        await db.set_setting("WEB_OTP_SECRET", secret)
        
    import pyotp
    import qrcode
    import io
    
    totp = pyotp.TOTP(secret)
    uri = totp.provisioning_uri(name="admin@deeptrade.ai", issuer_name="DeepTrade")
    
    qr = qrcode.QRCode(border=2)
    qr.add_data(uri)
    qr.make(fit=True)
    img = qr.make_image(fill_color="black", back_color="white")
    
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    buf.seek(0)
    
    qr_file = BufferedInputFile(buf.getvalue(), filename="totp_qr.png")
    
    caption = (
        "🔐 <b>DeepTrade 2FA / TOTP Authenticator Setup</b>\n\n"
        "Scan this QR code in <b>Google Authenticator</b>, <b>Apple Passwords</b>, or <b>1Password</b>.\n\n"
        f"🔑 <b>Secret Key:</b> <code>{secret}</code>\n"
        f"⏱️ <b>Current Code:</b> <code>{totp.now()}</code>\n\n"
        "<i>Tip: If you ever lose your authenticator, use /totp to get it back, or /reset_2fa to generate a new key.</i>"
    )
    await message.answer_photo(photo=qr_file, caption=caption, parse_mode=ParseMode.HTML)

@dp.message(Command("reset_2fa", "reset_totp"))
async def cmd_reset_2fa(message: types.Message):
    admin_chat_id = await db.get_setting("ADMIN_CHAT_ID")
    chat_id = str(message.chat.id)
    if admin_chat_id and chat_id != admin_chat_id:
        await message.answer("❌ Unauthorized.")
        return
        
    import pyotp
    import qrcode
    import io
    from pathlib import Path
    
    new_secret = pyotp.random_base32()
    os.environ["WEB_OTP_SECRET"] = new_secret
    await db.set_setting("WEB_OTP_SECRET", new_secret)
    
    # Update .env
    root_dir = Path(__file__).resolve().parent.parent.parent
    env_file = root_dir / ".env"
    if env_file.exists():
        content = env_file.read_text(encoding="utf-8")
        if "WEB_OTP_SECRET=" in content:
            import re
            content = re.sub(r"WEB_OTP_SECRET=.*", f"WEB_OTP_SECRET={new_secret}", content)
        else:
            content += f"\nWEB_OTP_SECRET={new_secret}\n"
        env_file.write_text(content, encoding="utf-8")
        
    totp = pyotp.TOTP(new_secret)
    uri = totp.provisioning_uri(name="admin@deeptrade.ai", issuer_name="DeepTrade")
    
    qr = qrcode.QRCode(border=2)
    qr.add_data(uri)
    qr.make(fit=True)
    img = qr.make_image(fill_color="black", back_color="white")
    
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    buf.seek(0)
    
    qr_file = BufferedInputFile(buf.getvalue(), filename="new_totp_qr.png")
    
    caption = (
        "🔄 <b>2FA Secret Successfully Reset!</b>\n\n"
        "All previous sessions have been invalidated. Scan your new QR code below:\n\n"
        f"🔑 <b>New Secret Key:</b> <code>{new_secret}</code>\n"
        f"⏱️ <b>New Current Code:</b> <code>{totp.now()}</code>"
    )
    await message.answer_photo(photo=qr_file, caption=caption, parse_mode=ParseMode.HTML)

@dp.message()
async def handle_message(message: types.Message):
    if not message.text:
        await message.answer("Please send a stock ticker or financial query in text.")
        return
    await process_query(message, message.text)

async def process_query(message: types.Message, query_text: str):
    if not query_text or not isinstance(query_text, str) or not query_text.strip():
        await message.answer("Please send a valid query.")
        return

    if not _graph:
        await message.answer("❌ Agent graph is not initialized.")
        return

    chat_id = str(message.chat.id)
    thread_id = await db.get_or_create_telegram_thread(chat_id)
    if not thread_id:
        await message.answer("❌ Failed to retrieve active session.")
        return

    status_msg = await message.answer("⚙️ Initializing research...")
    current_status_text = "⚙️ Initializing research..."
    
    query_id = generate_query_id()
    query_logger = setup_query_logger(query_id)
    query_logger.info(f"Starting Telegram processing for query: {query_text} (Thread: {thread_id})")
    
    messages = [HumanMessage(content=query_text)]
    state = {"messages": messages}
    config = {"configurable": {"thread_id": thread_id, "platform": "telegram"}}
    
    emitted_artifacts = set()
    pending_artifacts = {}

    async def update_status(new_text):
        nonlocal current_status_text
        if new_text != current_status_text:
            try:
                formatted_text = format_for_telegram(new_text)
                await status_msg.edit_text(formatted_text)
                current_status_text = new_text
            except Exception as e:
                try:
                    # Fallback without markdown parsing if it was a formatting error
                    await status_msg.edit_text(new_text, parse_mode=None)
                    current_status_text = new_text
                except Exception as e2:
                    logger.warning(f"Failed to edit status fallback: {e2}")

    try:
        # Default to Live mode (False) unless explicitly set to Sandbox (True)
        if thread_id not in thread_sandbox_modes:
            mode_str = await db.get_setting(f"mode_{thread_id}")
            thread_sandbox_modes[thread_id] = (mode_str == "sandbox")
            
        is_sandbox = thread_sandbox_modes[thread_id]
        is_sandbox_mode.set(is_sandbox)
        
        from langchain_core.messages import SystemMessage
        mode_msg = "SYSTEM NOTIFICATION: You are currently operating in SANDBOX (Paper Trading) mode. All orders are simulated." if is_sandbox else "SYSTEM NOTIFICATION: You are currently operating in LIVE (Real Money) mode. All orders will be placed on your actual Upstox account."
        state["messages"].insert(0, SystemMessage(content=mode_msg))
        
        if not is_sandbox:
            session_status = await db.check_and_sync_live_session()
            if not session_status.get("ready"):
                await status_msg.edit_text(session_status.get("message", "⚠️ <b>Authorization Required</b>"))
                return
        
        async for namespace, stream_type, output in _graph.astream(state, config=config, stream_mode=["messages", "updates"], subgraphs=True):
            if stream_type == "messages":
                chunk, metadata = output
                agent_name = metadata.get("langgraph_node", "Agent") if metadata else "Agent"
                if hasattr(chunk, "additional_kwargs") and "reasoning" in chunk.additional_kwargs:
                    reasoning_text = chunk.additional_kwargs['reasoning']
                    msg_id = getattr(chunk, 'id', None)
                    await db.insert_event(thread_id, query_id, 'REASONING', agent_name, reasoning_text, {"id": msg_id})
                    
            elif stream_type == "updates":
                query_logger.info(f"Graph update: {output} (Namespace: {namespace})")
                for node_name, node_state in output.items():
                    if not node_state or not isinstance(node_state, dict):
                        continue
                    if "messages" not in node_state or len(node_state["messages"]) == 0:
                        continue
                    
                    last_msg = node_state["messages"][-1]
                    current_agent_name = getattr(last_msg, "name", None) if getattr(last_msg, "type", "") == "ai" else None
                    if not current_agent_name:
                        current_agent_name = node_name
                    
                    if getattr(last_msg, "tool_calls", None):
                        for tc in last_msg.tool_calls:
                            query_logger.info(f"\n>>> [{current_agent_name}] CALLING TOOL: {tc['name']}\nArgs: {tc.get('args', {})}\n")
                            if tc["name"] == "task":
                                subagent_name = tc["args"].get("subagent_type", tc["args"].get("subagent", "Subagent"))
                                instructions = tc["args"].get("description", tc["args"].get("instructions", ""))
                                await db.insert_event(thread_id, query_id, 'ROUTING', current_agent_name, instructions, {"subagent": subagent_name})
                                await update_status("🤖 Delegating research tasks...")
                            else:
                                args_str = json.dumps(tc.get("args", {}))
                                await db.insert_event(thread_id, query_id, 'TOOL_CALL', current_agent_name, args_str, {"tool": tc["name"]})
                                
                                if tc["name"] == "search_web":
                                    await update_status("🔍 Searching the web...")
                                elif tc["name"] == "search_financial_data":
                                    await update_status("📊 Analyzing financial data...")
                                elif tc["name"] == "write_file":
                                    await update_status("📝 Writing research artifact...")
                                    file_path = tc.get("args", {}).get("file_path", "")
                                    file_content = tc.get("args", {}).get("content", "")
                                    if file_path.startswith("/research/") and file_path.endswith(".md"):
                                        pending_artifacts[tc["id"]] = {"path": file_path, "content": file_content}
                                else:
                                    await update_status(f"🔧 Using tool: {tc['name']}...")
                    
                    if getattr(last_msg, "type", "") == "tool":
                        tool_name = getattr(last_msg, 'name', 'tool')
                        query_logger.info(f"\n<<< [{current_agent_name}] TOOL RESULT [{tool_name}]:\n{last_msg.content}\n")
                        if tool_name == "task":
                            await db.insert_event(thread_id, query_id, 'TASK_RESULT', current_agent_name, last_msg.content, {"tool": tool_name})
                        else:
                            await db.insert_event(thread_id, query_id, 'TOOL_RESULT', current_agent_name, last_msg.content, {"tool": tool_name})
                            
                        # Note: The deepagents write_file tool returns "Updated file <path>" on success, 
                        # NOT "Successfully". (edit_file returns "Successfully replaced..."). 
                        # We must check for "Updated file" to know the artifact is fully written before emitting it!
                        if tool_name == "write_file" and "Updated file" in str(last_msg.content):
                            tc_id = getattr(last_msg, "tool_call_id", None)
                            if tc_id and tc_id in pending_artifacts:
                                file_path = pending_artifacts[tc_id]["path"]
                                file_content = pending_artifacts[tc_id]["content"]
                                if file_path not in emitted_artifacts:
                                    emitted_artifacts.add(file_path)
                                    await db.insert_event(thread_id, query_id, 'ARTIFACT', current_agent_name, file_content, {"path": file_path})
                                    try:
                                        filename = file_path.split("/")[-1]
                                        doc = BufferedInputFile(file_content.encode("utf-8"), filename=filename)
                                        await message.answer_document(
                                            document=doc, 
                                            caption=f"📄 Generated Artifact: {filename}",
                                            parse_mode=None
                                        )
                                    except Exception as e:
                                        logger.warning(f"Failed to send artifact document: {e}")
                    
                    msg_name = getattr(last_msg, "name", None)
                    is_supervisor = (msg_name == SUPERVISOR_NAME or node_name == "model")
                    if getattr(last_msg, "type", "") == "ai" and is_supervisor and not getattr(last_msg, "tool_calls", None) and getattr(last_msg, "content", ""):
                        final_text = last_msg.content
                        query_logger.info(f"\n<<< [Supervisor] FINAL RESPONSE:\n{final_text}\n")
                        await db.insert_event(thread_id, query_id, 'RESPONSE', SUPERVISOR_NAME, final_text)
                        
                        if final_text != current_status_text:
                            if len(final_text) > 4000:
                                final_text = final_text[:4000] + "\n\n...[Truncated]"
                            try:
                                formatted_text = format_for_telegram(final_text)
                                await status_msg.edit_text(formatted_text)
                                current_status_text = final_text
                            except Exception:
                                try:
                                    # Fallback without markdown parsing if it was a formatting error
                                    await status_msg.edit_text(final_text, parse_mode=None)
                                    current_status_text = final_text
                                except Exception as e2:
                                    logger.warning(f"Final edit fallback failed: {e2}")

    except Exception as e:
        logger.error(f"Error processing telegram message: {e}")
        await status_msg.edit_text(f"❌ An error occurred: {str(e)}")


async def setup_webhook(graph, webhook_url: str):
    token = os.environ.get("TELEGRAM_BOT_TOKEN")
    if not token:
        logger.warning("TELEGRAM_BOT_TOKEN is not set. Telegram bot will not start.")
        return False
    
    set_graph(graph)
    global bot
    bot = Bot(token=token, default=DefaultBotProperties(parse_mode=ParseMode.HTML))
    try:
        await bot.set_my_commands([
            BotCommand(command="start", description="Start the bot"),
            BotCommand(command="new", description="Clear memory and start a fresh conversation"),
            BotCommand(command="toggle", description="Toggle between Sandbox (Paper) and LIVE trading mode"),
            BotCommand(command="analyse", description="Perform a comprehensive financial analysis"),
            BotCommand(command="news", description="Fetch and summarize the latest news"),
            BotCommand(command="deepdive", description="Conduct an in-depth research report")
        ])
        allowed_updates = dp.resolve_used_update_types()
        await bot.set_webhook(webhook_url, allowed_updates=allowed_updates, drop_pending_updates=True)
        logger.info(f"Telegram Webhook set to {webhook_url}")
        return True
    except Exception as e:
        logger.error(f"Failed to set webhook: {e}")
        return False

async def delete_webhook():
    if bot:
        await bot.delete_webhook(drop_pending_updates=True)
        await bot.session.close()

async def telegram_webhook_endpoint(request: Request):
    if not bot:
        return {"error": "Bot not initialized"}
    
    update_data = await request.json()
    
    # Log raw webhook payload
    with open("logs/webhook.log", "a", encoding="utf-8") as f:
        f.write(f"\n--- WEBHOOK HIT {time.strftime('%Y-%m-%d %H:%M:%S')} ---\n")
        f.write(json.dumps(update_data, indent=2) + "\n")
        
    try:
        update = types.Update.model_validate(update_data, context={"bot": bot})
    except Exception as e:
        with open("logs/webhook.log", "a", encoding="utf-8") as f:
            f.write(f"Validation Error: {e}\n")
        raise e
        
    # Single-user security lockdown
    chat_id = None
    if update.message and update.message.chat:
        chat_id = str(update.message.chat.id)
    elif update.callback_query and update.callback_query.message and update.callback_query.message.chat:
        chat_id = str(update.callback_query.message.chat.id)
        
    if chat_id:
        admin_chat_id = await db.get_setting("ADMIN_CHAT_ID")
        if not admin_chat_id:
            await db.set_setting("ADMIN_CHAT_ID", chat_id)
            admin_chat_id = chat_id
            logger.info(f"Locked bot to first user: {chat_id}")
            try:
                await bot.send_message(chat_id, "🔐 <b>Security Lock Active</b>\nThis bot is now permanently locked to your Telegram account. It will safely ignore messages from anyone else.")
            except:
                pass
                
        if chat_id != admin_chat_id:
            logger.warning(f"Unauthorized access attempt from {chat_id}")
            return {"status": "ignored"}
            
        secret = os.environ.get("WEB_OTP_SECRET")
        if secret:
            expiry_str = await db.get_setting("TELEGRAM_AUTH_EXPIRY")
            is_expired = not expiry_str or float(expiry_str) < time.time()
            
            if update.message and update.message.text:
                text = update.message.text.strip()
                if text.isdigit() and len(text) == 6:
                    import pyotp
                    totp = pyotp.TOTP(secret)
                    if totp.verify(text, valid_window=1):
                        expiry_date = time.time() + (7 * 24 * 60 * 60)
                        await db.set_setting("TELEGRAM_AUTH_EXPIRY", str(expiry_date))
                        try:
                            await bot.send_message(chat_id, "✅ <b>Authentication Successful!</b> Your session is unlocked for 7 days.")
                        except: pass
                        return {"status": "ok"}
                    elif is_expired:
                        try:
                            await bot.send_message(chat_id, "❌ <b>Invalid Code.</b> Please try again.")
                        except: pass
                        return {"status": "ok"}
            
            if is_expired:
                if update.message:
                    try:
                        await bot.send_message(chat_id, "🔒 <b>Security Check:</b> Your session has expired. Please reply with your 6-digit Google Authenticator code to unlock the bot for 7 days.")
                    except: pass
                elif update.callback_query:
                    try:
                        import aiogram
                        await bot(aiogram.methods.AnswerCallbackQuery(callback_query_id=update.callback_query.id, text="Session expired. Send your Authenticator code in the chat.", show_alert=True))
                    except: pass
                return {"status": "ok"}
    
    async def process_update():
        try:
            await dp.feed_update(bot, update)
        except Exception as e:
            logger.error(f"Error in background update processing: {e}", exc_info=True)
            with open("logs/webhook.log", "a", encoding="utf-8") as f:
                f.write(f"Processing Error: {e}\n")

    # Process the update in the background and return 200 OK immediately
    # This prevents Telegram from retrying long-running research queries
    task = asyncio.create_task(process_update())
    _running_tasks.add(task)
    task.add_done_callback(_running_tasks.discard)
    
    return {"status": "ok"}

async def send_daily_login_prompt():
    """Scheduled task to send the Upstox login prompt every morning."""
    if not bot:
        return
    admin_chat_id = await db.get_setting("ADMIN_CHAT_ID")
    if not admin_chat_id:
        logger.info("Skipping daily login prompt: No ADMIN_CHAT_ID registered yet.")
        return
        
    client_id = os.environ.get("UPSTOX_CLIENT_ID")
    if not client_id:
        return
        
    # Get the active webhook domain (could be Ngrok or a deployed URL)
    webhook_domain = await db.get_setting("WEBHOOK_DOMAIN")
    if not webhook_domain:
        return
        
    redirect_uri = f"{webhook_domain}/upstox/callback"
    auth_url = f"https://api.upstox.com/v2/login/authorization/dialog?response_type=code&client_id={client_id}&redirect_uri={redirect_uri}"
    
    msg = (
        "🌅 <b>Good morning!</b>\n\n"
        "The market opens soon. To enable LIVE trading today, please click the link below to authorize DeepTrade. "
        "It only takes 10 seconds:\n\n"
        f"🔗 <a href='{auth_url}'>Authorize DeepTrade for Today</a>"
    )
    try:
        await bot.send_message(admin_chat_id, msg)
        logger.info(f"Sent daily login prompt to admin {admin_chat_id}")
    except Exception as e:
        logger.error(f"Failed to send daily login prompt: {e}")
