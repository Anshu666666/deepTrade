---
name: "upstox"
description: "Guidelines and best practices for interacting with the Upstox API for market data and order execution."
allowed-tools: "upstox_get_market_data,upstox_place_order,upstox_modify_order,upstox_cancel_order,upstox_get_order_book,upstox_get_holdings,upstox_get_positions,upstox_get_funds"
---

# Upstox Trading Skill

You are equipped with custom LangChain tools to interact with the Upstox API. 

## Market Data
- Use `upstox_get_market_data` for all market data queries. 
- You can pass plain symbols like `"TCS"` or `"RELIANCE"`. The system will automatically resolve them to Upstox instrument keys (e.g., `NSE_EQ|INE467B01029`).
- Use `data_type="LTP"` for current price.
- Use `data_type="OHLC"` for daily snapshot.
- Use `data_type="HISTORICAL"` for past candles (specify interval like '1minute', 'day').

## Order Execution Safety
**CRITICAL RULE:** As an AI assistant, you **cannot** execute orders automatically without user consent.
1. When a user asks you to place, modify, or cancel an order, you must call the relevant tool (e.g., `upstox_place_order`).
2. These tools DO NOT execute the trade immediately. They will automatically send a **pending confirmation prompt** to the user's Telegram/Web UI and **block your execution** until the user responds.
3. When you call the tool, you just wait. Once the user clicks Confirm or Cancel, the tool will return the final result (e.g. "Order successful!" or "User cancelled.") back to you.
4. **DO NOT** attempt to call `upstox_execute_confirmed_order` yourself.

## Example Flow
**User:** "Buy 10 shares of TCS at 3400 limit."
**Agent:** 
1. Calls `upstox_place_order(symbol="TCS", quantity=10, transaction_type="BUY", order_type="LIMIT", price=3400.0)`.
2. *(Tool blocks while user is prompted in UI)*
3. Receives result: "Order successful! Upstox Response: ..."
4. Responds to the user: "I have successfully placed your order to buy 10 shares of TCS at ₹3400."
