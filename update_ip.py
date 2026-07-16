import os
import sys
import requests
import asyncio
from dotenv import load_dotenv

if sys.platform == "win32":
    asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())

load_dotenv()
from src.api import db

async def update_local_ip():
    async with db.lifespan_db(None):
        token = await db.get_setting("UPSTOX_LIVE_ACCESS_TOKEN")
        if not token:
            print("No UPSTOX_LIVE_ACCESS_TOKEN found in DB.")
            return
        
        url = 'https://api.upstox.com/v2/user/ip'
        headers = {
            'Accept': 'application/json',
            'Content-Type': 'application/json',
            'Authorization': f'Bearer {token}'
        }
        # We will add BOTH the IPv4 and IPv6 addresses!
        data = {
            'primary_ip': '49.36.144.6',
            'secondary_ip': '2405:201:4039:5035:9171:7999:a453:33d'
        }
        
        print(f"Sending PUT request to Upstox with data: {data}")
        resp = requests.put(url, headers=headers, json=data)
        print("Status code:", resp.status_code)
        print("Response:", resp.text)

if __name__ == "__main__":
    asyncio.run(update_local_ip())
