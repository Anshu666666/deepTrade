import os
from typing import Literal
from langchain_core.tools import tool
from valyu import Valyu
from exa_py import Exa
@tool
def search_financial_data(query: str, search_type: str = "all") -> str:
    """
    Search web, news, and SEC filings for financial data.
    Useful for gathering recent news, financial reports, or stock sentiment.
    """
    client = Valyu(api_key=os.environ.get("VALYU_API_KEY"))
    try:
        response = client.search(
            query=query,
            search_type=search_type,
            max_num_results=10
        )
        
        results = []
        for res in response.results:
            summary = getattr(res, 'text', '') or getattr(res, 'snippet', '')
            summary = " ".join(summary.split()) # compress newlines
            results.append(f"Title: {res.title} | URL: {res.url} | Summary: {summary}")
            
        return "\n".join(results) if results else "No results found."
    except Exception as e:
        return f"Error executing Valyu search: {str(e)}"

@tool
def search_web(query: str, search_type: Literal["neural", "keyword", "auto", "hybrid", "fast", "deep-reasoning", "deep-lite", "magic", "deep", "instant"] = "auto") -> str:
    """
    Search the web for general information, current events, weather, or real-time data using Exa API.
    Use this for any non-financial queries that require internet access.
    """
    client = Exa(api_key=os.environ.get("EXA_API_KEY"))
    try:
        response = client.search_and_contents(
            query=query,
            type=search_type,
            num_results=5,
            text=True
        )
        
        results = []
        for res in response.results:
            summary = res.text[:500] + "..." if res.text and len(res.text) > 500 else res.text
            summary = " ".join(summary.split()) if summary else "" # compress newlines
            results.append(f"Title: {res.title} | URL: {res.url} | Content: {summary}")
            
        return "\n".join(results) if results else "No results found."
    except Exception as e:
        return f"Error executing Exa search: {str(e)}"
