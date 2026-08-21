import os
import sys
from dotenv import load_dotenv
from langchain_openai import ChatOpenAI
from langchain_core.messages import HumanMessage
from langchain_core.tools import tool

# Load environment variables
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
load_dotenv()

api_key = os.environ.get("OPENROUTER_API_KEY")

models = [
    "poolside/laguna-s-2.1:free",
    "nvidia/nemotron-3.5-lightning:free",
    "poolside/laguna-xs-2.1:free",
    "z-ai/glm-5.2:free",
]

@tool
def get_stock_price(ticker: str) -> str:
    """Get the current stock price for a ticker."""
    return f"{ticker}: 150.00"

def test_model(model_name: str):
    print(f"\n--- Testing Model: {model_name} ---")
    try:
        llm = ChatOpenAI(
            model=model_name,
            base_url="https://openrouter.ai/api/v1",
            api_key=api_key,
            temperature=0,
            max_retries=1,
            extra_body={"include_reasoning": True}
        )
        
        # 1. Test Chat
        response = llm.invoke([HumanMessage(content="Hi")])
        print(f"✅ Chat Response: {response.content.strip()}")
        
        # 2. Test Tool Calling
        llm_with_tools = llm.bind_tools([get_stock_price])
        tool_resp = llm_with_tools.invoke([HumanMessage(content="What is the price of AAPL? Use the get_stock_price tool.")])
        if getattr(tool_resp, "tool_calls", None):
            print(f"✅ Tool Calling: {tool_resp.tool_calls}")
        else:
            print(f"⚠️ Tool Calling: No tool call emitted ({tool_resp.content})")
        return True
    except Exception as e:
        print(f"❌ FAILED: {e}")
        return False

if __name__ == "__main__":
    print("Starting Model Tests...\n")
    for m in models:
        test_model(m)
    print("\n--- Testing Complete ---")

