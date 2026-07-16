import os
import asyncio
import json
import uuid
import re
from typing import Optional, List, Dict, Any
from fastapi import FastAPI, Request, BackgroundTasks, HTTPException
from fastapi.responses import StreamingResponse, HTMLResponse
import requests
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from contextlib import asynccontextmanager
from apscheduler.schedulers.asyncio import AsyncIOScheduler

scheduler = AsyncIOScheduler()

from src.agent.graph import create_research_graph, SUPERVISOR_NAME
from src.api.logging_utils import setup_query_logger, generate_query_id
from langchain_core.messages import HumanMessage, SystemMessage

from src.api.db import lifespan_db
import src.api.db as db
from src.agent.upstox_client_manager import is_sandbox_mode, thread_sandbox_modes

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Initialize DB pool and compile graph with checkpointer
    async with lifespan_db(app):
        # Build the graph using the global checkpointer and store initialized in db.py
        app.state.graph = create_research_graph(
            checkpointer=db.checkpointer, 
            store=db.store
        )
        
        import os
        from src.api.telegram_bot import setup_webhook, delete_webhook
        
        public_url = os.environ.get("PUBLIC_URL")
        use_ngrok = os.environ.get("USE_NGROK", "true").lower() == "true"
        
        if public_url:
            print(f"Cloud deployment detected. Using PUBLIC_URL: {public_url}")
        elif use_ngrok:
            print("No PUBLIC_URL found. Starting local Ngrok tunnel...")
            from pyngrok import ngrok
            auth_token = os.environ.get("NGROK_AUTHTOKEN")
            if auth_token:
                ngrok.set_auth_token(auth_token)
                
            ngrok_domain = os.environ.get("NGROK_DOMAIN")
            if ngrok_domain:
                http_tunnel = ngrok.connect(8000, domain=ngrok_domain)
            else:
                http_tunnel = ngrok.connect(8000)
                
            public_url = http_tunnel.public_url
            print(f"Ngrok Tunnel active at: {public_url}")
        else:
            print("⚠️ WARNING: No PUBLIC_URL set and USE_NGROK is false. The server will start, but Telegram webhooks and Upstox callbacks will not function until PUBLIC_URL is configured.")
        
        if public_url:
            webhook_url = f"{public_url}/webhook/telegram"
            await setup_webhook(app.state.graph, webhook_url)
            
            # Start APScheduler
            from src.api.telegram_bot import send_daily_login_prompt
            # Save the current webhook domain to the DB so the scheduler knows what URL to use
            await db.set_setting("WEBHOOK_DOMAIN", public_url)
        
        # Load the latest Live Access Token from DB into environment for synchronous clients
        live_token = await db.get_setting("UPSTOX_LIVE_ACCESS_TOKEN")
        if live_token:
            os.environ["UPSTOX_LIVE_ACCESS_TOKEN"] = live_token
            
        scheduler.add_job(send_daily_login_prompt, 'cron', day_of_week='mon-fri', hour=8, minute=45)
        scheduler.start()
        
        yield
        
        await delete_webhook()
        scheduler.shutdown()
        ngrok.disconnect(public_url)
        ngrok.kill()

app = FastAPI(title="Deep Trade Agent API", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

from src.api.telegram_bot import telegram_webhook_endpoint
app.post("/webhook/telegram")(telegram_webhook_endpoint)

class ChatRequest(BaseModel):
    message: str
    thread_id: Optional[str] = None
    hidden_instruction: Optional[str] = None


def _is_supervisor_response(last_msg, node_name: str) -> bool:
    if getattr(last_msg, "type", "") != "ai":
        return False
    if getattr(last_msg, "tool_calls", None):
        return False
    if not getattr(last_msg, "content", ""):
        return False
    msg_name = getattr(last_msg, "name", None)
    if msg_name is not None:
        return msg_name == SUPERVISOR_NAME
    return node_name == "model"


async def run_graph(graph, state, config, thread_id, query_id, queue, logger):
    emitted_artifacts: set[str] = set()
    pending_artifacts: dict[str, dict] = {}
    try:
        async for namespace, stream_type, output in graph.astream(state, config=config, stream_mode=["messages", "updates"], subgraphs=True):
            if stream_type == "messages":
                chunk, metadata = output
                agent_name = metadata.get("langgraph_node", "Agent") if metadata else "Agent"
                if hasattr(chunk, "additional_kwargs") and "reasoning" in chunk.additional_kwargs:
                    reasoning_text = chunk.additional_kwargs['reasoning']
                    msg_id = getattr(chunk, 'id', None)
                    await db.insert_event(thread_id, query_id, 'REASONING', agent_name, reasoning_text, {"id": msg_id})
                    await queue.put(f"data: {json.dumps({'type': 'log', 'log_type': 'REASONING', 'agent': agent_name, 'content': reasoning_text, 'id': msg_id})}\n\n")

            elif stream_type == "updates":
                logger.info(f"Graph update: {output} (Namespace: {namespace})")
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
                            logger.info(f"\n>>> [{current_agent_name}] CALLING TOOL: {tc['name']}\nArgs: {tc.get('args', {})}\n")
                            if tc["name"] == "task":
                                subagent_name = tc["args"].get("subagent_type", tc["args"].get("subagent", "Subagent"))
                                instructions = tc["args"].get("description", tc["args"].get("instructions", ""))
                                await db.insert_event(thread_id, query_id, 'ROUTING', current_agent_name, instructions, {"subagent": subagent_name})
                                await queue.put(f"data: {json.dumps({'type': 'log', 'log_type': 'ROUTING', 'agent': current_agent_name, 'subagent': subagent_name, 'content': instructions})}\n\n")
                            else:
                                args_str = json.dumps(tc.get("args", {}))
                                await db.insert_event(thread_id, query_id, 'TOOL_CALL', current_agent_name, args_str, {"tool": tc["name"]})
                                await queue.put(f"data: {json.dumps({'type': 'log', 'log_type': 'TOOL_CALL', 'agent': current_agent_name, 'tool': tc['name'], 'content': args_str})}\n\n")
                                
                                # Intercept write_file for artifacts
                                if tc["name"] == "write_file":
                                    file_path = tc["args"].get("file_path", "")
                                    file_content = tc["args"].get("content", "")
                                    if file_path.startswith("/research/") and file_path.endswith(".md"):
                                        pending_artifacts[tc["id"]] = {"path": file_path, "content": file_content}

                    if getattr(last_msg, "type", "") == "tool":
                        tool_name = getattr(last_msg, 'name', 'tool')
                        logger.info(f"\n<<< [{current_agent_name}] TOOL RESULT [{tool_name}]:\n{last_msg.content}\n")
                        if tool_name == "task":
                            await db.insert_event(thread_id, query_id, 'TASK_RESULT', current_agent_name, last_msg.content, {"tool": tool_name})
                            await queue.put(f"data: {json.dumps({'type': 'log', 'log_type': 'TASK_RESULT', 'agent': current_agent_name, 'tool': tool_name, 'content': last_msg.content})}\n\n")
                        else:
                            await db.insert_event(thread_id, query_id, 'TOOL_RESULT', current_agent_name, last_msg.content, {"tool": tool_name})
                            await queue.put(f"data: {json.dumps({'type': 'log', 'log_type': 'TOOL_RESULT', 'agent': current_agent_name, 'tool': tool_name, 'content': last_msg.content})}\n\n")
                            
                            if "CONFIRM_ORDER" in str(last_msg.content):
                                try:
                                    preview_data = json.loads(last_msg.content)
                                    if preview_data.get("action") == "CONFIRM_ORDER":
                                        await queue.put(f"data: {json.dumps({'type': 'log', 'log_type': 'ORDER_CONFIRMATION', 'agent': current_agent_name, 'content': preview_data})}\n\n")
                                except Exception as e:
                                    logger.warning(f"Failed to parse order confirmation for SSE: {e}")
                            
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
                                    await queue.put(f"data: {json.dumps({'type': 'log', 'log_type': 'ARTIFACT', 'agent': current_agent_name, 'path': file_path, 'content': file_content})}\n\n")

                    if _is_supervisor_response(last_msg, node_name):
                        await db.insert_event(thread_id, query_id, 'RESPONSE', SUPERVISOR_NAME, last_msg.content)
                        await queue.put(f"data: {json.dumps({'type': 'log', 'log_type': 'RESPONSE', 'agent': SUPERVISOR_NAME, 'content': last_msg.content})}\n\n")

        await queue.put(f"data: {json.dumps({'type': 'done'})}\n\n")
    except Exception as e:
        logger.error(f"Error during graph execution: {e}")
        await queue.put(f"data: {json.dumps({'type': 'error', 'content': str(e)})}\n\n")


async def generate_sse_events(query_id: str, request: ChatRequest):
    logger = setup_query_logger(query_id)
    logger.info(f"Starting SSE stream for query: {request.message} (Thread: {request.thread_id})")

    queue = asyncio.Queue()
    await queue.put(f"data: {json.dumps({'type': 'status', 'content': 'Initializing research...'})}\n\n")

    # Intercept commands
    msg_text = request.message.strip()
    if msg_text.startswith("/sandbox"):
        if request.thread_id:
            thread_sandbox_modes[request.thread_id] = True
            await queue.put(f"data: {json.dumps({'type': 'log', 'log_type': 'RESPONSE', 'agent': 'System', 'content': '🔄 **Mode Switched:** You are now in **Sandbox Mode**. All orders will be simulated and no real money will be used.'})}\n\n")
        await queue.put(f"data: {json.dumps({'type': 'done'})}\n\n")
        yield await queue.get()
        yield await queue.get()
        return

    if msg_text.startswith("/live"):
        if request.thread_id:
            thread_sandbox_modes[request.thread_id] = False
            await queue.put(f"data: {json.dumps({'type': 'log', 'log_type': 'RESPONSE', 'agent': 'System', 'content': '⚠️ **Mode Switched:** You are now in **LIVE Mode**. All orders will be placed on your actual Upstox account. Proceed with caution!'})}\n\n")
        await queue.put(f"data: {json.dumps({'type': 'done'})}\n\n")
        yield await queue.get()
        yield await queue.get()
        return
        
    if msg_text.startswith("/new"):
        await queue.put(f"data: {json.dumps({'type': 'log', 'log_type': 'RESPONSE', 'agent': 'System', 'content': 'Context cleared! Please start a new conversation.'})}\n\n")
        await queue.put(f"data: {json.dumps({'type': 'done'})}\n\n")
        yield await queue.get()
        yield await queue.get()
        return

    if msg_text.startswith("/news"):
        topic = msg_text.replace("/news", "").strip()
        msg_text = f"Fetch and summarize the latest news for: {topic}" if topic else "Fetch and summarize the latest news."
    elif msg_text.startswith("/deepdive"):
        topic = msg_text.replace("/deepdive", "").strip()
        msg_text = f"Conduct a comprehensive, deep-dive research report on: {topic}" if topic else "Conduct a comprehensive, deep-dive research report."
    
    messages = []
    if request.hidden_instruction:
        messages.append(SystemMessage(content=request.hidden_instruction))
    messages.append(HumanMessage(content=msg_text, additional_kwargs={"query_id": query_id}))

    thread_id = request.thread_id or str(uuid.uuid4())
    config = {"configurable": {"thread_id": thread_id, "platform": "web", "sse_queue": queue}}
    
    # Set the thread mode before running
    is_sandbox = thread_sandbox_modes.get(thread_id, False)
    is_sandbox_mode.set(is_sandbox)
    
    if not is_sandbox:
        token_status = await db.get_live_token_status()
        if not token_status["is_valid"]:
            import os
            client_id = os.environ.get("UPSTOX_CLIENT_ID", "")
            webhook_domain = await db.get_setting("WEBHOOK_DOMAIN") or ""
            redirect_uri = f"{webhook_domain}/upstox/callback"
            auth_url = f"https://api.upstox.com/v2/login/authorization/dialog?response_type=code&client_id={client_id}&redirect_uri={redirect_uri}"
            
            error_msg = f"⚠️ **LIVE Access Token Expired**\n\nYour Upstox token is expired or was generated before today's market session. Please [click here to authorize]({auth_url}) before proceeding."
            await db.insert_event(thread_id, query_id, 'RESPONSE', 'System', error_msg)
            await queue.put(f"data: {json.dumps({'type': 'log', 'log_type': 'RESPONSE', 'agent': 'System', 'content': error_msg})}\n\n")
            await queue.put(f"data: {json.dumps({'type': 'done'})}\n\n")
            yield await queue.get()
            yield await queue.get()
            return
    
    if request.thread_id and db._pool:
        try:
            async with db._pool.connection() as conn:
                await conn.execute(
                    "UPDATE user_threads SET updated_at = CURRENT_TIMESTAMP WHERE thread_id = %s",
                    (request.thread_id,)
                )
        except Exception as e:
            logger.error(f"Failed to update thread timestamp: {e}")

    state = {"messages": messages}
    
    # Launch background task that runs the graph and writes to the queue and database
    graph_task = asyncio.create_task(
        run_graph(app.state.graph, state, config, thread_id, query_id, queue, logger)
    )

    try:
        while True:
            data = await queue.get()
            yield data
            if data.startswith(f"data: {{\"type\": \"done\"}}") or data.startswith(f"data: {{\"type\": \"error\""):
                break
    except asyncio.CancelledError:
        logger.info(f"Client disconnected for query {query_id}. Graph will continue running in background.")
        raise

# ─── Order Confirmation Endpoints ───────────────────────────────────────────────

from src.agent.upstox_tools import pending_tool_futures

@app.post("/orders/confirm/{confirmation_id}")
async def confirm_order(confirmation_id: str):
    if confirmation_id not in pending_tool_futures:
        raise HTTPException(status_code=400, detail="Invalid or expired confirmation ID")
    future = pending_tool_futures[confirmation_id]
    if not future.done():
        future.set_result("confirm")
    return {"status": "success", "message": "Order confirmed"}

@app.post("/orders/cancel/{confirmation_id}")
async def cancel_order(confirmation_id: str):
    if confirmation_id not in pending_tool_futures:
        raise HTTPException(status_code=400, detail="Invalid or expired confirmation ID")
    future = pending_tool_futures[confirmation_id]
    if not future.done():
        future.set_result("cancel")
    return {"status": "success", "message": "Order cancelled"}

# ─── Chat Endpoint ────────────────────────────────────────────────────────────

@app.post("/chat/stream")
async def chat_stream(request: ChatRequest):
    query_id = generate_query_id()
    return StreamingResponse(
        generate_sse_events(query_id, request),
        media_type="text/event-stream"
    )

# ─── Threads API ──────────────────────────────────────────────────────────────

class ThreadCreateRequest(BaseModel):
    title: str

@app.post("/threads")
async def create_thread(request: ThreadCreateRequest):
    """Create a new thread."""
    if not db._pool:
        raise HTTPException(status_code=500, detail="Database not initialized")
    
    thread_id = str(uuid.uuid4())
    async with db._pool.connection() as conn:
        await conn.execute(
            "INSERT INTO user_threads (thread_id, title) VALUES (%s, %s)",
            (thread_id, request.title)
        )
    return {"thread_id": thread_id, "title": request.title}

@app.get("/threads")
async def list_threads():
    """List all threads except Telegram ones."""
    if not db._pool:
        return {"threads": []}
        
    async with db._pool.connection() as conn:
        async with conn.cursor() as cur:
            await cur.execute("SELECT thread_id, title, created_at, updated_at FROM user_threads WHERE title NOT LIKE 'Telegram:%' ORDER BY updated_at DESC")
            rows = await cur.fetchall()
            return {"threads": [{"id": r[0], "title": r[1], "created_at": r[2], "updated_at": r[3]} for r in rows]}

@app.get("/threads/{thread_id}")
async def get_thread_history(thread_id: str):
    """Retrieve chat history and artifacts for a thread."""
    if not db.checkpointer:
        return {"messages": [], "artifacts": []}
    
    # Fetch events for this thread grouped by query_id
    query_events = {}
    if db._pool:
        try:
            async with db._pool.connection() as conn:
                async with conn.cursor() as cur:
                    await cur.execute(
                        "SELECT query_id, log_type, agent, content, event_metadata, created_at FROM query_events WHERE thread_id = %s ORDER BY id ASC",
                        (thread_id,)
                    )
                    for row in await cur.fetchall():
                        q_id, l_type, agt, cont, meta, c_at = row
                        if q_id not in query_events:
                            query_events[q_id] = []
                        # Condense reasoning chunks of the same id together
                        meta_dict = meta if isinstance(meta, dict) else (json.loads(meta) if meta else {})
                        
                        is_reasoning = l_type == 'REASONING'
                        msg_id = meta_dict.get("id")
                        logs_list = query_events[q_id]
                        
                        if is_reasoning and msg_id and logs_list and logs_list[-1]["log_type"] == "REASONING" and logs_list[-1].get("id") == msg_id:
                            logs_list[-1]["content"] += cont
                        else:
                            logs_list.append({
                                "log_type": l_type,
                                "agent": agt,
                                "content": cont,
                                "tool": meta_dict.get("tool"),
                                "subagent": meta_dict.get("subagent"),
                                "path": meta_dict.get("path"),
                                "id": msg_id,
                                "timestamp": c_at.strftime("%I:%M:%S %p") if c_at else ""
                            })
        except Exception as e:
            logger.error(f"Failed to fetch query events: {e}")

    config = {"configurable": {"thread_id": thread_id}}
    state = await app.state.graph.aget_state(config)
    
    # 1. Extract messages
    history = []
    current_query_id = None
    
    if state and state.values and "messages" in state.values:
        for msg in state.values["messages"]:
            if isinstance(msg, HumanMessage):
                current_query_id = msg.additional_kwargs.get("query_id")
                history.append({"role": "user", "content": msg.content})
            elif isinstance(msg, SystemMessage):
                continue
            elif _is_supervisor_response(msg, ""):
                logs = query_events.get(current_query_id, []) if current_query_id else []
                artifacts = [log for log in logs if log["log_type"] == "ARTIFACT"]
                
                references = []
                for log in logs:
                    if log["log_type"] == "TOOL_RESULT" and log.get("tool") in ("search_web", "search_financial_data"):
                        content = log.get("content", "")
                        links = []
                        for line in content.split("\n"):
                            title_match = re.search(r"^Title:\s*(.*?)\s*\|\s*URL:", line)
                            url_match = re.search(r"\|\s*URL:\s*(https?://[^\s|]+)", line)
                            if title_match and url_match:
                                links.append({"title": title_match.group(1).strip(), "url": url_match.group(1).strip()})
                        
                        if links:
                            # find matching TOOL_CALL query
                            query_str = "Search Results"
                            # search backward from current log
                            # we can just search all logs before this one
                            idx = logs.index(log)
                            for i in range(idx - 1, -1, -1):
                                prev_log = logs[i]
                                if prev_log["log_type"] == "TOOL_CALL" and prev_log.get("tool") == log.get("tool"):
                                    try:
                                        args = json.loads(prev_log.get("content", "{}"))
                                        query_str = args.get("query", query_str)
                                    except:
                                        pass
                                    break
                            
                            references.append({
                                "query": query_str,
                                "tool": log.get("tool"),
                                "links": links
                            })
                
                history.append({"role": "agent", "content": msg.content, "logs": logs, "artifacts": artifacts, "references": references})
    
    return {"messages": history, "artifacts": []}

@app.get("/upstox/callback")
async def upstox_callback(code: str = None):
    if not code:
        return HTMLResponse("<h2>Error: No code provided</h2>")
    
    client_id = os.environ.get("UPSTOX_CLIENT_ID")
    client_secret = os.environ.get("UPSTOX_CLIENT_SECRET")
    
    # We dynamically constructed the redirect URI based on the webhook domain.
    webhook_domain = await db.get_setting("WEBHOOK_DOMAIN")
    if webhook_domain:
        redirect_uri = f"{webhook_domain}/upstox/callback"
    else:
        redirect_uri = None
    
    if not all([client_id, client_secret, redirect_uri]):
        return HTMLResponse("<h2>Error: Missing UPSTOX_CLIENT_ID, UPSTOX_CLIENT_SECRET in .env, or WEBHOOK_DOMAIN not configured in DB.</h2>")

    url = 'https://api.upstox.com/v2/login/authorization/token'
    headers = {
        'accept': 'application/json',
        'Api-Version': '2.0',
        'Content-Type': 'application/x-www-form-urlencoded'
    }
    data = {
        'code': code,
        'client_id': client_id,
        'client_secret': client_secret,
        'redirect_uri': redirect_uri,
        'grant_type': 'authorization_code'
    }
    
    response = requests.post(url, headers=headers, data=data)
    if response.status_code == 200:
        json_resp = response.json()
        access_token = json_resp.get('access_token')
        await db.set_setting("UPSTOX_LIVE_ACCESS_TOKEN", access_token)
        os.environ["UPSTOX_LIVE_ACCESS_TOKEN"] = access_token
        
        # Clear the Upstox client cache so it rebuilds with the new token
        import src.agent.upstox_client_manager as ucm
        ucm._live_client = None
        
        # Notify user on Telegram
        from src.api.telegram_bot import bot
        if bot:
            admin_chat_id = await db.get_setting("ADMIN_CHAT_ID")
            if admin_chat_id:
                try:
                    await bot.send_message(admin_chat_id, "✅ **Live token successfully refreshed for today!**")
                except:
                    pass
        
        return HTMLResponse("<h2>✅ Success! You can close this window.</h2><p>Your live token has been updated securely.</p>")
    else:
        return HTMLResponse(f"<h2>❌ Error getting token: {response.status_code}</h2><p>{response.text}</p>")
