import os
import logging
from dotenv import load_dotenv
load_dotenv()
from contextlib import asynccontextmanager
from psycopg_pool import AsyncConnectionPool
from langgraph.checkpoint.postgres.aio import AsyncPostgresSaver
from langgraph.store.postgres.aio import AsyncPostgresStore

logger = logging.getLogger(__name__)

# Connection string should be provided via environment variable, e.g.:
# postgresql://postgres.[project-ref]:[password]@aws-0-us-west-1.pooler.supabase.com:6543/postgres
DB_URI = os.environ.get("PG_DATABASE_URL")

# Global variables to hold our pool, checkpointer, and store
_pool: AsyncConnectionPool = None
checkpointer: AsyncPostgresSaver = None
store: AsyncPostgresStore = None


@asynccontextmanager
async def lifespan_db(app):
    """Manage the database connection pool lifespan."""
    global _pool, checkpointer, store
    
    if not DB_URI:
        logger.warning("PG_DATABASE_URL is not set. Chat history and artifacts will NOT be persisted to Postgres.")
        yield
        return

    logger.info("Initializing Postgres connection pool...")
    _pool = AsyncConnectionPool(
        conninfo=DB_URI,
        max_size=20,
        open=False,
        kwargs={
            "autocommit": True,
            "prepare_threshold": 0,
        },
    )
    await _pool.open()
    
    # Initialize Checkpointer (for chat history) and Store (for artifacts/VFS)
    checkpointer = AsyncPostgresSaver(_pool)
    store = AsyncPostgresStore(_pool)

    # Automatically run migrations to create tables if they don't exist
    await checkpointer.setup()
    await store.setup()
    
    # We also need a custom table to track "threads" since langgraph checkpoints 
    # don't easily allow querying "give me all thread IDs".
    async with _pool.connection() as conn:
        await conn.execute("""
            CREATE TABLE IF NOT EXISTS user_threads (
                thread_id TEXT PRIMARY KEY,
                title TEXT NOT NULL,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
            );
        """)
        await conn.execute("""
            CREATE TABLE IF NOT EXISTS telegram_sessions (
                chat_id TEXT PRIMARY KEY,
                active_thread_id TEXT NOT NULL REFERENCES user_threads(thread_id) ON DELETE CASCADE,
                updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
            );
        """)
        await conn.execute("""
            CREATE TABLE IF NOT EXISTS query_events (
                id SERIAL PRIMARY KEY,
                thread_id TEXT NOT NULL REFERENCES user_threads(thread_id) ON DELETE CASCADE,
                query_id TEXT NOT NULL,
                log_type TEXT NOT NULL,
                agent TEXT NOT NULL,
                content TEXT,
                event_metadata JSONB,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
            );
        """)

        await conn.execute("""
            CREATE TABLE IF NOT EXISTS bot_settings (
                key TEXT PRIMARY KEY,
                value TEXT NOT NULL,
                updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
            );
        """)

    logger.info("Database initialized successfully.")
    
    yield
    
    logger.info("Closing Postgres connection pool...")
    await _pool.close()

async def insert_event(thread_id: str, query_id: str, log_type: str, agent: str, content: str, metadata: dict = None):
    """Insert a transient event log into the database."""
    if not _pool:
        return
    import json
    meta_json = json.dumps(metadata) if metadata else None
    try:
        async with _pool.connection() as conn:
            await conn.execute(
                "INSERT INTO query_events (thread_id, query_id, log_type, agent, content, event_metadata) VALUES (%s, %s, %s, %s, %s, %s)",
                (thread_id, query_id, log_type, agent, content, meta_json)
            )
    except Exception as e:
        logger.error(f"Failed to insert event: {e}")

import uuid

async def get_or_create_telegram_thread(chat_id: str) -> str:
    """Gets the active thread ID for a telegram chat, or creates a new one."""
    if not _pool:
        return None
    try:
        async with _pool.connection() as conn:
            async with conn.cursor() as cur:
                # Get the active thread and its last updated time
                await cur.execute("SELECT active_thread_id, updated_at FROM telegram_sessions WHERE chat_id = %s", (chat_id,))
                row = await cur.fetchone()
                
                from datetime import datetime, timezone, timedelta
                now = datetime.now(timezone.utc)
                
                if row:
                    active_thread_id = row[0]
                    updated_at = row[1]
                    
                    # If older than 30 minutes, create a new one
                    if updated_at and (now - updated_at) > timedelta(minutes=30):
                        logger.info(f"Thread for {chat_id} expired ({(now - updated_at).seconds//60} mins old). Creating new.")
                        thread_id = str(uuid.uuid4())
                        await cur.execute("INSERT INTO user_threads (thread_id, title) VALUES (%s, %s)", (thread_id, f"Telegram: {chat_id}"))
                        await cur.execute("UPDATE telegram_sessions SET active_thread_id = %s, updated_at = CURRENT_TIMESTAMP WHERE chat_id = %s", (thread_id, chat_id))
                        return thread_id
                    else:
                        # Update the timestamp to keep it alive
                        await cur.execute("UPDATE telegram_sessions SET updated_at = CURRENT_TIMESTAMP WHERE chat_id = %s", (chat_id,))
                        return active_thread_id
                
                # Create a new thread
                thread_id = str(uuid.uuid4())
                await cur.execute("INSERT INTO user_threads (thread_id, title) VALUES (%s, %s)", (thread_id, f"Telegram: {chat_id}"))
                await cur.execute("INSERT INTO telegram_sessions (chat_id, active_thread_id) VALUES (%s, %s)", (chat_id, thread_id))
                return thread_id
    except Exception as e:
        logger.error(f"Failed to get/create telegram thread: {e}")
        return None

async def get_chat_id_by_thread(thread_id: str) -> str:
    if not _pool: return None
    try:
        async with _pool.connection() as conn:
            async with conn.cursor() as cur:
                await cur.execute("SELECT chat_id FROM telegram_sessions WHERE active_thread_id = %s", (thread_id,))
                row = await cur.fetchone()
                return row[0] if row else None
    except Exception as e:
        logger.error(f"Failed to get chat_id: {e}")
        return None

async def reset_telegram_thread(chat_id: str) -> str:
    """Forces a new thread ID for a telegram chat."""
    if not _pool:
        return None
    try:
        thread_id = str(uuid.uuid4())
        async with _pool.connection() as conn:
            await conn.execute("INSERT INTO user_threads (thread_id, title) VALUES (%s, %s)", (thread_id, f"Telegram: {chat_id}"))
            await conn.execute("""
                INSERT INTO telegram_sessions (chat_id, active_thread_id) 
                VALUES (%s, %s) 
                ON CONFLICT (chat_id) DO UPDATE SET active_thread_id = EXCLUDED.active_thread_id, updated_at = CURRENT_TIMESTAMP
            """, (chat_id, thread_id))
        return thread_id
    except Exception as e:
        logger.error(f"Failed to reset telegram thread: {e}")
        return None

async def get_setting(key: str) -> str:
    """Gets a configuration setting from the database."""
    if not _pool: return None
    try:
        async with _pool.connection() as conn:
            async with conn.cursor() as cur:
                await cur.execute("SELECT value FROM bot_settings WHERE key = %s", (key,))
                row = await cur.fetchone()
                return row[0] if row else None
    except Exception as e:
        logger.error(f"Failed to get setting {key}: {e}")
        return None

async def set_setting(key: str, value: str):
    """Sets a configuration setting in the database."""
    if not _pool: return
    try:
        async with _pool.connection() as conn:
            await conn.execute("""
                INSERT INTO bot_settings (key, value) 
                VALUES (%s, %s) 
                ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = CURRENT_TIMESTAMP
            """, (key, value))
    except Exception as e:
        logger.error(f"Failed to set setting {key}: {e}")

async def get_live_token_status() -> dict:
    """Returns the live token and its validity based on updated_at (valid if updated after 3:30 AM IST today)."""
    if not _pool: return {"token": None, "is_valid": False}
    try:
        async with _pool.connection() as conn:
            async with conn.cursor() as cur:
                await cur.execute("SELECT value, updated_at FROM bot_settings WHERE key = 'UPSTOX_LIVE_ACCESS_TOKEN'")
                row = await cur.fetchone()
                if not row:
                    return {"token": None, "is_valid": False}
                
                token, updated_at = row
                
                from datetime import datetime, timezone, timedelta
                # Current time in IST
                now_ist = datetime.now(timezone.utc).astimezone(timezone(timedelta(hours=5, minutes=30)))
                
                # Today's 3:30 AM IST
                today_3_30_am = now_ist.replace(hour=3, minute=30, second=0, microsecond=0)
                if now_ist < today_3_30_am:
                    # If currently before 3:30 AM, valid token was generated after 3:30 AM yesterday
                    today_3_30_am -= timedelta(days=1)
                
                updated_at_ist = updated_at.astimezone(timezone(timedelta(hours=5, minutes=30)))
                is_valid = updated_at_ist >= today_3_30_am
                
                return {"token": token, "is_valid": is_valid}
    except Exception as e:
        logger.error(f"Failed to check token validity: {e}")
        return {"token": None, "is_valid": False}
