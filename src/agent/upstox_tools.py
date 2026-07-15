import json
import logging
import asyncio
from typing import Literal, Optional
from langchain_core.tools import tool
from langchain_core.runnables import RunnableConfig
from src.agent.instrument_resolver import resolve_symbol
from src.agent.upstox_client_manager import (
    get_order_api,
    get_market_quote_api,
    get_history_api,
    get_portfolio_api,
    get_user_api,
    get_trade_pnl_api
)
import upstox_client

import sys
logger = logging.getLogger(__name__)
_ch = logging.StreamHandler(sys.stdout)
_ch.setFormatter(logging.Formatter('%(asctime)s - %(name)s - %(levelname)s - %(message)s'))
logger.addHandler(_ch)
logger.setLevel(logging.INFO)

@tool
def upstox_get_market_data(symbol: str, data_type: Literal["LTP", "OHLC", "FULL", "HISTORICAL"] = "LTP", interval: str = "1minute") -> str:
    """
    Unified tool for fetching market data from Upstox.
    - symbol: e.g., "TCS", "RELIANCE", "HDFCBANK"
    - data_type: 
       "LTP" for just the last traded price.
       "OHLC" for Open, High, Low, Close snapshot.
       "FULL" for full market depth and quotes.
       "HISTORICAL" for historical candle data.
    - interval: Only used if data_type="HISTORICAL". Options: '1minute', '30minute', 'day', 'week', 'month'.
    """
    try:
        instrument_key = resolve_symbol(symbol)
    except Exception as e:
        return f"Error resolving symbol '{symbol}': {str(e)}"
    
    try:
        if data_type == "LTP":
            api = get_market_quote_api()
            res = api.get_ltp(instrument_key=instrument_key)
            return json.dumps(res.to_dict(), default=str)
            
        elif data_type == "OHLC":
            api = get_market_quote_api()
            # Note: OHLC interval here is commonly '1d' or 'I30' depending on API docs, usually defaults to 1d.
            res = api.get_market_quote_ohlc(instrument_key=instrument_key, interval="1d")
            return json.dumps(res.to_dict(), default=str)
            
        elif data_type == "FULL":
            api = get_market_quote_api()
            # get_full_market_quote is deprecated in current SDK, mapping to OHLC for depth
            res = api.get_market_quote_ohlc(instrument_key=instrument_key, interval="1d")
            return json.dumps(res.to_dict(), default=str)
            
        elif data_type == "HISTORICAL":
            api = get_history_api()
            import datetime
            to_date = datetime.datetime.now().strftime('%Y-%m-%d')
            # fetching last 7 days for quick preview
            from_date = (datetime.datetime.now() - datetime.timedelta(days=7)).strftime('%Y-%m-%d')
            res = api.get_historical_candle_data1(
                instrument_key=instrument_key,
                unit="day",
                interval=interval,
                to_date=to_date,
                from_date=from_date
            )
            return json.dumps(res.to_dict(), default=str)
            
        return f"Invalid data_type: {data_type}"
    except Exception as e:
        return f"Upstox API Error fetching market data: {str(e)}"


import uuid
from aiogram.types import InlineKeyboardMarkup, InlineKeyboardButton

# Global dictionary to store blocking futures: {confirmation_id: asyncio.Future}
pending_tool_futures = {}

@tool
async def upstox_place_order(symbol: str, quantity: int, transaction_type: Literal["BUY", "SELL"], order_type: str = "LIMIT", price: float = 0.0, config: RunnableConfig = None) -> str:
    """
    Generates a pending order preview and waits for user confirmation before executing.
    - order_type: Usually "LIMIT" or "MARKET". If "LIMIT", price MUST be > 0.
    """
    try:
        instrument_key = resolve_symbol(symbol)
    except Exception as e:
        return f"Error resolving symbol '{symbol}': {str(e)}"
        
    if order_type == "LIMIT" and price <= 0:
        return "Error: LIMIT orders require a valid price > 0."

    confirmation_id = str(uuid.uuid4())
    preview = {
        "transaction_type": transaction_type,
        "instrument_key": instrument_key,
        "symbol": symbol,
        "quantity": quantity,
        "order_type": order_type,
        "price": price,
        "product": "D",
        "validity": "DAY",
        "is_amo": False,
        "disclosed_quantity": 0,
        "trigger_price": 0.0
    }
    
    platform = config.get("configurable", {}).get("platform", "telegram")
    
    if platform == "telegram":
        thread_id = config.get("configurable", {}).get("thread_id")
        if not thread_id:
            return "Error: Missing thread_id in context. Cannot request confirmation."
            
        from src.api.db import get_chat_id_by_thread
        chat_id = await get_chat_id_by_thread(thread_id)
        if not chat_id:
            return "Error: Could not find Telegram chat ID for this thread."

        from src.api.telegram_bot import bot
        keyboard = InlineKeyboardMarkup(inline_keyboard=[
            [
                InlineKeyboardButton(text="✅ Confirm", callback_data=f"confirm_{confirmation_id}"),
                InlineKeyboardButton(text="❌ Cancel", callback_data=f"cancel_{confirmation_id}")
            ]
        ])
        price_display = "Market Price" if order_type == "MARKET" else str(price)
        msg_text = (
            "⚠️ **Action Required: Confirm Order**\n\n"
            f"**Symbol:** {symbol}\n"
            f"**Action:** {transaction_type}\n"
            f"**Qty:** {quantity}\n"
            f"**Type:** {order_type}\n"
            f"**Price:** {price_display}\n\n"
            "Please confirm within 5 minutes."
        )
        
        try:
            await bot.send_message(chat_id=chat_id, text=msg_text, reply_markup=keyboard, parse_mode="Markdown")
        except Exception as e:
            logger.error(f"Failed to send confirmation message: {e}")
            return f"Error: Failed to request confirmation from user: {str(e)}"
    
    elif platform == "web":
        # For the Web UI, emit an event directly into the SSE queue
        sse_queue = config.get("configurable", {}).get("sse_queue")
        if not sse_queue:
            return "Error: SSE Queue not found in context. Cannot request confirmation."
        
        event_data = {
            "type": "log",
            "log_type": "ORDER_CONFIRMATION",
            "content": {
                "action": "CONFIRM_ORDER",
                "confirmation_id": confirmation_id,
                "preview": preview
            }
        }
        await sse_queue.put(f"data: {json.dumps(event_data)}\n\n")
        
    # Block and wait for user response
    loop = asyncio.get_running_loop()
    future = loop.create_future()
    pending_tool_futures[confirmation_id] = future
    logger.info(f"Registered pending order confirmation_id={confirmation_id}. Total pending: {list(pending_tool_futures.keys())}")
    
    try:
        # Wait up to 5 minutes (300 seconds)
        result = await asyncio.wait_for(future, timeout=300.0)
    except asyncio.TimeoutError:
        pending_tool_futures.pop(confirmation_id, None)
        logger.info(f"Timed out waiting for confirmation_id={confirmation_id}. Removed from pending.")
        return "Timeout: User did not respond within 5 mins. Order was NOT placed."
        
    pending_tool_futures.pop(confirmation_id, None)
    logger.info(f"Received response '{result}' for confirmation_id={confirmation_id}. Removed from pending.")
        
    if result == "cancel":
        return "User cancelled the order."
        
    if result == "confirm":
        # Execute the trade
        try:
            api = get_order_api()
            body = upstox_client.PlaceOrderV3Request(
                quantity=preview["quantity"],
                product=preview["product"],
                validity=preview["validity"],
                price=preview["price"],
                instrument_token=preview["instrument_key"],
                order_type=preview["order_type"],
                transaction_type=preview["transaction_type"],
                disclosed_quantity=preview["disclosed_quantity"],
                trigger_price=preview["trigger_price"],
                is_amo=preview["is_amo"]
            )
            res = api.place_order(body)
            return f"Order successful! Upstox Response: {json.dumps(res.to_dict(), default=str)}"
        except Exception as e:
            return f"Order execution failed: {str(e)}"


@tool
def upstox_execute_confirmed_order(confirmation_id: str, preview_json: str) -> str:
    """
    Actually executes an order that has been confirmed by the user. 
    This tool should only be invoked automatically by the Telegram callback query or Web UI, NOT directly by the LLM.
    """
    try:
        data = json.loads(preview_json)
        preview = data["preview"]
        api = get_order_api()
        
        action = preview.get("action", "PLACE_ORDER")
        if action == "MODIFY_ORDER":
            body = upstox_client.ModifyOrderRequest(
                order_id=preview["order_id"],
                quantity=preview["quantity"],
                validity="DAY",
                price=preview["price"],
                order_type=preview["order_type"],
                disclosed_quantity=0,
                trigger_price=0.0
            )
            res = api.modify_order(body)
        elif action == "CANCEL_ORDER":
            res = api.cancel_order(order_id=preview["order_id"])
        else:
            body = upstox_client.PlaceOrderV3Request(
                quantity=preview["quantity"],
                product=preview["product"],
                validity=preview["validity"],
                price=preview["price"],
                instrument_token=preview["instrument_key"],
                order_type=preview["order_type"],
                transaction_type=preview["transaction_type"],
                disclosed_quantity=preview["disclosed_quantity"],
                trigger_price=preview["trigger_price"],
                is_amo=preview["is_amo"]
            )
            res = api.place_order(body)
            
        return json.dumps(res.to_dict(), default=str)
    except Exception as e:
        return f"Order execution failed: {str(e)}"

@tool
async def upstox_modify_order(order_id: str, quantity: int, order_type: str = "LIMIT", price: float = 0.0, config: RunnableConfig = None) -> str:
    """Generates a pending modification preview and waits for user confirmation."""
    confirmation_id = str(uuid.uuid4())
    preview = {
        "action": "MODIFY_ORDER",
        "order_id": order_id,
        "quantity": quantity,
        "order_type": order_type,
        "price": price,
        # Display fields for UI
        "symbol": "Modify Order",
        "transaction_type": "MODIFY",
    }
    
    platform = config.get("configurable", {}).get("platform", "telegram")
    if platform == "telegram":
        thread_id = config.get("configurable", {}).get("thread_id")
        from src.api.db import get_chat_id_by_thread
        chat_id = await get_chat_id_by_thread(thread_id) if thread_id else None
        if chat_id:
            from src.api.telegram_bot import bot
            keyboard = InlineKeyboardMarkup(inline_keyboard=[[InlineKeyboardButton(text="✅ Confirm", callback_data=f"confirm_{confirmation_id}"), InlineKeyboardButton(text="❌ Cancel", callback_data=f"cancel_{confirmation_id}")]])
            msg_text = f"⚠️ **Confirm Modification**\n\n**Order ID:** {order_id}\n**Qty:** {quantity}\n**Price:** {price}\n\nPlease confirm within 5 mins."
            try: await bot.send_message(chat_id=chat_id, text=msg_text, reply_markup=keyboard, parse_mode="Markdown")
            except: pass
    elif platform == "web":
        sse_queue = config.get("configurable", {}).get("sse_queue")
        if sse_queue:
            event_data = {"type": "log", "log_type": "ORDER_CONFIRMATION", "content": {"action": "CONFIRM_ORDER", "confirmation_id": confirmation_id, "preview": preview}}
            await sse_queue.put(f"data: {json.dumps(event_data)}\n\n")
            
    loop = asyncio.get_running_loop()
    future = loop.create_future()
    pending_tool_futures[confirmation_id] = future
    logger.info(f"Registered pending modify confirmation_id={confirmation_id}. Total pending: {list(pending_tool_futures.keys())}")
    try:
        result = await asyncio.wait_for(future, timeout=300.0)
    except asyncio.TimeoutError:
        pending_tool_futures.pop(confirmation_id, None)
        logger.info(f"Timed out waiting for modify confirmation_id={confirmation_id}. Removed from pending.")
        return "Timeout: User did not respond."
        
    pending_tool_futures.pop(confirmation_id, None)
    logger.info(f"Received response '{result}' for modify confirmation_id={confirmation_id}. Removed from pending.")
    if result == "cancel": return "User cancelled."
    return await upstox_execute_confirmed_order.ainvoke({"confirmation_id": confirmation_id, "preview_json": json.dumps({"preview": preview})})

@tool
async def upstox_cancel_order(order_id: str, config: RunnableConfig = None) -> str:
    """Generates a pending cancellation preview and waits for user confirmation."""
    confirmation_id = str(uuid.uuid4())
    preview = {
        "action": "CANCEL_ORDER",
        "order_id": order_id,
        "quantity": 0, "order_type": "CANCEL", "price": 0,
        "symbol": "Cancel Order", "transaction_type": "CANCEL",
    }
    
    platform = config.get("configurable", {}).get("platform", "telegram")
    if platform == "telegram":
        thread_id = config.get("configurable", {}).get("thread_id")
        from src.api.db import get_chat_id_by_thread
        chat_id = await get_chat_id_by_thread(thread_id) if thread_id else None
        if chat_id:
            from src.api.telegram_bot import bot
            keyboard = InlineKeyboardMarkup(inline_keyboard=[[InlineKeyboardButton(text="✅ Confirm", callback_data=f"confirm_{confirmation_id}"), InlineKeyboardButton(text="❌ Cancel", callback_data=f"cancel_{confirmation_id}")]])
            msg_text = f"⚠️ **Confirm Cancellation**\n\n**Order ID:** {order_id}\n\nPlease confirm within 5 mins."
            try: await bot.send_message(chat_id=chat_id, text=msg_text, reply_markup=keyboard, parse_mode="Markdown")
            except: pass
    elif platform == "web":
        sse_queue = config.get("configurable", {}).get("sse_queue")
        if sse_queue:
            event_data = {"type": "log", "log_type": "ORDER_CONFIRMATION", "content": {"action": "CONFIRM_ORDER", "confirmation_id": confirmation_id, "preview": preview}}
            await sse_queue.put(f"data: {json.dumps(event_data)}\n\n")
            
    loop = asyncio.get_running_loop()
    future = loop.create_future()
    pending_tool_futures[confirmation_id] = future
    logger.info(f"Registered pending cancel confirmation_id={confirmation_id}. Total pending: {list(pending_tool_futures.keys())}")
    try:
        result = await asyncio.wait_for(future, timeout=300.0)
    except asyncio.TimeoutError:
        pending_tool_futures.pop(confirmation_id, None)
        logger.info(f"Timed out waiting for cancel confirmation_id={confirmation_id}. Removed from pending.")
        return "Timeout: User did not respond."
        
    pending_tool_futures.pop(confirmation_id, None)
    logger.info(f"Received response '{result}' for cancel confirmation_id={confirmation_id}. Removed from pending.")
    if result == "cancel": return "User cancelled."
    return await upstox_execute_confirmed_order.ainvoke({"confirmation_id": confirmation_id, "preview_json": json.dumps({"preview": preview})})



@tool
def upstox_get_order_book() -> str:
    """Retrieves the list of today's orders."""
    try:
        from src.agent.upstox_client_manager import get_live_trading_client
        import upstox_client
        api = upstox_client.OrderApi(get_live_trading_client()) # Order book is v2
        res = api.get_order_book(api_version="2.0")
        return json.dumps(res.to_dict(), default=str)
    except Exception as e:
        return f"Error fetching order book: {str(e)}"


@tool
def upstox_get_holdings() -> str:
    """Retrieves current holdings in the Upstox portfolio."""
    try:
        api = get_portfolio_api()
        res = api.get_holdings(api_version="2.0")
        return json.dumps(res.to_dict(), default=str)
    except Exception as e:
        return f"Error fetching holdings: {str(e)}"


@tool
def upstox_get_positions() -> str:
    """Retrieves open positions in the Upstox portfolio."""
    try:
        api = get_portfolio_api()
        res = api.get_positions(api_version="2.0")
        return json.dumps(res.to_dict(), default=str)
    except Exception as e:
        return f"Error fetching positions: {str(e)}"


@tool
def upstox_get_funds() -> str:
    """Retrieves available funds and margins."""
    try:
        api = get_user_api()
        # get_user_fund_margin_v3 takes no api_version arg
        res = api.get_user_fund_margin_v3()
        return json.dumps(res.to_dict(), default=str)
    except Exception as e:
        return f"Error fetching funds: {str(e)}"
