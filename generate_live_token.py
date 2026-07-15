import os
import asyncio
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

import src.api.db as db

async def main():
    print("Initializing Database Connection...")
    # Initialize the DB connection pool using the existing context manager
    async with db.lifespan_db(None):
        client_id = os.environ.get("UPSTOX_CLIENT_ID")
        if not client_id:
            print("❌ Error: UPSTOX_CLIENT_ID is not set in .env")
            return
            
        # Try to get the active webhook domain (Ngrok URL) from the DB
        webhook_domain = await db.get_setting("WEBHOOK_DOMAIN")
        
        # Fallback to .env NGROK_DOMAIN if the DB setting is somehow missing
        if not webhook_domain:
            ngrok_domain = os.environ.get("NGROK_DOMAIN")
            if ngrok_domain:
                webhook_domain = f"https://{ngrok_domain}"
            else:
                print("❌ Warning: WEBHOOK_DOMAIN not found in DB and NGROK_DOMAIN not in .env.")
                print("Please make sure the main server (python main.py) is running to establish the Ngrok tunnel.")
                return

        redirect_uri = f"{webhook_domain}/upstox/callback"
        auth_url = f"https://api.upstox.com/v2/login/authorization/dialog?response_type=code&client_id={client_id}&redirect_uri={redirect_uri}"
        
        print("\n" + "="*80)
        print("🔗 UPSTOX MANUAL LOGIN URL")
        print("="*80)
        print(auth_url)
        print("="*80)
        print("\n👉 Click the link above in your browser to authorize DeepTrade for Live Trading.")
        print("⚠️  IMPORTANT: The main server (`python main.py`) MUST be running so it can receive the callback and save the token!\n")

        # Optionally send it to the Telegram bot if registered
        admin_chat_id = await db.get_setting("ADMIN_CHAT_ID")
        telegram_token = os.environ.get("TELEGRAM_BOT_TOKEN")
        
        if admin_chat_id and telegram_token:
            print("Sending login link to your Telegram...")
            try:
                from aiogram import Bot
                from aiogram.client.default import DefaultBotProperties
                from aiogram.enums import ParseMode
                
                # Initialize a temporary bot session just to send this message
                temp_bot = Bot(token=telegram_token, default=DefaultBotProperties(parse_mode=ParseMode.HTML))
                
                msg = (
                    "🔑 <b>Manual Token Generation</b>\n\n"
                    "You requested a manual Upstox login link. "
                    "Click below to authorize LIVE trading:\n\n"
                    f"🔗 <a href='{auth_url}'>Authorize DeepTrade</a>"
                )
                
                await temp_bot.send_message(admin_chat_id, msg)
                print(f"✅ Successfully sent the login link to your Telegram (Admin Chat ID: {admin_chat_id}).")
                
                # Close the session properly
                await temp_bot.session.close()
            except Exception as e:
                print(f"⚠️ Failed to send Telegram message: {e}")
        else:
            print("ℹ️  No ADMIN_CHAT_ID found in the database (or missing Telegram Token). Skipping Telegram message.")

import sys

if __name__ == "__main__":
    if sys.platform == 'win32':
        asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())
    asyncio.run(main())
