from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Dict, Optional


@dataclass
class EnrichmentResult:
    data: Dict[str, Any]
    confidence: float = 0.0
    cost: float = 0.0


class BaseProvider:
    name: str = "provider"
    cost: float = 0.0

    def can_run(self, lead: Dict[str, Any]) -> bool:
        return True

    def cache_key(self, lead: Dict[str, Any]) -> Optional[str]:
        return None

    async def enrich(self, lead: Dict[str, Any]) -> EnrichmentResult:
        raise NotImplementedError
