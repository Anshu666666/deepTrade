<div align="center">

# DeepTrade 📈🤖
### Autonomous AI-Powered Algorithmic Trading & Financial Research Agent

[![Python](https://img.shields.io/badge/Python-3.10%2B-blue.svg)](https://www.python.org/)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.100%2B-009688.svg)](https://fastapi.tiangolo.com/)
[![DeepAgents](https://img.shields.io/badge/DeepAgents-Agentic%20Skills-orange.svg)](https://github.com/langchain-ai/deepagents)
[![Broker](https://img.shields.io/badge/Broker-Upstox%20v3-red.svg)](https://upstox.com/developer/api-documentation/)
[![Interface](https://img.shields.io/badge/Interface-Telegram%20Bot-2CA5E0.svg)](https://core.telegram.org/bots)
[![License](https://img.shields.io/badge/License-MIT-green.svg)](./LICENSE)

*Execute trades, monitor portfolios, perform real-time fundamental & technical equity research, and receive synthesized market reports — directly inside Telegram and a modern Web UI.*

</div>

---

## 🏗️ High-Level System Architecture

```mermaid
flowchart TB
    subgraph Clients["User Interfaces"]
        TG["📱 Telegram Bot (@YourBot)"]
        WEB["💻 Web UI (Vite + React)"]
    end

    subgraph Server["FastAPI Backend (main.py)"]
        AUTH["🔐 TOTP & First-Come Admin Lock"]
        PRECHECK["⚡ Deterministic Pre-Flight Check<br/>(IP Whitelist & Daily Token)"]
        BG["⚙️ FastAPI BackgroundTasks & SSE Queue"]
    end

    subgraph AgentSystem["DeepAgent Engine (src/agent/graph.py)"]
        SUP["🧠 DeepTrade Agent (Supervisor)<br/>(OpenRouter / poolside / nemotron)"]
        SKILLS["📁 Progressive Skills System<br/>(/skills/upstox/SKILL.md)"]
        TOOLS["⚡ Unified Tool Suite<br/>• Upstox Market Data & Orders<br/>• Exa Web Search<br/>• Valyu SEC & Financial Data"]
        SUP <--> SKILLS
        SUP --> TOOLS
    end

    subgraph Persistence["Storage & Broker Services"]
        PG[("🐘 PostgreSQL (Supabase)<br/>State Checkpoints & Token Storage")]
        BROKER["📈 Upstox Live / Sandbox API<br/>(Orders, LTP, Portfolio, Funds)"]
        MOCK[("📝 Mock Sandbox Registry<br/>(₹10,00,000 Virtual Ledger)")]
    end

    TG -->|Webhook| AUTH
    WEB -->|REST / SSE| AUTH
    AUTH --> PRECHECK
    PRECHECK --> BG
    BG --> SUP
    SUP -.->|Checkpoint & Memory| PG
    TOOLS -->|Live Market & Orders| BROKER
    TOOLS -->|Sandbox Mode| MOCK
```

---

## ✨ Key Capabilities

- **💬 Conversational Trading & Live Execution**: Issue natural language commands (e.g., *"Buy 1 share of PCJEWELLER"*, *"Show my open positions"*, *"Analyze TCS fundamentals"*).
- **🛡️ Interactive Two-Step Order Confirmations**: Prevents unintended orders. Generates native Telegram Inline Keyboard Buttons (`[✅ Confirm]` / `[❌ Cancel]`) with an automated 5-minute timeout.
- **⚡ Deterministic Pre-Flight IP & Token Verification**: Proactively verifies that your Upstox access token is active and your network's public IP matches Upstox's whitelisted static IP *before* sending prompts to the LLM, eliminating wasted tokens and unexpected API errors.
- **🔄 Auto-Syncing Dynamic IP Whitelisting**: Automatically detects changes in your local ISP's IPv4/IPv6 addresses and programmatically updates Upstox static IP settings via API.
- **🧠 Deep Financial Research**: Direct tool integrations to fetch live quotes (Upstox LTP/OHLC), SEC filings (Valyu), and real-time financial news (Exa) to synthesize structured markdown reports.
- **🧪 Hybrid Live vs. Simulated Sandbox Mode**: Toggle seamlessly between `/live` and `/sandbox`. In Sandbox mode, DeepTrade runs a local ₹1,000,000 virtual ledger (`sandbox_db.json`) while pulling real-time market prices.
- **🔒 Hardened Single-User Security Lock**: Locks permanently to the first Telegram user who messages it (`chat_id`), immediately rejecting all unauthorized external interactions.

---

## 📱 Interactive Telegram Trading Flow

```mermaid
sequenceDiagram
    autonumber
    actor User as 👤 Trader (Telegram)
    participant TG as 🤖 DeepTrade Bot
    participant Agent as 🧠 DeepTrade Agent
    participant Tool as ⚡ Upstox Tools
    participant API as 🏦 Upstox API

    User->>TG: "Buy 1 share of PCJEWELLER"
    TG->>Agent: Ingest prompt + Pre-flight verification
    Agent->>Tool: Call upstox_get_market_data(symbol="PCJEWELLER")
    Tool->>API: Fetch current LTP (₹9.74)
    API-->>Tool: Return ₹9.74
    Tool-->>Agent: Return LTP
    Agent->>Tool: Call upstox_place_order(symbol="PCJEWELLER", qty=1, price=9.74)
    Tool->>TG: Send Inline Buttons [✅ Confirm] [❌ Cancel]
    Note over Tool: Registers Future & awaits user click (up to 5 mins)
    User->>TG: Clicks [✅ Confirm]
    TG->>Tool: Resolves Future with "confirm"
    Tool->>API: Executes PlaceOrderV3Request
    API-->>Tool: 200 OK (Order ID: 2608210001)
    Tool-->>Agent: Return execution confirmation
    Agent-->>TG: "✅ Order successfully placed for 1 share of PCJEWELLER at ₹9.74!"
```

---

## 📚 Documentation & Architecture Guides

DeepTrade comes with comprehensive architectural and operational documentation:

| Document | Purpose |
| :--- | :--- |
| **[Setup & Environment Guide (`setup_instructions.md`)](./setup_instructions.md)** | Step-by-step guide for configuring all API keys, local Ngrok vs Cloud deployment, daily OAuth token generation, and static IP whitelisting. |
| **[Architecture & Skills Spec (`architecture_and_skills.md`)](./architecture_and_skills.md)** | Deep architectural breakdown of DeepAgent graph, SSE event streaming, database schemas, and SDK workarounds. |
| **[Upstox Tools & Agent Spec (`upstox_tools_and_subagents.md`)](./upstox_tools_and_subagents.md)** | Complete parameter reference for all trading tools, sandbox mock registry, and Telegram command mappings. |

---

## 🛠️ Technology Stack

| Layer | Technologies |
| :--- | :--- |
| **Backend & API** | Python 3.10+, FastAPI, Uvicorn, APScheduler |
| **AI & Agentic Framework** | DeepAgents, LangGraph, LangChain, OpenRouter (`poolside/laguna-s-2.1:free`, `nvidia/nemotron-3.5-lightning:free`) |
| **Database & State** | PostgreSQL (Supabase / Neon), `psycopg_pool`, `AsyncPostgresSaver`, `AsyncPostgresStore` |
| **Broker Integration** | Upstox Python SDK v3, Upstox Market Quote & History APIs |
| **Client Interfaces** | Telegram Bot API (`aiogram` Webhooks), React + Vite + TypeScript Web UI |

---

## 🚀 Quick Start Guide

### 1. Clone & Install Dependencies

```bash
git clone https://github.com/Anshu666666/deepTrade.git
cd deepTrade
python -m venv venv

# Windows:
.\venv\Scripts\activate

# Linux/macOS:
source venv/bin/activate

pip install -r requirements.txt
```

### 2. Configure Environment Variables

Create a `.env` file in the root directory (see [setup_instructions.md](./setup_instructions.md) for full details):

```env
# Database
PG_DATABASE_URL=postgresql://user:password@host:port/postgres

# OpenRouter LLM
OPENROUTER_API_KEY=your_openrouter_key
OPENROUTER_MODEL=poolside/laguna-s-2.1:free

# Upstox API Credentials
UPSTOX_CLIENT_ID=your_client_id
UPSTOX_CLIENT_SECRET=your_client_secret
UPSTOX_ANALYTICS_TOKEN=your_analytics_token
UPSTOX_SANDBOX_ACCESS_TOKEN=your_sandbox_token

# Telegram & Ngrok
TELEGRAM_BOT_TOKEN=your_telegram_bot_token
USE_NGROK=true
NGROK_AUTHTOKEN=your_ngrok_token
NGROK_DOMAIN=your-static-domain.ngrok-free.dev

# External Search Tools
EXA_API_KEY=your_exa_key
VALYU_API_KEY=your_valyu_key
```

### 3. Start DeepTrade

```bash
python main.py
```

### 4. Authorize Telegram & Upstox

1. Open Telegram and send `/start` to your bot. The bot will automatically bind to your `chat_id`.
2. Generate your daily live token by running:
   ```bash
   python generate_live_token.py
   ```
3. Click the authorization link sent to your Telegram to log in to Upstox.

---

## 💬 Supported Telegram Commands

| Command | Action |
| :--- | :--- |
| `/start` or `/help` | Shows welcome message, bot status, and available commands. |
| `/sandbox` | Switches session to simulated paper trading (₹1,000,000 virtual balance). |
| `/live` | Switches session to real-money live broker execution. |
| `/new` | Clears conversation state and initializes a fresh research thread. |
| `/analyse <ticker>` | Initiates end-to-end technical & fundamental equity research. |
| `/news <topic>` | Fetches and summarizes recent market catalysts and sector news. |
| `/deepdive <topic>` | Conducts multi-agent financial deep-dive with structured markdown report. |

---

## 🔐 Security & Risk Disclaimer

> [!WARNING]
> **Educational and Personal Use Only**: Algorithmic and autonomous AI trading carries substantial financial risk. Large Language Models can hallucinate, experience latency, or make unexpected decisions. Always test your strategies in `/sandbox` mode before deploying live capital. The creator of DeepTrade assumes no liability for trading losses.

---

## 📝 License

Distributed under the **MIT License**. See [`LICENSE`](./LICENSE) for more information.
