import os
import sys

# Add root directory to python path so we can import src
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from src.agent.graph import create_research_graph
from langchain_core.messages import HumanMessage
from src.api.logging_utils import generate_query_id, setup_query_logger

def run_evaluation(query: str):
    print(f"\n--- Starting Evaluation for Query: '{query}' ---\n")
    query_id = generate_query_id()
    logger = setup_query_logger(query_id)
    
    graph = create_research_graph()
    state = {"messages": [HumanMessage(content=query)]}
    
    try:
        for output in graph.stream(state, stream_mode="updates"):
            for node_name, node_state in output.items():
                print(f"[{node_name}] Executed.")
                if "messages" in node_state and len(node_state["messages"]) > 0:
                    print(f"Message: {node_state['messages'][-1].content[:200]}...\n")
                if "next" in node_state:
                    print(f"Delegating to: {node_state['next']}\n")
    except Exception as e:
        import traceback
        traceback.print_exc()
        print(f"Error during execution: {e}")
        logger.error(f"Error: {e}")

if __name__ == "__main__":
    test_query = "What is the current market sentiment and potential risks for Apple (AAPL) based on recent news?"
    if len(sys.argv) > 1:
        test_query = " ".join(sys.argv[1:])
    run_evaluation(test_query)
