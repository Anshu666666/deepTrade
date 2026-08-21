# Upstox Integration & Trading Skill Reference

```mermaid
flowchart TB
    subgraph AgentEngine["DeepTrade Agent (Supervisor)"]
        AGENT["🧠 Supervisor DeepAgent<br/>(Equipped with All Tools)"]
        SKILL["📁 Progressive Upstox Skill<br/>(/skills/upstox/SKILL.md)"]
        AGENT <--> SKILL
    end

    subgraph ToolSuite["Upstox Tool Suite (src/agent/upstox_tools.py)"]
        TOOL_QUOTE["upstox_get_market_data<br/>(LTP / OHLC / FULL)"]
        TOOL_ORDER["upstox_place_order<br/>upstox_modify_order<br/>upstox_cancel_order"]
        TOOL_PORTFOLIO["upstox_get_holdings<br/>upstox_get_positions<br/>upstox_get_funds<br/>upstox_get_order_book"]
    end

    subgraph ExecutionModes["Execution Routing by Mode (is_sandbox_mode)"]
        LIVE_PATH["🏦 Live Mode: Upstox API v3<br/>(Real Capital & Broker Positions)"]
        SANDBOX_PATH["🧪 Sandbox Mode: Mock Virtual Ledger<br/>(sandbox_db.json • ₹10,00,000 Fund)"]
    end

    AGENT --> TOOL_QUOTE
    AGENT --> TOOL_ORDER
    AGENT --> TOOL_PORTFOLIO

    TOOL_ORDER -->|Live Mode + User Confirmed| LIVE_PATH
    TOOL_ORDER -->|Sandbox Mode + User Confirmed| SANDBOX_PATH
    TOOL_PORTFOLIO -->|Live Mode| LIVE_PATH
    TOOL_PORTFOLIO -->|Sandbox Mode| SANDBOX_PATH
```

---

## 1. DeepAgent & Skills Architecture

DeepTrade uses a **Single DeepAgent Architecture** (`Supervisor`) powered by DeepAgents and LangGraph.

- **Unified Tool Access**: The Supervisor has direct access to all search and trading tools.
- **Progressive Skill Loading**: The agent dynamically references `/skills/upstox/SKILL.md` to load critical rules regarding instrument key resolution, risk constraints, and interactive confirmation workflows.
- **Safety Enforcement**: The agent never executes live orders blindly. It initiates the pending order state and waits for human confirmation via Telegram inline buttons.

---

## 2. Upstox Tools Reference

All trading tools are defined in `src/agent/upstox_tools.py`:

### 1. `upstox_get_market_data`
- **Description**: Fetches real-time and historical quotes for a given instrument.
- **Parameters**:
  - `symbol` (str): Instrument ticker (e.g., `"TCS"`, `"RELIANCE"`, `"PCJEWELLER"`). Automatically resolved to Upstox key.
  - `data_type` (str):
    - `"LTP"`: Latest Traded Price.
    - `"OHLC"`: Open, High, Low, Close daily snapshot.
    - `"FULL"`: Full market depth and quote.
    - `"HISTORICAL"`: Past candlestick data.
  - `interval` (str, optional): Historical timeframe (e.g., `"1minute"`, `"day"`).

### 2. `upstox_place_order`
- **Description**: Prepares an order and generates an interactive confirmation prompt. Calling this tool automatically presents `[✅ Confirm]` and `[❌ Cancel]` buttons to the user.
- **Parameters**:
  - `symbol` (str): Instrument symbol.
  - `quantity` (int): Number of shares.
  - `transaction_type` (str): `"BUY"` or `"SELL"`.
  - `order_type` (str): `"MARKET"`, `"LIMIT"`, `"SL"`, `"SL-M"`.
  - `price` (float): Order limit price.

### 3. `upstox_modify_order`
- **Description**: Prepares an order modification and requests confirmation.
- **Parameters**:
  - `order_id` (str): Existing open order ID.
  - `quantity` (int): New quantity.
  - `price` (float): New price.
  - `order_type` (str): New order type.

### 4. `upstox_cancel_order`
- **Description**: Prepares an order cancellation and requests confirmation.
- **Parameters**:
  - `order_id` (str): Existing open order ID.

### 5. Portfolio Tools
- **`upstox_get_order_book`**: Fetches the user's list of all orders for today.
- **`upstox_get_holdings`**: Fetches long-term equity holdings.
- **`upstox_get_positions`**: Fetches current intraday and open F&O positions.
- **`upstox_get_funds`**: Fetches available cash balance, margin, and utilized collateral.

---

## 3. Two-Step Interactive Order Execution Lifecycle

```mermaid
sequenceDiagram
    autonumber
    participant Agent as 🧠 DeepTrade Agent
    participant Tool as ⚡ upstox_place_order
    participant TG as 📱 Telegram Bot
    actor Trader as 👤 User
    participant Upstox as 🏦 Upstox v3 API

    Agent->>Tool: Call upstox_place_order(symbol="TCS", qty=1, price=3850)
    Tool->>Tool: Create UUID confirmation_id & asyncio.Future
    Tool->>TG: Send Inline Keyboard: [✅ Confirm] [❌ Cancel]
    Tool->>Tool: await asyncio.wait_for(future, timeout=300)
    
    alt User clicks [✅ Confirm]
        Trader->>TG: Clicks [✅ Confirm]
        TG->>Tool: CallbackQuery -> future.set_result("confirm")
        Tool->>Upstox: PlaceOrderV3Request(...)
        Upstox-->>Tool: 200 OK (order_id: 2608210099)
        Tool-->>Agent: "Order successful! Upstox Response: ..."
        Agent-->>Trader: "Order placed successfully for 1 share of TCS at ₹3850."
    else User clicks [❌ Cancel]
        Trader->>TG: Clicks [❌ Cancel]
        TG->>Tool: CallbackQuery -> future.set_result("cancel")
        Tool-->>Agent: "User cancelled the order."
        Agent-->>Trader: "Order was cancelled as requested."
    end
```

---

## 4. Hybrid Live vs Sandbox Mode (Mock State Manager)

```mermaid
graph TD
    UserQuery["User Portfolio / Order Request"] --> ModeCheck{Session Mode?}
    
    ModeCheck -- Live Mode --> LiveBroker["🏦 Upstox Live Trading API<br/>(Real Broker Account)"]
    
    ModeCheck -- Sandbox Mode --> MockRegistry["🧪 DeepTrade Mock State Manager<br/>(src/agent/sandbox_registry.py)"]
    MockRegistry --> VirtualFunds["💰 ₹1,000,000 Virtual Cash Ledger"]
    MockRegistry --> VirtualPositions["📊 Simulated Positions (sandbox_db.json)"]
    MockRegistry --> VirtualOrderBook["📑 Simulated Order History"]
    MockRegistry -.->|Fetches Real Prices| RealLTP["📈 Live Upstox Market LTP"]
```

### Why DeepTrade Implements a Custom Sandbox Registry:
The official Upstox Sandbox API only supports order placement and modification—it lacks endpoints for checking simulated funds, positions, and order history.

DeepTrade overcomes this limitation with `src/agent/sandbox_registry.py`:
1. **Real Market Pricing in Sandbox**: Uses the real `UPSTOX_ANALYTICS_TOKEN` to pull actual live prices for paper trades.
2. **Virtual Capital Ledger**: Initializes with ₹1,000,000 virtual balance. Simulated BUY/SELL orders update virtual cash and positions in `sandbox_db.json`.
3. **Isolated Portfolio Views**: Querying `/sandbox` holdings or positions reflects your paper trading ledger without touching real money.

---

## 5. Supported Telegram Commands

| Command | Description |
| :--- | :--- |
| `/start` or `/help` | Shows welcome message, bot status, and command list. |
| `/new` | Clears conversation state and memory checkpoint in PostgreSQL. |
| `/sandbox` | Switches the user session into Sandbox Mode (simulated paper trading). |
| `/live` | Switches the user session into Live Mode (real money orders). |
| `/analyse <ticker>` | Initiates comprehensive technical & fundamental equity research. |
| `/news <topic>` | Fetches and summarizes latest news and catalysts for a ticker/topic. |
| `/deepdive <topic>` | Conducts an exhaustive multi-agent research report. |
