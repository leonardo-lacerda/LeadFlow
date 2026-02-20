import logging
from typing import Any, Dict, Optional

from core.config import ENRICHMENT_MOCK, ZEROBOUNCE_API_KEY
from core.http import get_json
from core.proxy import proxy_manager
from .base import BaseProvider, EnrichmentResult

logger = logging.getLogger(__name__)


class ZeroBounceProvider(BaseProvider):
    name = "zerobounce"
    cost = 0.01

    def can_run(self, lead: Dict[str, Any]) -> bool:
        return bool(lead.get("email"))

    def cache_key(self, lead: Dict[str, Any]) -> Optional[str]:
        email = lead.get("email")
        return email if email else None

    async def enrich(self, lead: Dict[str, Any]) -> EnrichmentResult:
        email = lead.get("email")
        if not email:
            return EnrichmentResult(data={})
        if ENRICHMENT_MOCK:
            return EnrichmentResult(
                data={"emailVerified": True, "emailStatus": "valid"},
                confidence=0.4,
            )
        if not ZEROBOUNCE_API_KEY:
            raise RuntimeError("ZEROBOUNCE_API_KEY not set")
        proxy = await proxy_manager.next_proxy()
        data = await get_json(
            "https://api.zerobounce.net/v2/validate",
            params={"api_key": ZEROBOUNCE_API_KEY, "email": email},
            proxy=proxy,
        )
        status = (data.get("status") or "").lower()
        return EnrichmentResult(
            data={
                "emailVerified": status == "valid",
                "emailStatus": status,
            },
            confidence=0.5 if status == "valid" else 0.1,
        )
