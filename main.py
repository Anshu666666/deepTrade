import sys
import asyncio
import uvicorn

if sys.platform == "win32":
    asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())

if __name__ == "__main__":
    uvicorn.run(
        "src.api.server:app",
        host="0.0.0.0",
        port=8000,
        reload=True,
        reload_dirs=["src/api", "src/agent"],
        reload_excludes=["src/ui/*", "node_modules/*", ".git/*"],
        loop="asyncio"
    )

