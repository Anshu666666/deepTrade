# Upstox Integration Documentation

This document outlines the Upstox API tools and subagents implemented in the DeepTrade multi-agent architecture.

## Multi-Agent Architecture

The system uses a hierarchical Supervisor-Subagent architecture defined in `src/agent/graph.py`.

### `Supervisor`
- **Purpose**: The main orchestration agent that interacts directly with the user. It receives the user's queries, determines the intent, and directly executes tools to fulfill the request.
- **Workflow**: If a user asks for stock research, it uses research tools. If the user asks to buy a stock or check their portfolio, it uses Upstox execution tools.
- **Safety**: Execution logic handles pending/confirmation cycles securely by halting the graph and awaiting user input via Telegram or the Web UI.

---

## Upstox Tools

All Upstox tools are defined in `src/agent/upstox_tools.py` and are provided to the respective agents.

### 1. `upstox_get_market_data`
- **Description**: Fetches market data for a given instrument.
- **Parameters**:
  - `symbol` (str): The symbol of the instrument (e.g., `"TCS"`, `"RELIANCE"`). The system automatically resolves this to the Upstox instrument key format.
  - `data_type` (str): The type of data to fetch. Options are:
    - `"LTP"`: Latest Traded Price.
    - `"OHLC"`: Daily Open, High, Low, Close snapshot.
    - `"FULL"`: Full market quote.
    - `"HISTORICAL"`: Past candle data.
  - `interval` (str, optional): The time interval for historical data (e.g., `"1minute"`, `"day"`). Required if `data_type` is `"HISTORICAL"`.

### 2. `upstox_place_order`
- **Description**: Prepares an order and prompts the user for confirmation via the UI (Telegram or Web). It does **not** immediately place the order.
- **Parameters**:
  - `symbol` (str): Instrument symbol.
  - `quantity` (int): Number of shares.
  - `transaction_type` (str): `"BUY"` or `"SELL"`.
  - `order_type` (str): `"MARKET"`, `"LIMIT"`, `"SL"`, `"SL-M"`.
  - `price` (float): Required if `order_type` is `"LIMIT"` or `"SL"`.

### 3. `upstox_modify_order`
- **Description**: Prepares an order modification and prompts the user for confirmation.
- **Parameters**:
  - `order_id` (str): The existing order ID to modify.
  - `quantity` (int): New quantity.
  - `price` (float): New price.
  - `order_type` (str): New order type.

### 4. `upstox_cancel_order`
- **Description**: Prepares an order cancellation and prompts the user for confirmation.
- **Parameters**:
  - `order_id` (str): The existing order ID to cancel.

### 5. Portfolio Tools
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

---

## Telegram Bot Interface & Available Commands

The system provides a Telegram Bot interface (`src/api/telegram_bot.py`) that differs significantly from the Web UI:
- **Admin Restriction**: The bot restricts access using the `ADMIN_CHAT_ID` mechanism. It locks to the first user if undefined, providing personalized security.
- **Quiet Execution**: The Telegram Bot uses FastAPI `BackgroundTasks` to execute the agent graph quietly, suppressing intermediate reasoning logs and raw tool calls to provide a cleaner chat experience, whereas the Web UI streams all granular reasoning steps via Server-Sent Events (SSE).
- **Interactive Confirmations**: Trades are confirmed via Telegram Inline Keyboard Buttons (Callback Queries) natively in the chat UI.
- **No Direct Login Command**: Note that there is no native `/login` command inside the Telegram bot. To retrieve your login token, you must execute the script `generate_live_token.py` on the server terminal and authorize via browser.

### Supported Telegram Commands
- `/start` or `/help` - Shows the welcome message and lists available commands.
- `/new` - Clears the current thread context and database memory, starting a fresh conversation.
- `/sandbox` - Switches the user session into Sandbox Mode (simulated orders).
- `/live` - Switches the user session into Live Mode (real money orders).
- `/analyse <ticker>` - Initiates a comprehensive financial analysis on a specific stock.
- `/news <topic>` - Fetches and summarizes the latest news for a given ticker or topic.
- `/deepdive <topic>` - Conducts an in-depth research report.

---

## Sandbox vs Live Mode (Upstox SDK Limitations)

The Upstox Developer API (SDK) does not provide a 1:1 mirror of a real account in its Sandbox environment. 

### Natively Supported by Sandbox API
The Upstox Sandbox API **only** supports order execution functions:
- Placing Orders (`PlaceOrderV3Request`)
- Modifying Orders (`ModifyOrderRequest`)
- Cancelling Orders

### Missing Sandbox Functionality (Simulated by DeepTrade)
The Upstox Sandbox lacks dedicated endpoints for portfolio management, funds, and market data. To tackle this, DeepTrade implements a **Hybrid Sandbox Simulation** (`src/agent/upstox_client_manager.py`):

1. **Market Data (`MarketQuoteV3Api`, `HistoryV3Api`)**: 
   - Sandbox lacks market data support. DeepTrade hardcodes these requests to always use the real `UPSTOX_ANALYTICS_TOKEN` so the bot can research real-time prices even while paper trading.
2. **Holdings & Positions (`PortfolioApi`)**:
   - Sandbox has no isolated paper portfolio. The `get_portfolio_api()` function is hardcoded to use the LIVE API client. When in sandbox mode, you will see your *real* holdings and open positions.
3. **Funds (`UserApi`)**:
   - Sandbox does not simulate an isolated paper-money balance. `get_user_api()` fetches your actual real-world fund balance.
4. **Order Book (`OrderApi`)**:
   - Because the bot fetches the global order book (`upstox_get_order_book`) from the Live API, any simulated sandbox orders will *not* appear in the order book query results. 

**Summary:** When switching to `/sandbox`, the bot continues to read real-world data (real prices, real portfolio, real funds), but selectively routes all write actions (Buy/Sell/Cancel) to the simulated Sandbox API.
