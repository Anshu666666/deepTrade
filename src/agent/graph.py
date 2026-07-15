from deepagents.graph import create_deep_agent
from deepagents.backends.store import StoreBackend
from deepagents.middleware.filesystem import FilesystemMiddleware
from .models import get_llm
from .config_loader import PROMPTS

# Exported constant — used by the SSE streamer to identify the root supervisor's messages
SUPERVISOR_NAME = "Supervisor"

from deepagents.backends.composite import CompositeBackend
from deepagents.backends.state import StateBackend

def create_research_graph(checkpointer=None, store=None):
    llm = get_llm()

    backend = None
    # If store is provided, persist artifacts natively to Postgres
    # by using StoreBackend mapped to the /research prefix
    if store:
        from deepagents.backends.filesystem import FilesystemBackend
        # Create a StoreBackend matching /research/* to the store namespace
        store_backend = StoreBackend(store=store, namespace=lambda rt: ("vfs", "research"))
        # Create a FilesystemBackend for skills
        import os
        skills_dir = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "skills")
        skills_backend = FilesystemBackend(root_dir=skills_dir, virtual_mode=True)
        
        backend = CompositeBackend(default=StateBackend(), routes={
            "/research/": store_backend,
            "/skills/": skills_backend
        })

    from .tools import search_web, search_financial_data
    from .upstox_tools import (
        upstox_get_market_data,
        upstox_place_order,
        upstox_modify_order,
        upstox_cancel_order,
        upstox_get_order_book,
        upstox_get_holdings,
        upstox_get_positions,
        upstox_get_funds
    )

    all_tools = [
        search_web, 
        search_financial_data,
        upstox_get_market_data,
        upstox_place_order,
        upstox_modify_order,
        upstox_cancel_order,
        upstox_get_order_book,
        upstox_get_holdings,
        upstox_get_positions,
        upstox_get_funds
    ]

    return create_deep_agent(
        model=llm,
        system_prompt=PROMPTS["supervisor"],
        tools=all_tools,
        skills=["/skills/"],
        name=SUPERVISOR_NAME,
        checkpointer=checkpointer,
        store=store,
        backend=backend,
    )
