import os
import sys
import requests
import asyncio
from dotenv import load_dotenv

if sys.platform == "win32":
    asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())

ROOT_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if ROOT_DIR not in sys.path:
    sys.path.insert(0, ROOT_DIR)

load_dotenv(os.path.join(ROOT_DIR, ".env"))
from src.api import db

import urllib.request

def get_current_public_ip():
    try:
        with urllib.request.urlopen('https://api.ipify.org', timeout=5) as r:
            return r.read().decode('utf-8').strip()
    except Exception as e:
        print(f"Failed to fetch public IP: {e}")
        return None

async def update_local_ip(custom_ip=None):
    async with db.lifespan_db(None):
        token = await db.get_setting("UPSTOX_LIVE_ACCESS_TOKEN")
        if not token:
            print("❌ No UPSTOX_LIVE_ACCESS_TOKEN found in DB.")
            return
        
        current_ip = custom_ip or get_current_public_ip()
        if not current_ip:
            print("❌ Could not determine current public IP.")
            return
        
        url = 'https://api.upstox.com/v2/user/ip'
        headers = {
            'Accept': 'application/json',
            'Content-Type': 'application/json',
            'Authorization': f'Bearer {token}'
        }
        
        data = {
            'primary_ip': current_ip,
            'secondary_ip': '2405:201:4039:5035:9171:7999:a453:33d'
        }
        
        print(f"Sending PUT request to Upstox with data: {data}")
        resp = requests.put(url, headers=headers, json=data)
        print("Status code:", resp.status_code)
        print("Response:", resp.text)
        if resp.status_code == 200:
            print("\n✅ IP Successfully updated in Upstox!")
            print("⚠️  NOTE: Upstox invalidates your current live token when IP is changed.")
            print("Please re-authorize via Telegram or run `python generate_live_token.py`.")

if __name__ == "__main__":
    asyncio.run(update_local_ip())
