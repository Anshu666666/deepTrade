# Upstox Integration Documentation

This document outlines the Upstox API tools and subagents implemented in the DeepTrade multi-agent architecture.

## Multi-Agent Architecture

The system uses a hierarchical Supervisor-Subagent architecture defined in `src/agent/graph.py`.

### `Supervisor`
- **Purpose**: The main orchestration agent that interacts directly with the user. It receives the user's queries, determines the intent, and delegates tasks to the appropriate specialized subagents using the `task` tool.
- **Workflow**: If a user asks for stock research, it delegates to `MarketResearchAgent`. If the user asks to buy a stock or check their portfolio, it delegates to `TradeExecutor`.

### Subagent 1: `MarketResearchAgent`
- **Purpose**: Expert in web research, SEC filings, financial data collection, and fetching Upstox market data.
- **Tools**: `search_web`, `search_financial_data`, `upstox_get_market_data`

### Subagent 2: `TradeExecutor`
- **Purpose**: A specialized subagent tasked with safely executing order operations (place, modify, cancel) and retrieving Upstox portfolio data (holdings, funds, order book).
- **Safety**: By delegating to this subagent, we isolate execution logic, ensuring all orders are routed properly and the state graph handles the pending/confirmation cycle securely.
- **Tools**: `upstox_place_order`, `upstox_modify_order`, `upstox_cancel_order`, `upstox_get_order_book`, `upstox_get_holdings`, `upstox_get_positions`, `upstox_get_funds`

---

## Upstox Tools

All Upstox tools are defined in `src/agent/upstox_tools.py` and are provided to the respective agents.

### 1. `upstox_get_market_data` (Used by MarketResearchAgent)
- **Description**: Fetches market data for a given instrument.
- **Parameters**:
  - `symbol` (str): The symbol of the instrument (e.g., `"TCS"`, `"RELIANCE"`). The system automatically resolves this to the Upstox instrument key format.
  - `data_type` (str): The type of data to fetch. Options are:
    - `"LTP"`: Latest Traded Price.
    - `"OHLC"`: Daily Open, High, Low, Close snapshot.
    - `"FULL"`: Full market quote.
    - `"HISTORICAL"`: Past candle data.
  - `interval` (str, optional): The time interval for historical data (e.g., `"1minute"`, `"day"`). Required if `data_type` is `"HISTORICAL"`.

### 2. `upstox_place_order` (Used by TradeExecutor)
- **Description**: Prepares an order and prompts the user for confirmation via the UI (Telegram or Web). It does **not** immediately place the order.
- **Parameters**:
  - `symbol` (str): Instrument symbol.
  - `quantity` (int): Number of shares.
  - `transaction_type` (str): `"BUY"` or `"SELL"`.
  - `order_type` (str): `"MARKET"`, `"LIMIT"`, `"SL"`, `"SL-M"`.
  - `price` (float): Required if `order_type` is `"LIMIT"` or `"SL"`.

### 3. `upstox_modify_order` (Used by TradeExecutor)
- **Description**: Prepares an order modification and prompts the user for confirmation.
- **Parameters**:
  - `order_id` (str): The existing order ID to modify.
  - `quantity` (int): New quantity.
  - `price` (float): New price.
  - `order_type` (str): New order type.

### 4. `upstox_cancel_order` (Used by TradeExecutor)
- **Description**: Prepares an order cancellation and prompts the user for confirmation.
- **Parameters**:
  - `order_id` (str): The existing order ID to cancel.

### 5. Portfolio Tools (Used by TradeExecutor)
- **`upstox_get_order_book`**: Fetches the user's list of all orders for the day.
- **`upstox_get_holdings`**: Fetches the user's current long-term holdings.
- **`upstox_get_positions`**: Fetches the user's current intraday/open positions.
- **`upstox_get_funds`**: Fetches the user's available funds and margins.

---

## Execution Flow & User Confirmation
To prevent the AI from executing unauthorized trades, when `upstox_place_order`, `upstox_modify_order`, or `upstox_cancel_order` are invoked:
1. A unique `confirmation_id` is generated.
2. An `asyncio.Future` object is registered in `pending_tool_futures`.
3. An interactive Telegram message with **Confirm/Cancel** inline buttons is sent to the admin.
4. The tool execution is suspended (using `await future`), putting the subagent to "sleep" for up to 5 minutes.
5. Once the user clicks the inline button in Telegram, the Telegram bot resolves the Future.
6. The tool resumes, executing the actual Upstox SDK call if confirmed, and returning the API response (success or failure) to the agent.
