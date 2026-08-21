import json
import os
import datetime

SANDBOX_DB_PATH = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "sandbox_db.json")

def load_sandbox_db():
    if os.path.exists(SANDBOX_DB_PATH):
        try:
            with open(SANDBOX_DB_PATH, "r") as f:
                return json.load(f)
        except Exception:
            pass
    return {}

def save_sandbox_db(db):
    with open(SANDBOX_DB_PATH, "w") as f:
        json.dump(db, f, indent=4)

def get_thread_state(thread_id: str):
    db = load_sandbox_db()
    if thread_id not in db:
        db[thread_id] = {
            "funds": 1000000.0,
            "orders": [],
            "positions": {}
        }
        save_sandbox_db(db)
    return db[thread_id]

def add_sandbox_order(thread_id: str, order_data: dict):
    db = load_sandbox_db()
    state = db.get(thread_id, {
        "funds": 1000000.0,
        "orders": [],
        "positions": {}
    })
    
    sym = order_data.get("symbol", "UNKNOWN")
    qty = int(order_data.get("quantity", 0))
    price = float(order_data.get("price", 0.0))
    ttype = order_data.get("transaction_type", "BUY").upper()
    
    total_cost = qty * price
    
    order_record = {
        "order_id": order_data.get("order_id", f"SBOX-{int(datetime.datetime.now().timestamp())}"),
        "trading_symbol": sym,
        "quantity": qty,
        "price": price,
        "transaction_type": ttype,
        "order_type": order_data.get("order_type", "MARKET"),
        "status": "complete",
        "order_timestamp": str(datetime.datetime.now())
    }
    
    state["orders"].append(order_record)
    
    # Update funds and positions
    if ttype == "BUY":
        state["funds"] -= total_cost
        if sym not in state["positions"]:
            state["positions"][sym] = {"quantity": 0, "average_price": 0.0}
        
        pos = state["positions"][sym]
        old_val = pos["quantity"] * pos["average_price"]
        new_val = old_val + total_cost
        pos["quantity"] += qty
        if pos["quantity"] > 0:
            pos["average_price"] = new_val / pos["quantity"]
            
    elif ttype == "SELL":
        state["funds"] += total_cost
        if sym in state["positions"]:
            state["positions"][sym]["quantity"] -= qty
            
    db[thread_id] = state
    save_sandbox_db(db)
    return order_record

def get_sandbox_order_book(thread_id: str):
    return get_thread_state(thread_id).get("orders", [])

def get_sandbox_positions(thread_id: str):
    state = get_thread_state(thread_id)
    # Format nicely for the agent
    positions = []
    for sym, data in state.get("positions", {}).items():
        if data["quantity"] > 0:
            positions.append({
                "trading_symbol": sym,
                "quantity": data["quantity"],
                "average_price": data["average_price"]
            })
    return positions

def get_sandbox_funds(thread_id: str):
    state = get_thread_state(thread_id)
    return {
        "available_margin": state.get("funds", 1000000.0),
        "used_margin": 1000000.0 - state.get("funds", 1000000.0)
    }
