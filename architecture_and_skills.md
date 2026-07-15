# [DeepTrade] - ARCHITECTURE & KNOWLEDGE SKILL FILE

## 1. System Overview & Core Value Prop
- **High-Level Purpose:** An autonomous financial research and analysis agent system that gathers real-time market data, web intelligence, and SEC filings to synthesize structured research reports and artifacts interactively.
- **Primary Tech Stack:** Python (FastAPI, Uvicorn, LangChain/LangGraph, DeepAgents), Node.js (Vite, React, TypeScript, SWC/Oxc) for the UI frontend, PostgreSQL (Supabase) with `psycopg_pool` for backend persistence, and OpenRouter for LLM inference.
- **Key Constraints/Design Philosophy:** Event-driven and highly observable. Relies heavily on Server-Sent Events (SSE) streaming to surface granular agent interactions (reasoning tokens, tool calls, and artifact emissions). Operates a multi-agent orchestrated graph (Supervisor ➔ Subagents). State is checkpointed to Postgres implicitly via LangGraph abstractions.

## 2. Directory Structure & Component Mapping
- `main.py`: Application entry point; bootstraps the FastAPI server via Uvicorn.
- `src/api/server.py`: Defines the FastAPI application, mounts CORS, handles DB lifespan initialization, and exposes the crucial SSE streaming endpoint (`/chat/stream`) and thread management APIs.
- `src/api/telegram_bot.py`: Implements the Telegram Bot integration using aiogram webhooks, mapping Telegram commands to LangGraph execution threads.
- `src/api/db.py`: Manages the global async connection pool (`psycopg_pool`) to PostgreSQL and initializes the LangGraph checkpointer (`AsyncPostgresSaver`) and store (`AsyncPostgresStore`).
- `src/api/logging_utils.py`: Provides deterministic query ID generation and configures concurrent file/stream loggers to track agent execution per request.
- `src/agent/graph.py`: Constructs the `deep_agent` multi-agent graph, wiring the Supervisor to subagents and injecting a `CompositeBackend` to route artifact storage to Postgres.
- `src/agent/nodes/market_research_agent.py`: Subagent definition responsible for fetching raw financial data, SEC filings, web content, and Upstox market data.
- `src/agent/nodes/trade_executor.py`: Subagent definition responsible for executing trades, modifying/cancelling orders, and fetching portfolio data (holdings, funds) securely via Upstox.
- `src/agent/tools.py`: Implements the external AI integrations (`search_financial_data` using Valyu and `search_web` using Exa).
- `src/agent/upstox_tools.py`: Implements the Upstox API tool wrappers (fetching orders, placing orders with Telegram confirmation, etc.).
- `src/agent/models.py`: Instantiates the OpenRouter LLM (`ChatOpenAI`) and implements a critical monkey-patch to capture proprietary reasoning tokens.
- `src/agent/config_loader.py`: Dynamically loads Markdown-based system prompts from `src/agent/config/prompts/` to feed the subagents.
- `src/ui/`: Isolated Vite+React frontend application utilizing a modern, strict TypeScript setup and Oxlint.

## 3. End-to-End Control Flow & Execution Paths
**Primary Execution Path: Interactive Research Request (`/chat/stream`)**
1. **API Ingestion:** `src/api/server.py` (`chat_stream`) receives `ChatRequest`, generates a `query_id`, and opens a streaming response returning `generate_sse_events()`.
2. **Background Execution:** `generate_sse_events` drops a `SystemMessage` and `HumanMessage` into the state and dispatches `run_graph()` to run inside an `asyncio.create_task()`.
3. **Graph Streaming:** `run_graph` iterates over `graph.astream(..., stream_mode=["messages", "updates"])`.
4. **Event Interception & Logging:** As the Supervisor and subagents emit updates, `run_graph` parses them into distinct `log_type`s (e.g., `REASONING`, `TOOL_CALL`, `ARTIFACT`).
5. **Persistence & Broadcast:** `src/api/db.py` (`insert_event`) asynchronously writes these events into the `query_events` Postgres table while simultaneously pushing the raw JSON data to the `asyncio.Queue` feeding the SSE stream.
6. **External Tooling:** If a tool call occurs, `src/agent/tools.py` hits Valyu or Exa, returning the raw text string back into the LangGraph state loop.

## 4. State Management, Data Models & Persistence
- **Data Lifecycle:** The system relies entirely on Postgres for truth. LangGraph manages the thread state implicitly via checkpoints. Transitory execution events (what tools ran, what reasoning occurred) are captured manually via `run_graph` and stored as append-only records to hydrate the UI later.
- **Key Models/Schemas:**
    - `user_threads`: Custom Postgres table tracking basic thread metadata (`thread_id`, `title`, timestamps).
    - `query_events`: Custom append-only table logging granular agent actions (`log_type`, `agent`, `content`, `event_metadata`).
- **Side Effects & Caching:** `write_file` tool calls prefixed with `/research/` are hijacked by `StoreBackend` (configured in `src/agent/graph.py`) and stored natively into the LangGraph Postgres `store` namespace. No external caching (e.g., Redis) is utilized.

## 5. Cross-Cutting Concerns
- **Authentication & Authorization:** Missing/Omitted. The API (`src/api/server.py`) has wide open CORS (`allow_origins=["*"]`) and enforces no API keys or JWT middleware on the endpoints.
- **Error Handling Strategy:** In `src/api/server.py`, the `run_graph` background task wraps graph execution in a generic `try/except`. Errors log locally and are squashed into a standardized `{"type": "error", "content": ...}` JSON block pushed down the SSE stream to prevent dropped client connections.
- **LLM Reasoning Extraction:** `src/agent/models.py` uses an active monkey-patch on `langchain_openai.chat_models.base._convert_delta_to_message_chunk` to forcefully inject OpenRouter's `reasoning` chunk stream into `message_chunk.additional_kwargs`.

## 6. Development & Operational Runbook
- **Local Bootstrapping:**
    1. Define `.env` at root with `PG_DATABASE_URL`, `VALYU_API_KEY`, `EXA_API_KEY`, `OPENROUTER_API_KEY`.
    2. Start API: `uvicorn src.api.server:app --host 0.0.0.0 --port 8000 --reload` (or `python main.py`).
    3. Start UI: `cd src/ui && npm install && npm run dev`.
- **Gotchas & Hidden Assumptions:**
    - **Silent Database Failure:** If `PG_DATABASE_URL` is missing from the environment, `src/api/db.py` intentionally swallows the failure and logs a warning. `db._pool` will remain `None`, meaning chat history and artifacts will silently fail to persist while the memory-graph continues to run.
    - **Monkey-Patch Fragility:** The application relies on patching private internal LangChain functions (`_convert_delta_to_message_chunk`). Any minor version bump in `langchain-openai` could break reasoning extraction entirely.
    - **Thread Creation Logic:** `server.py` assumes the frontend will call `POST /threads` to register a thread in `user_threads` before querying. However, `generate_sse_events` will lazily generate a UUID if a `thread_id` isn't provided, which leads to orphaned query events that aren't tied to a registered thread in the UI.

## 7. API Data Models & SSE Event Schemas

### Request Models (Pydantic)
**Chat Request (`POST /chat/stream`)**
```python
class ChatRequest(BaseModel):
    message: str                        # The user's prompt
    thread_id: Optional[str] = None     # Binds request to existing conversation state
    hidden_instruction: Optional[str] = None # System instruction pre-pended to state
```

**Thread Request (`POST /threads`)**
```python
class ThreadCreateRequest(BaseModel):
    title: str                          # Name of the conversation thread
```

### Database Schemas (Postgres)
**`user_threads`**
- `thread_id` (TEXT, PK): Unique identifier for the LangGraph thread state.
- `title` (TEXT): Display name for UI.
- `created_at` / `updated_at` (TIMESTAMP): Standard lifecycle tracking.

**`query_events`**
- `id` (SERIAL, PK)
- `thread_id` (TEXT, FK): Maps to `user_threads`.
- `query_id` (TEXT): Unique ID grouping logs of a single `/chat/stream` request.
- `log_type` (TEXT): Categorical type of the event.
- `agent` (TEXT): Which agent generated the event (e.g., `Supervisor`, `DataCollector`).
- `content` (TEXT): Stringified event payload.
- `event_metadata` (JSONB): Parsed JSON metadata (like tool args or subagent names).

### Server-Sent Events (SSE) Schemas
Events emitted to the frontend during graph execution via `POST /chat/stream`.

**1. Status Event**
```json
{"type": "status", "content": "Initializing research..."}
```

**2. Log Events (`type: "log"`)**
Various `log_type`s determine the payload shape:
- **REASONING**: Emits live LLM thinking tokens.
  `{"type": "log", "log_type": "REASONING", "agent": "Supervisor", "content": "Thinking...", "id": "msg_id"}`
- **ROUTING**: Identifies Supervisor delegating tasks.
  `{"type": "log", "log_type": "ROUTING", "agent": "Supervisor", "subagent": "DataCollector", "content": "Instructions..."}`
- **TOOL_CALL**: Agent requests to use a tool.
  `{"type": "log", "log_type": "TOOL_CALL", "agent": "DataCollector", "tool": "search_web", "content": "{\"query\": \"AAPL\"}"}`
- **TOOL_RESULT**: External API response payload.
  `{"type": "log", "log_type": "TOOL_RESULT", "agent": "DataCollector", "tool": "search_web", "content": "Raw search results..."}`
- **TASK_RESULT**: Subagent returning results to Supervisor.
  `{"type": "log", "log_type": "TASK_RESULT", "agent": "Supervisor", "tool": "task", "content": "..."}`
- **ARTIFACT**: A saved markdown document generated during research.
  `{"type": "log", "log_type": "ARTIFACT", "agent": "FinancialAnalyst", "path": "/research/report.md", "content": "Markdown body..."}`
- **RESPONSE**: Final output provided to the user.
  `{"type": "log", "log_type": "RESPONSE", "agent": "Supervisor", "content": "Final synthesis..."}`

**3. Terminal Events**
- **DONE**: Stream successfully finished.
  `{"type": "done"}`
- **ERROR**: Graph execution failed.
  `{"type": "error", "content": "Exception stack trace or message"}`

## 8. Telegram Bot Integration Architecture
- **Webhook vs Long Polling:** The system uses FastAPI and `aiogram` webhooks (exposed via `/webhook/telegram`) rather than long polling. This ensures the bot scales effectively within the existing Uvicorn server lifecycle.
- **Asynchronous Execution (`BackgroundTasks`):** Telegram requires webhooks to return a `200 OK` almost immediately. Because LangGraph research tasks can take several minutes, the webhook endpoint utilizes `FastAPI BackgroundTasks` to immediately return `200 OK` and run the graph execution asynchronously. This prevents Telegram from timing out and sending duplicate retry messages.
- **Webhook Initialization:** During server startup, `bot.set_webhook(..., drop_pending_updates=True)` is called. This explicitly clears out any stale or backlogged messages that occurred while the server was offline, preventing massive bursts of concurrent graph executions on boot.
- **Artifact Delivery & Verification:** During graph execution, `write_file` tool calls are intercepted. The file arguments are temporarily cached in memory (`pending_artifacts`), and the final `.md` document is only sent to the user as a Telegram Document (and SSE stream) *after* the corresponding `TOOL_RESULT` confirms the file was successfully written.
  - **Gotcha:** `deepagents`' `write_file` tool returns `"Updated file <path>"` upon success, NOT `"Successfully"`. The delivery logic specifically checks for `"Updated file"` to prevent missed artifact deliveries.

## 9. Upstox API Integration & Hybrid Trading Mode
- **Hybrid Mode Concept**: The bot is designed to act as a hybrid trading assistant. By default, it reads live market data and portfolio metrics (holdings, positions, funds, order book) using the `UPSTOX_LIVE_ACCESS_TOKEN`, and places/modifies/cancels real orders in the live Upstox account. When explicitly toggled into Sandbox mode (`is_sandbox_mode` ContextVar = True), it continues to read real portfolio data but safely routes any order executions to the Sandbox server (`api-sandbox.upstox.com`) using the `UPSTOX_SANDBOX_ACCESS_TOKEN`.
- **ContextVar & Thread Safety**: To support concurrent users/threads where some might be in Live mode and others in Sandbox mode, `is_sandbox_mode` is managed via Python `ContextVar`. The ContextVar is explicitly synchronized at the start of each incoming webhook/chat request in `server.py` and `telegram_bot.py`.
- **Interactive Orders & Telegram Callbacks**: Order execution actions (place, modify, cancel) are exposed as interactive tools. When an agent calls these tools, a unique `confirmation_id` and an `asyncio.Future` are generated and stored in a shared `pending_tool_futures` dictionary. The tool sends a Telegram message containing Inline Keyboard Buttons (Confirm / Cancel) and awaits the Future. 
- **Subagent Delegation**: To keep the main orchestration clean, we use a specialized `TradeExecutor` subagent. The Supervisor (`MarketResearchAgent`) uses the `task` tool to delegate explicit order execution steps to the `TradeExecutor`, which has access to the Upstox tools.
- **SDK Gotchas & Workarounds**: 
  - **Singleton Configuration Bug**: The Upstox Python SDK generated via Swagger Codegen contains a bug in its `Configuration` class that behaves similarly to a shared global singleton. Setting `sandbox=True` on subsequent instantiations fails to properly update the `order_host`. The system bypasses this bug in `src/agent/upstox_client_manager.py` by explicitly overriding both `config.host` and `config.order_host` to their correct endpoints every time an API client is constructed.
  - **Urllib3 Incompatibility**: The Upstox SDK internally uses `urllib3.get_host(url)`, which was deprecated and removed in `urllib3 >= 2.0.0`. To prevent the SDK from crashing on modern Python environments, a monkey-patch was introduced in `src/agent/upstox_tools.py` that polyfills `urllib3.get_host` using `urllib3.util.parse_url`.
