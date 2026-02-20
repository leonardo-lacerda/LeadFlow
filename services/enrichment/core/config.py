import os
from typing import List


def _to_bool(value: str | None, default: bool = False) -> bool:
    if value is None:
        return default
    return value.strip().lower() in {"1", "true", "yes", "y", "on"}


ENRICHMENT_MOCK: bool = _to_bool(os.getenv("ENRICHMENT_MOCK"), True)
ENRICHMENT_CONCURRENCY: int = int(os.getenv("ENRICHMENT_CONCURRENCY", "3"))
ENRICHMENT_TIMEOUT: float = float(os.getenv("ENRICHMENT_TIMEOUT", "30"))
ENRICHMENT_CACHE_TTL: int = int(os.getenv("ENRICHMENT_CACHE_TTL", "3600"))

BACKEND_WEBHOOK_URL: str = os.getenv("BACKEND_WEBHOOK_URL", "")
ENRICHMENT_WEBHOOK_SECRET: str = os.getenv("ENRICHMENT_WEBHOOK_SECRET", "")

PROXY_LIST: List[str] = [p.strip() for p in os.getenv("PROXY_LIST", "").split(",") if p.strip()]

CNPJ_WS_BASE_URL: str = os.getenv("CNPJ_WS_BASE_URL", "")
SERPAPI_KEY: str = os.getenv("SERPAPI_KEY", "")
HUNTER_API_KEY: str = os.getenv("HUNTER_API_KEY", "")
SNOV_CLIENT_ID: str = os.getenv("SNOV_CLIENT_ID", "")
SNOV_CLIENT_SECRET: str = os.getenv("SNOV_CLIENT_SECRET", "")
ZEROBOUNCE_API_KEY: str = os.getenv("ZEROBOUNCE_API_KEY", "")
