import logging
from typing import Any, Dict, Optional

from core.config import ENRICHMENT_MOCK, SNOV_CLIENT_ID, SNOV_CLIENT_SECRET
from core.http import post_json
from core.proxy import proxy_manager
from .base import BaseProvider, EnrichmentResult

logger = logging.getLogger(__name__)


class SnovProvider(BaseProvider):
    name = "snov"
    cost = 0.02

    def __init__(self) -> None:
        self._token: Optional[str] = None

    def can_run(self, lead: Dict[str, Any]) -> bool:
        return bool(lead.get("companyDomain")) and not bool(lead.get("email"))

    def cache_key(self, lead: Dict[str, Any]) -> Optional[str]:
        domain = lead.get("companyDomain")
        return domain if domain else None

    async def _get_token(self) -> str:
        if self._token:
            return self._token
        if not SNOV_CLIENT_ID or not SNOV_CLIENT_SECRET:
            raise RuntimeError("SNOV_CLIENT_ID or SNOV_CLIENT_SECRET not set")
        data = await post_json(
            "https://api.snov.io/v1/oauth/access_token",
            payload={
                "grant_type": "client_credentials",
                "client_id": SNOV_CLIENT_ID,
                "client_secret": SNOV_CLIENT_SECRET,
            },
        )
        token = data.get("access_token")
        if not token:
            raise RuntimeError("Failed to fetch Snov token")
        self._token = token
        return token

    async def enrich(self, lead: Dict[str, Any]) -> EnrichmentResult:
        if ENRICHMENT_MOCK:
            return EnrichmentResult(
                data={
                    "email": f"contato@{lead.get('companyDomain') or 'empresa.com'}",
                    "emailVerified": False,
                },
                confidence=0.2,
            )
        domain = lead.get("companyDomain")
        if not domain:
            return EnrichmentResult(data={})
        token = await self._get_token()
        proxy = await proxy_manager.next_proxy()
        data = await post_json(
            "https://api.snov.io/v2/domain-emails-with-info",
            payload={"access_token": token, "domain": domain},
            proxy=proxy,
        )
        emails = data.get("emails") or data.get("data") or []
        if emails:
            record = emails[0]
            email = record.get("email") or record.get("value")
            return EnrichmentResult(
                data={"email": email, "emailVerified": False},
                confidence=0.15,
            )
        return EnrichmentResult(data={})
