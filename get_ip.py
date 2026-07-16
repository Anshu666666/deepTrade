import os
import sys
import requests
import asyncio
from dotenv import load_dotenv

if sys.platform == "win32":
    asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())

load_dotenv()
from src.api import db

async def get_ip():
    async with db.lifespan_db(None):
        token = await db.get_setting("UPSTOX_LIVE_ACCESS_TOKEN")
        if not token:
            print("No UPSTOX_LIVE_ACCESS_TOKEN found in DB.")
            return
        
        url = 'https://api.upstox.com/v2/user/ip'
        headers = {
            'Accept': 'application/json',
            'Authorization': f'Bearer {token}'
        }
        
        print("Fetching currently assigned IPs for your app...")
        resp = requests.get(url, headers=headers)
        print("Status code:", resp.status_code)
        print("Response:", resp.text)

if __name__ == "__main__":
    asyncio.run(get_ip())
