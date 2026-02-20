from __future__ import annotations

from typing import Any, Dict, List

from core.cache import TTLCache
from core.config import ENRICHMENT_CACHE_TTL
from providers import (
    CnpjProvider,
    HunterProvider,
    LinkedinProvider,
    SnovProvider,
    ZeroBounceProvider,
)


def compute_confidence(lead: Dict[str, Any]) -> float:
    score = 0.1
    if lead.get("email"):
        score += 0.2
    if lead.get("emailVerified"):
        score += 0.4
    if lead.get("companyDomain"):
        score += 0.1
    if lead.get("linkedinUrl"):
        score += 0.1
    if lead.get("companyCnpj"):
        score += 0.05
    if lead.get("phone"):
        score += 0.05
    return min(1.0, score)


class EnrichmentPipeline:
    def __init__(self) -> None:
        self.cache = TTLCache(ENRICHMENT_CACHE_TTL)
        self.providers = [
            CnpjProvider(),
            LinkedinProvider(),
            HunterProvider(),
            SnovProvider(),
            ZeroBounceProvider(),
        ]

    async def enrich(self, lead: Dict[str, Any]) -> Dict[str, Any]:
        enriched: Dict[str, Any] = dict(lead)
        used: List[str] = []
        confidence_sum = 0.0

        for provider in self.providers:
            if enriched.get("email") and enriched.get("emailVerified"):
                break
            if not provider.can_run(enriched):
                continue
            cache_key = provider.cache_key(enriched)
            cache_value = self.cache.get(f"{provider.name}:{cache_key}") if cache_key else None
            if cache_value:
                result = cache_value
            else:
                result = await provider.enrich(enriched)
                if cache_key:
                    self.cache.set(f"{provider.name}:{cache_key}", result)
            if result.data:
                for key, value in result.data.items():
                    if value is not None:
                        enriched[key] = value
                used.append(provider.name)
                confidence_sum += result.confidence

        computed_confidence = compute_confidence(enriched)
        enriched["enrichmentProviders"] = used
        enriched["enrichmentConfidence"] = max(computed_confidence, min(1.0, confidence_sum))
        return enriched
