import os
from typing import List


def _to_bool(value: str | None, default: bool = False) -> bool:
    if value is None:
        return default
    return value.strip().lower() in {"1", "true", "yes", "y", "on"}


AI_MOCK: bool = _to_bool(os.getenv("AI_MOCK"), True)
AI_CONCURRENCY: int = int(os.getenv("AI_CONCURRENCY", "3"))
AI_TIMEOUT: float = float(os.getenv("AI_TIMEOUT", "30"))
AI_CACHE_TTL: int = int(os.getenv("AI_CACHE_TTL", "3600"))

BACKEND_WEBHOOK_URL: str = os.getenv("BACKEND_WEBHOOK_URL", "")
AI_WEBHOOK_SECRET: str = os.getenv("AI_WEBHOOK_SECRET", "")

OPENAI_API_KEY: str = os.getenv("OPENAI_API_KEY", "")
OPENAI_MODEL: str = os.getenv("OPENAI_MODEL", "gpt-4o-mini")

ANTHROPIC_API_KEY: str = os.getenv("ANTHROPIC_API_KEY", "")
ANTHROPIC_MODEL: str = os.getenv("ANTHROPIC_MODEL", "claude-3-haiku-20240307")

PROMPT_STORE_PATH: str = os.getenv("PROMPT_STORE_PATH", "data/prompts.json")

AI_PROVIDER_ORDER: List[str] = [
    p.strip().lower()
    for p in os.getenv("AI_PROVIDER_ORDER", "openai,anthropic").split(",")
    if p.strip()
]
