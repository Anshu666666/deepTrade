# DeepTrade: Setup & Architecture Guide

## Part 1: Environment Variables Setup (Where to fetch them)
Before starting DeepTrade, you must configure your environment variables. Below is a detailed guide on where to obtain every single required key.

### External AI & Search APIs
*   **`EXA_API_KEY`**: Sign up at [Exa.ai](https://exa.ai/) to get your API key for agentic web search capabilities.
*   **`VALYU_API_KEY`**: Obtain your API key from Valyu for real-time financial data retrieval.
*   **`OPENROUTER_API_KEY`**: Create an account at [OpenRouter.ai](https://openrouter.ai/) to access LLMs like Claude, GPT, or open-source models.
*   **`OPENROUTER_MODEL`**: Set the specific model string you want to use (e.g., `poolside/laguna-m.1:free` or `anthropic/claude-3.5-sonnet`).

### Database
*   **`PG_DATABASE_URL`**: Set up a PostgreSQL database (e.g., free tier on [Supabase](https://supabase.com/)). Obtain the connection URI (format: `postgresql://user:password@host:port/dbname`). This is required for persisting threads, state, and tokens.

### Upstox API Credentials
1.  Go to the [Upstox Developer Console](https://account.upstox.com/developer/apps).
2.  **`UPSTOX_SANDBOX_ACCESS_TOKEN`**: From the **Sandbox** section, generate and copy the token for simulated paper trading.
3.  **`UPSTOX_ANALYTICS_TOKEN`**: From the **Analytics** section, generate and copy the token for historical market data.
4.  **`UPSTOX_CLIENT_ID` & `UPSTOX_CLIENT_SECRET`**: Create a **Live App** in the Upstox console. Copy the Client ID and Secret.
    *   *Important:* You must whitelist your server URL in the Upstox portal as the Redirect URI (e.g., `https://your-domain.ngrok-free.dev/upstox/callback`).

### Telegram Bot
*   **`TELEGRAM_BOT_TOKEN`**: Open Telegram, search for `@BotFather`, and type `/newbot`. Follow the prompt steps to name your bot and receive your unique HTTP API token.

### Server Deployment Settings
*   **`USE_NGROK`**: Set to `true` if running locally on your laptop, or `false` if deploying to the cloud.
*   **`PUBLIC_URL`**: If hosting on a cloud provider (Render, GCP, AWS), paste your given static HTTPS domain here (e.g., `https://my-app.onrender.com`).
*   **`NGROK_AUTHTOKEN` & `NGROK_DOMAIN`**: If using local testing (`USE_NGROK=true`), get your Authtoken and claim a static domain from your [Ngrok Dashboard](https://dashboard.ngrok.com/).

---

## Part 2: Upstox Live Access Token Workflow
Here is the complete end-to-end flow of exactly how this token system works, including the inputs and outputs:

### 1. Inputs to the Script
When you run `generate_live_token.py`, it requires no manual arguments. It pulls everything it needs automatically:

* **`UPSTOX_CLIENT_ID`**: Fetched from your `.env` file to identify your specific app to Upstox.
* **`WEBHOOK_DOMAIN`**: It checks the PostgreSQL database to find the exact Ngrok/Cloud URL your main server is currently using.
* **Telegram Credentials**: It fetches your `TELEGRAM_BOT_TOKEN` from `.env` and `ADMIN_CHAT_ID` from the database.

### 2. Output of the Script
* **Terminal Output**: It prints a clearly formatted, clickable `https://api.upstox.com/...` authorization link directly into your console.
* **Telegram Output**: It instantly sends a message to your Telegram bot containing the exact same clickable authorization link.

### 3. The Complete Flow (Step-by-Step)
1. **You trigger the script**: You run `python generate_live_token.py` (while your main server `python main.py` is running in the background).
2. **You click the link**: You click the authorization link in either your terminal or your Telegram app.
3. **Upstox Login**: Your browser opens the Upstox login portal. You enter your PIN/OTP to authenticate.
4. **The Callback (The Handoff)**: Upon successful login, Upstox redirects your browser back to your server address (specifically `/upstox/callback`).
5. **The Server Takes Over**: Your running `main.py` server intercepts this callback, takes the temporary access code provided by Upstox, and securely exchanges it for a true 24-Hour Live Access Token.
6. **Data Storage**: The server permanently saves this new Live token directly into your PostgreSQL database with a fresh timestamp.
7. **Cache Cleared & Notification**: The server clears out the old Upstox client memory and sends you a final Telegram message: *"✅ Live token successfully refreshed for today!"*

### 4. The Automated Safety Net
As an added layer of logic, if you forget to run this script or the morning cron job fails, the system protects you:

* Whenever you type a command or query in LIVE mode (via web or Telegram), the system first looks at the token in the database.
* It checks the token's timestamp. If the token was generated before 3:30 AM IST today, it blocks the AI from attempting to use it.
* Instead of failing with confusing API errors, the bot gracefully replies: *"⚠️ LIVE Access Token Expired"* and provides you with the authorization link on the spot to continue your task.

### 5. Deployment Architecture: Cloud vs. Local (Ngrok)
To allow the server to properly receive the Upstox Callback and Telegram messages, it must have a publicly accessible URL. The system handles this in two ways:

**Local Deployment (Laptop/PC):**
*   **`USE_NGROK=true`**: When this is set in the `.env` file, the server automatically boots up an Ngrok tunnel to expose your local machine to the internet.
*   **`NGROK_DOMAIN` & `NGROK_AUTHTOKEN`**: These are instructions to the Ngrok service. When your server starts up, it tells Ngrok, *"Hey, please give me this specific, static URL instead of a random one."* This is critical because the Upstox API requires you to whitelist a specific `redirect_uri` in their developer console. If your URL changed every time you restarted the server, Upstox would reject the login.

**Cloud Deployment (Render/AWS/GCP):**
*   **`PUBLIC_URL`**: When hosting on a cloud provider, they provide a static URL for you. Running Ngrok in the cloud is bad practice and wastes resources. By specifying `PUBLIC_URL=https://my-app.com` and `USE_NGROK=false` in your cloud's environment variables, the server entirely skips Ngrok and directly registers your provided cloud URL with Telegram and Upstox.
*   *Graceful Fallback:* If you deploy to the cloud for the first time without a `PUBLIC_URL` set (because you don't know it yet), the server won't crash. It will boot successfully, print a warning, and wait for you to add the `PUBLIC_URL` to your environment settings before it activates the webhooks.

**The PostgreSQL DB (`WEBHOOK_DOMAIN`)**: 
Regardless of whether it uses Ngrok or a Cloud URL, once the server successfully determines its public domain, it saves it as the `WEBHOOK_DOMAIN` in the database. Background tasks (like the morning cron job or the `generate_live_token.py` script) query the database to construct the Upstox login link. This ensures they always use the genuinely active, verified URL that the server is currently listening on.

### 6. How is `ADMIN_CHAT_ID` Generated? (The Security Lock)
DeepTrade implements a "First-Come, First-Served" security lock to protect your trading account:
1. When the Telegram bot is started, it has no admin assigned.
2. The very **first person** to send a message to the bot (e.g., sending `/start`) triggers the webhook.
3. The server looks at the unique `chat_id` from that incoming message, sees that the `ADMIN_CHAT_ID` in the database is empty, and immediately saves that user's `chat_id` into the database as the permanent Admin.
4. It sends a confirmation message to that user: *"🔐 Security Lock Active: This bot is now permanently locked to your Telegram account."*
5. From that point forward, if any other random user on Telegram finds your bot and tries to send a message, the server compares their `chat_id` to the `ADMIN_CHAT_ID`. Because they don't match, the server simply ignores them and drops the request, ensuring nobody else can place trades on your Upstox account.

### 7. Upstox Static IP Whitelisting & IPv6 Issues (UDAPI1154)
The Upstox Live API requires you to whitelist your server's outbound IP address in the Developer Console. If the IP address does not match exactly, you will receive the `UDAPI1154: Access to this API is blocked due to static IP restrictions` error when attempting to place trades.

**The Shared IP Problem (Cloud Providers):**
If you deploy to the free tier of a cloud provider (like Render), your server shares its outbound IP with hundreds of other apps. If another developer on Render has already whitelisted that exact shared IP on their Upstox account, you will get an *"IP address already assigned"* error when trying to claim it, because Upstox requires unique static IPs per developer account.

**The IPv6 Connectivity Problem (Local Testing):**
When testing locally via Ngrok, you must whitelist your home WiFi's public IP address. However, modern Indian ISPs (like Jio or Airtel) use **IPv6** natively to route traffic to `api.upstox.com`. 
Even if you lookup your IPv4 address (e.g. `49.36.144.6`) and whitelist it, Upstox will still block your trades because it sees the request originating from your IPv6 address (e.g. `2405:201:4039:5035:9171:7999:a453:33d`).

**The Fix (Dual IP Whitelisting via API):**
The Upstox developer console UI doesn't always handle IPv6 perfectly. To fix this, DeepTrade includes a utility script (`update_ip.py`) that uses the Upstox API to programmatically assign BOTH your IPv4 and IPv6 addresses as your `primary_ip` and `secondary_ip`.
1. You must have an active live token stored in the database.
2. Edit `update_ip.py` and replace the IPs in the `data` dictionary with the exact IPs printed in your server logs during a failed order (the IPv4 from ipify.org, and the IPv6 from the `UDAPI1154` error response).
3. Run `python update_ip.py`.
4. *Important:* Upon successfully updating your IPs, Upstox will instantly invalidate your current access token for security reasons. You must re-login and generate a new token via Telegram before trading again.