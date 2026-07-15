import os
from langchain_openai import ChatOpenAI
from dotenv import load_dotenv
import langchain_openai.chat_models.base

# --- Monkey-Patch to capture OpenRouter Reasoning Tokens ---
original_convert = langchain_openai.chat_models.base._convert_delta_to_message_chunk

def patched_convert(_dict, default_class):
    message_chunk = original_convert(_dict, default_class)
    reasoning = _dict.get("reasoning")
    if reasoning:
        message_chunk.additional_kwargs["reasoning"] = reasoning
    return message_chunk

langchain_openai.chat_models.base._convert_delta_to_message_chunk = patched_convert
# -----------------------------------------------------------

load_dotenv()

def get_llm():
    model_name = os.environ.get("OPENROUTER_MODEL", "nvidia/nemotron-3-super-120b-a12b:free")
    return ChatOpenAI(
        model=model_name,
        base_url="https://openrouter.ai/api/v1",
        api_key=os.environ.get("OPENROUTER_API_KEY"),
        temperature=0,
        model_kwargs={},
        extra_body={"include_reasoning": True}
    )
