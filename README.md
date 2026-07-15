<h1 align="center">DeepTrade 📈🤖</h1>
<p align="center">
  <strong>An autonomous, AI-powered algorithmic trading agent built on Telegram.</strong>
</p>

DeepTrade is an advanced agentic trading system that leverages large language models (LLMs) to perform complex financial research, execute trades, and manage a portfolio via the Upstox API. It is designed to be fully autonomous, operating directly inside a Telegram chat, while maintaining strict user security and compliance.

---

## 🌟 Key Features

- **Conversational Trading UI:** Execute trades, query portfolio status, and perform deep-dive financial analysis just by chatting on Telegram.
- **Agentic AI Pipeline:** Powered by LangGraph and DeepAgents, the bot understands complex financial tasks, decides which tools to use, and formulates strategies using a single powerful Supervisor agent.
- **Seamless Upstox Integration:** Native integration with Upstox API v3 for both Sandbox (simulated) and Live (real-money) trading modes.
- **Autonomous Token Refresh:** Bypasses manual daily OAuth logins. The bot sends a daily morning prompt via Telegram and securely intercepts the OAuth callback to keep your Live Trading token refreshed automatically.
- **Single-User Security Lock:** Hardened for personal use. The bot permanently locks itself to the first Telegram user who interacts with it, aggressively rejecting unauthorized access attempts from anyone else.
- **Database-Backed State:** All configurations, active tokens, and agent memories are persisted reliably in a PostgreSQL database, making it 100% cloud-deployment ready.

---

## 📚 Documentation

For complete instructions on setting up the environment, deploying to the cloud vs locally, and understanding the architecture, please read the following guides:

- [Setup & Environment Variables Guide (setup_instructions.md)](./setup_instructions.md)
- [Architecture & Internal Design (architecture_and_skills.md)](./architecture_and_skills.md)

---

## 🛠️ Technology Stack

- **Backend:** Python, FastAPI, APScheduler
- **AI Agents:** Langchain, LangGraph, DeepAgents
- **Database:** PostgreSQL (via `psycopg-pool`)
- **Broker API:** Upstox SDK
- **Interface:** Telegram Bot API (via `aiogram`)

---

## 🚀 Quick Start Guide

### 1. Prerequisites
- Python 3.10+
- A PostgreSQL database (e.g., Supabase, Neon, or local)
- A Telegram Bot Token (from [@BotFather](https://t.me/botfather))
- Upstox Developer API Credentials

### 2. Environment Setup
Clone the repository and install the dependencies:
```bash
git clone https://github.com/Anshu666666/deepTrade.git
cd deepTrade
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
pip install -r requirements.txt
```

**Next, configure your `.env` file according to the [Setup Instructions](./setup_instructions.md).**

### 3. Running the Server
```bash
python main.py
```

### 4. Initialization & Security Lock
1. Open Telegram and send `/start` to your bot.
2. **Crucial:** The moment you send your first message, DeepTrade will permanently lock itself to your Telegram Account (`chat_id`). No one else can use your bot.

---

## 🔐 Security Disclaimer

This software is for **individual use** and educational purposes only. Algorithmic trading involves significant financial risk. The AI can make mistakes, hallucinate, or execute unintended trades. 
- Always test strategies in Sandbox mode first.
- The author is not responsible for any financial losses incurred through the use of this software.

---

## 📝 License

This project is licensed under the **MIT License**. See the `LICENSE` file for details.
