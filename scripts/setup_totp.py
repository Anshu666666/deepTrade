#!/usr/bin/env python3
"""
DeepTrade TOTP Authenticator Setup & Refresh Utility

Usage:
    python scripts/setup_totp.py           # View current QR code & secret key
    python scripts/setup_totp.py --reset   # Generate a brand new secret key & QR code
"""

import os
import sys
import argparse
from pathlib import Path
from dotenv import load_dotenv

# Ensure root directory in path and load .env
ROOT_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT_DIR))
load_dotenv(ROOT_DIR / ".env")

import pyotp
import qrcode

def get_or_create_secret(force_reset=False):
    env_file = ROOT_DIR / ".env"
    secret = os.environ.get("WEB_OTP_SECRET")
    
    if not secret or force_reset:
        secret = pyotp.random_base32()
        os.environ["WEB_OTP_SECRET"] = secret
        
        # Update .env file
        if env_file.exists():
            content = env_file.read_text(encoding="utf-8")
            if "WEB_OTP_SECRET=" in content:
                import re
                content = re.sub(r"WEB_OTP_SECRET=.*", f"WEB_OTP_SECRET={secret}", content)
            else:
                content += f"\nWEB_OTP_SECRET={secret}\n"
            env_file.write_text(content, encoding="utf-8")
        else:
            env_file.write_text(f"WEB_OTP_SECRET={secret}\n", encoding="utf-8")
            
        print(f"✨ {'Generated new' if force_reset else 'Initialized'} WEB_OTP_SECRET in .env: {secret}")
    
    return secret

def main():
    parser = argparse.ArgumentParser(description="DeepTrade TOTP Setup Utility")
    parser.add_argument("--reset", action="store_true", help="Generate a fresh secret key and invalidate old 2FA")
    args = parser.parse_args()
    
    secret = get_or_create_secret(force_reset=args.reset)
    
    totp = pyotp.TOTP(secret)
    uri = totp.provisioning_uri(name="admin@deeptrade.ai", issuer_name="DeepTrade")
    
    print("\n" + "="*60)
    print("🔐 DeepTrade 2FA / TOTP Authenticator Setup")
    print("="*60)
    print(f"\n🔑 Secret Key (Manual Entry):  {secret}")
    print(f"📋 Provisioning URI:          {uri}")
    print("\n📱 Terminal QR Code (Scan with Google Authenticator / Apple Passwords):")
    print("-" * 60)
    
    qr = qrcode.QRCode(border=2)
    qr.add_data(uri)
    qr.make(fit=True)
    qr.print_ascii(invert=True)
    
    # Also save as image
    qr_img_path = ROOT_DIR / "assets" / "totp_qr.png"
    img = qr.make_image(fill_color="black", back_color="white")
    img.save(str(qr_img_path))
    print(f"\n🖼️ QR Code image saved to: {qr_img_path}")
    print(f"⏱️ Current 6-digit verification code: {totp.now()}")
    print("="*60 + "\n")

if __name__ == "__main__":
    main()
