import os

_PROMPTS_DIR = os.path.join(os.path.dirname(__file__), 'config', 'prompts')


def _load_prompt(filename: str) -> str:
    """Load a prompt from a .md file in the prompts directory."""
    path = os.path.join(_PROMPTS_DIR, filename)
    with open(path, 'r', encoding='utf-8') as f:
        return f.read().strip()


def load_prompts():
    return {
        "supervisor": _load_prompt("supervisor.md")
    }


PROMPTS = load_prompts()
