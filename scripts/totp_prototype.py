import pyotp
import qrcode
import io
import base64
from fastapi import FastAPI, Form
from fastapi.responses import HTMLResponse
import uvicorn

app = FastAPI()

# In a real app, this secret would be stored securely in the database for the user.
# For this prototype, we'll store it globally in memory.
mock_db = {}

@app.get("/", response_class=HTMLResponse)
async def serve_ui():
    return """
    <html>
        <head>
            <title>Google Authenticator Prototype</title>
            <style>
                body { font-family: Arial, sans-serif; text-align: center; margin-top: 50px; }
                .card { border: 1px solid #ccc; padding: 20px; border-radius: 10px; display: inline-block; }
                input, button { padding: 10px; margin: 10px; font-size: 16px; }
            </style>
        </head>
        <body>
            <div class="card">
                <h2>Step 1: Setup Authenticator</h2>
                <button onclick="generateQR()">Generate Secret & QR Code</button>
                <div id="qr-container" style="margin-top: 20px;"></div>
                <p id="secret-text"></p>
                
                <hr>
                
                <h2>Step 2: Verify Code</h2>
                <input type="text" id="otp-input" placeholder="Enter 6-digit code" maxlength="6">
                <button onclick="verifyCode()">Verify</button>
                <h3 id="result"></h3>
            </div>

            <script>
                async function generateQR() {
                    const response = await fetch('/generate');
                    const data = await response.json();
                    document.getElementById('qr-container').innerHTML = `<img src="data:image/png;base64,${data.qr_code}" alt="QR Code"/>`;
                    document.getElementById('secret-text').innerText = "Secret: " + data.secret + " (Save this!)";
                }

                async function verifyCode() {
                    const code = document.getElementById('otp-input').value;
                    const response = await fetch('/verify', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                        body: `code=${code}`
                    });
                    const data = await response.json();
                    const resultEl = document.getElementById('result');
                    if (data.success) {
                        resultEl.style.color = "green";
                        resultEl.innerText = "✅ Success! Valid Code.";
                    } else {
                        resultEl.style.color = "red";
                        resultEl.innerText = "❌ Failed! Invalid Code.";
                    }
                }
            </script>
        </body>
    </html>
    """

@app.get("/generate")
async def generate_secret():
    # 1. Generate a random base32 secret
    secret = pyotp.random_base32()
    mock_db["current_secret"] = secret
    
    # 2. Generate the Provisioning URI (this is what the QR code contains)
    # The issuer_name is what shows up in the Google Authenticator app as the app name.
    totp = pyotp.TOTP(secret)
    uri = totp.provisioning_uri(name="admin@deeptrade.ai", issuer_name="DeepTrade Web")
    
    # 3. Create a QR code image from the URI
    qr = qrcode.QRCode(version=1, box_size=10, border=4)
    qr.add_data(uri)
    qr.make(fit=True)
    img = qr.make_image(fill_color="black", back_color="white")
    
    # Convert image to base64 so we can easily send it to the frontend
    buf = io.BytesIO()
    img.save(buf, format='PNG')
    qr_b64 = base64.b64encode(buf.getvalue()).decode('utf-8')
    
    return {"secret": secret, "qr_code": qr_b64}

@app.post("/verify")
async def verify_code(code: str = Form(...)):
    secret = mock_db.get("current_secret")
    if not secret:
        return {"success": False, "message": "No secret generated yet"}
        
    # Verify the code using pyotp
    totp = pyotp.TOTP(secret)
    
    # You can also use valid_window=1 to allow a 30-second clock skew
    is_valid = totp.verify(code)
    
    return {"success": is_valid}

if __name__ == "__main__":
    print("Running Google Authenticator Prototype on http://localhost:8050")
    uvicorn.run(app, host="0.0.0.0", port=8050)
