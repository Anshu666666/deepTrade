import os
import sys
from dotenv import load_dotenv
from langchain_openai import ChatOpenAI
from langchain_core.messages import HumanMessage

# Load environment variables
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
load_dotenv()

api_key = os.environ.get("OPENROUTER_API_KEY")

models = [
    "poolside/laguna-xs-2.1:free",
    "poolside/laguna-m.1:free",
    "nvidia/nemotron-3-super-120b-a12b:free",
    "openai/gpt-oss-120b:free"
]

def test_model(model_name: str):
    print(f"\n--- Testing Model: {model_name} ---")
    try:
        llm = ChatOpenAI(
            model=model_name,
            base_url="https://openrouter.ai/api/v1",
            api_key=api_key,
            temperature=0,
            max_retries=1
        )
        
        response = llm.invoke([HumanMessage(content="Hi")])
        print(f"SUCCESS: {response.content}")
        return True
    except Exception as e:
        print(f"FAILED: {e}")
        return False

if __name__ == "__main__":
    print("Starting Model Tests...\n")
    for m in models:
        test_model(m)
    print("\n--- Testing Complete ---")
