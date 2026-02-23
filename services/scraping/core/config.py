import os
from typing import List


def _to_bool(value: str | None, default: bool = False) -> bool:
    if value is None:
        return default
    return value.strip().lower() in {"1", "true", "yes", "y", "on"}


def _resolve_node_env() -> str:
    for key in ("NODE_ENV", "APP_ENV", "ENVIRONMENT"):
        raw = os.getenv(key)
        if raw and raw.strip():
            return raw.strip().lower()
    # Fail-safe default: production mode if env is missing.
    return "production"


SCRAPING_MOCK: bool = _to_bool(os.getenv("SCRAPING_MOCK"), False)
SCRAPING_NO_API: bool = _to_bool(os.getenv("SCRAPING_NO_API"), False)
SCRAPER_CONCURRENCY: int = int(os.getenv("SCRAPER_CONCURRENCY", "3"))
SCRAPER_RPM: int = int(os.getenv("SCRAPER_RPM", "60"))
SCRAPER_TIMEOUT: float = float(os.getenv("SCRAPER_TIMEOUT", "30"))
NODE_ENV: str = _resolve_node_env()
IS_PRODUCTION: bool = NODE_ENV in {"production", "prod"}
ALLOW_SCRAPING_MOCK_IN_PRODUCTION: bool = _to_bool(
    os.getenv("ALLOW_SCRAPING_MOCK_IN_PRODUCTION"),
    False,
)
if IS_PRODUCTION and SCRAPING_MOCK and not ALLOW_SCRAPING_MOCK_IN_PRODUCTION:
    SCRAPING_MOCK = False

BACKEND_WEBHOOK_URL: str = os.getenv("BACKEND_WEBHOOK_URL", "")
SCRAPING_WEBHOOK_SECRET: str = os.getenv("SCRAPING_WEBHOOK_SECRET", "")

PROXY_LIST: List[str] = [p.strip() for p in os.getenv("PROXY_LIST", "").split(",") if p.strip()]

SERPAPI_KEY: str = os.getenv("SERPAPI_KEY", "")
GOOGLE_PLACES_API_KEY: str = os.getenv("GOOGLE_PLACES_API_KEY", "")
CNPJ_WS_BASE_URL: str = os.getenv("CNPJ_WS_BASE_URL", "")
WAPPALYZER_API_KEY: str = os.getenv("WAPPALYZER_API_KEY", "")
