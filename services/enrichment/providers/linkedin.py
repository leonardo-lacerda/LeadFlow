import logging
import re
from typing import Any, Dict, Optional

from core.config import ENRICHMENT_MOCK, SERPAPI_KEY
from core.http import get_json
from core.proxy import proxy_manager
from .base import BaseProvider, EnrichmentResult

logger = logging.getLogger(__name__)


def _slugify(value: str) -> str:
    value = value.lower()
    value = re.sub(r"[^a-z0-9]+", "-", value).strip("-")
    return value


class LinkedinProvider(BaseProvider):
    name = "linkedin"
    cost = 0.0

    def can_run(self, lead: Dict[str, Any]) -> bool:
        return bool(lead.get("companyName") or lead.get("companyDomain"))

    def cache_key(self, lead: Dict[str, Any]) -> Optional[str]:
        return lead.get("companyDomain") or lead.get("companyName")

    async def enrich(self, lead: Dict[str, Any]) -> EnrichmentResult:
        if lead.get("linkedinUrl"):
            return EnrichmentResult(data={})
        company = lead.get("companyName") or ""
        domain = lead.get("companyDomain") or ""
        if ENRICHMENT_MOCK:
            slug = _slugify(company or domain or "empresa")
            return EnrichmentResult(
                data={"linkedinUrl": f"https://www.linkedin.com/company/{slug}"},
                confidence=0.15,
            )
        if not SERPAPI_KEY:
            slug = _slugify(company or domain)
            if not slug:
                return EnrichmentResult(data={})
            return EnrichmentResult(
                data={"linkedinUrl": f"https://www.linkedin.com/company/{slug}"},
                confidence=0.05,
            )
        query = f"site:linkedin.com/company {company or domain}".strip()
        proxy = await proxy_manager.next_proxy()
        data = await get_json(
            "https://serpapi.com/search.json",
            params={"engine": "google", "q": query, "api_key": SERPAPI_KEY},
            proxy=proxy,
        )
        results = data.get("organic_results", []) or []
        for item in results:
            link = item.get("link") or ""
            if "linkedin.com/company" in link:
                return EnrichmentResult(
                    data={"linkedinUrl": link},
                    confidence=0.2,
                )
        return EnrichmentResult(data={})
