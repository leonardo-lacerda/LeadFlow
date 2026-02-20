from __future__ import annotations

import asyncio
from typing import Dict, Optional


class UsageTracker:
    def __init__(self) -> None:
        self._lock = asyncio.Lock()
        self._usage: Dict[str, Dict[str, Dict[str, int]]] = {}

    async def record(self, org_id: str, provider: str, usage: Dict[str, int]) -> None:
        async with self._lock:
            org_bucket = self._usage.setdefault(org_id, {})
            provider_bucket = org_bucket.setdefault(provider, {"prompt_tokens": 0, "completion_tokens": 0, "total_tokens": 0})
            provider_bucket["prompt_tokens"] += int(usage.get("prompt_tokens", 0))
            provider_bucket["completion_tokens"] += int(usage.get("completion_tokens", 0))
            provider_bucket["total_tokens"] += int(usage.get("total_tokens", 0))

    async def snapshot(self, org_id: Optional[str] = None) -> Dict[str, Dict[str, Dict[str, int]]]:
        async with self._lock:
            if org_id:
                return {org_id: self._usage.get(org_id, {})}
            return dict(self._usage)
