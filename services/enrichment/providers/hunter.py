import logging
from typing import Any, Dict, Optional

from core.config import ENRICHMENT_MOCK, HUNTER_API_KEY
from core.http import get_json
from core.proxy import proxy_manager
from .base import BaseProvider, EnrichmentResult

logger = logging.getLogger(__name__)


class HunterProvider(BaseProvider):
    name = "hunter"
    cost = 0.01

    def can_run(self, lead: Dict[str, Any]) -> bool:
        return bool(lead.get("companyDomain") or lead.get("companyName"))

    def cache_key(self, lead: Dict[str, Any]) -> Optional[str]:
        domain = lead.get("companyDomain") or ""
        name = (lead.get("fullName") or "").strip()
        return f"{domain}:{name}" if domain or name else None

    async def enrich(self, lead: Dict[str, Any]) -> EnrichmentResult:
        if lead.get("email"):
            return EnrichmentResult(data={})
        if ENRICHMENT_MOCK:
            return EnrichmentResult(
                data={
                    "email": f"contato@{(lead.get('companyDomain') or 'empresa.com').lower()}",
                    "emailVerified": False,
                },
                confidence=0.2,
            )
        if not HUNTER_API_KEY:
            raise RuntimeError("HUNTER_API_KEY not set")

        domain = lead.get("companyDomain")
        first_name = lead.get("firstName")
        last_name = lead.get("lastName")
        proxy = await proxy_manager.next_proxy()

        if domain and first_name and last_name:
            data = await get_json(
                "https://api.hunter.io/v2/email-finder",
                params={
                    "domain": domain,
                    "first_name": first_name,
                    "last_name": last_name,
                    "api_key": HUNTER_API_KEY,
                },
                proxy=proxy,
            )
            record = (data.get("data") or {})
            email = record.get("email")
            verification = (record.get("verification") or "").lower()
            confidence = float(record.get("confidence") or 0) / 100
            return EnrichmentResult(
                data={
                    "email": email,
                    "emailVerified": verification == "valid",
                },
                confidence=max(0.0, min(0.5, confidence)),
            )

        if domain:
            data = await get_json(
                "https://api.hunter.io/v2/domain-search",
                params={
                    "domain": domain,
                    "api_key": HUNTER_API_KEY,
                },
                proxy=proxy,
            )
            emails = (data.get("data") or {}).get("emails") or []
            if emails:
                record = emails[0]
                return EnrichmentResult(
                    data={
                        "email": record.get("value"),
                        "emailVerified": (record.get("verification") or "").lower()
                        == "valid",
                    },
                    confidence=0.2,
                )

        return EnrichmentResult(data={})
