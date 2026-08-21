#!/usr/bin/env python3
"""
Script to invalidate active Upstox Live Token and reset TOTP 2FA secret.
"""

import os
import sys
import asyncio
from pathlib import Path
from dotenv import load_dotenv

ROOT_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT_DIR))
load_dotenv(ROOT_DIR / ".env")

import pyotp
import re
import src.api.db as db

async def invalidate_all():
    print("🧹 Invalidating current Upstox live token and 2FA secret key...")
    
    # 1. Generate a brand new TOTP secret (invalidating the old one)
    new_totp_secret = pyotp.random_base32()
    
    # 2. Update .env file
    env_file = ROOT_DIR / ".env"
    if env_file.exists():
        content = env_file.read_text(encoding="utf-8")
        
        # Invalidate UPSTOX_LIVE_ACCESS_TOKEN
        if "UPSTOX_LIVE_ACCESS_TOKEN=" in content:
            content = re.sub(r"UPSTOX_LIVE_ACCESS_TOKEN=.*", 'UPSTOX_LIVE_ACCESS_TOKEN=""', content)
        else:
            content += '\nUPSTOX_LIVE_ACCESS_TOKEN=""\n'
            
        # Update WEB_OTP_SECRET to new fresh key
        if "WEB_OTP_SECRET=" in content:
            content = re.sub(r"WEB_OTP_SECRET=.*", f'WEB_OTP_SECRET="{new_totp_secret}"', content)
        else:
            content += f'\nWEB_OTP_SECRET="{new_totp_secret}"\n'
            
        env_file.write_text(content, encoding="utf-8")
        print("✅ Updated .env: UPSTOX_LIVE_ACCESS_TOKEN invalidated, new WEB_OTP_SECRET assigned.")
        
    os.environ["UPSTOX_LIVE_ACCESS_TOKEN"] = ""
    os.environ["WEB_OTP_SECRET"] = new_totp_secret
    
    # 3. Update Database settings if DB is configured
    try:
        class DummyApp:
            pass
        async with db.lifespan_db(DummyApp()):
            await db.set_setting("UPSTOX_LIVE_ACCESS_TOKEN", "")
            await db.set_setting("WEB_OTP_SECRET", new_totp_secret)
            print("✅ Database settings table updated (Live Token cleared, 2FA secret updated).")
    except Exception as e:
        print(f"ℹ️ DB update notice: {e}")
        
    # 4. Clear memory cache
    try:
        import src.agent.upstox_client_manager as ucm
        ucm._live_client = None
        print("✅ Upstox client cache cleared.")
    except Exception:
        pass
        
    print(f"\n🎉 Token invalidation complete!")
    print(f"🔑 New 2FA Secret Key for testing: {new_totp_secret}")
    print(f"📱 Current 6-digit verification code: {pyotp.TOTP(new_totp_secret).now()}")

if __name__ == "__main__":
    asyncio.run(invalidate_all())
