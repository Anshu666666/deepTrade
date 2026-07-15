import asyncio
import os
import json
from dotenv import load_dotenv

# Load env variables for keys
load_dotenv(override=True)

# We need the db pool to be active for anything that might need it (though our mock platform bypasses DB)
from src.agent.upstox_tools import (
    upstox_get_market_data,
    upstox_place_order,
    upstox_modify_order,
    upstox_cancel_order,
    upstox_get_order_book,
    upstox_get_holdings,
    upstox_get_positions,
    upstox_get_funds,
    pending_tool_futures
)

async def auto_confirm():
    """Background task to automatically confirm any pending orders."""
    while True:
        await asyncio.sleep(1)
        for conf_id, future in list(pending_tool_futures.items()):
            if not future.done():
                print(f"Auto-confirming order {conf_id}...")
                future.set_result("confirm")

async def test_tools():
    print("--- Starting Tool Tests ---")
    
    # 1. Market Data
    print("\n1. Testing upstox_get_market_data (LTP TCS)...")
    try:
        res = upstox_get_market_data.invoke({"symbol": "TCS", "data_type": "LTP"})
        print("Result:", res[:200] + "...")
    except Exception as e:
        print("Error:", e)
        
    # 2. Get Holdings
    print("\n2. Testing upstox_get_holdings...")
    try:
        res = upstox_get_holdings.invoke({})
        print("Result:", res[:200] + "...")
    except Exception as e:
        print("Error:", e)
        
    # 3. Get Positions
    print("\n3. Testing upstox_get_positions...")
    try:
        res = upstox_get_positions.invoke({})
        print("Result:", res[:200] + "...")
    except Exception as e:
        print("Error:", e)
        
    # 4. Get Funds
    print("\n4. Testing upstox_get_funds...")
    try:
        res = upstox_get_funds.invoke({})
        print("Result:", res[:200] + "...")
    except Exception as e:
        print("Error:", e)
        
    # 5. Place Order (Interactive)
    print("\n5. Testing upstox_place_order (Interactive)...")
    config = {"configurable": {"platform": "mock_test"}} # Mock platform will not wait for Telegram or SSE
    try:
        res = await upstox_place_order.ainvoke({
            "symbol": "TCS",
            "quantity": 1,
            "transaction_type": "BUY",
            "order_type": "MARKET"
        }, config=config)
        print("Result:", res[:300])
        # We need the order_id from the response to test modify/cancel
        order_id = "test_order_id"
        if "Order successful" in res:
            try:
                data = json.loads(res.split("Upstox Response: ")[1])
                order_id = data.get("data", {}).get("order_id", "test_order_id")
            except:
                pass
    except Exception as e:
        print("Error:", e)
        order_id = "test_order_id"

    # 6. Modify Order (Interactive)
    print(f"\n6. Testing upstox_modify_order (Interactive) with order_id={order_id}...")
    try:
        res = await upstox_modify_order.ainvoke({
            "order_id": order_id,
            "quantity": 2,
            "order_type": "MARKET"
        }, config=config)
        print("Result:", res[:300])
    except Exception as e:
        print("Error:", e)
        
    # 7. Cancel Order (Interactive)
    print(f"\n7. Testing upstox_cancel_order (Interactive) with order_id={order_id}...")
    try:
        res = await upstox_cancel_order.ainvoke({
            "order_id": order_id
        }, config=config)
        print("Result:", res[:300])
    except Exception as e:
        print("Error:", e)
        
    # 8. Order Book
    print("\n8. Testing upstox_get_order_book...")
    try:
        res = upstox_get_order_book.invoke({})
        print("Result:", res[:200] + "...")
    except Exception as e:
        print("Error:", e)

async def main():
    import src.agent.upstox_client_manager as mgr
    # Force sandbox mode for the test
    mgr.is_sandbox_mode.set(True)
    
    confirmer = asyncio.create_task(auto_confirm())
    await test_tools()
    confirmer.cancel()

if __name__ == "__main__":
    asyncio.run(main())
