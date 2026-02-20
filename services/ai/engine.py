from __future__ import annotations

import hashlib
import json
from typing import Any, Dict, List, Optional

from core.cache import TTLCache
from core.config import AI_MOCK, AI_PROVIDER_ORDER
from core.usage import UsageTracker
from providers import AnthropicProvider, MockProvider, OpenAIProvider, ProviderResult


class AIEngine:
    def __init__(self, cache: TTLCache, usage: UsageTracker) -> None:
        self.cache = cache
        self.usage = usage
        self._providers = {
            "openai": OpenAIProvider(),
            "anthropic": AnthropicProvider(),
            "mock": MockProvider(),
        }

    def _hash_key(self, payload: Dict[str, Any]) -> str:
        encoded = json.dumps(payload, sort_keys=True, default=str).encode("utf-8")
        return hashlib.sha256(encoded).hexdigest()

    def _resolve_order(self, provider_order: Optional[List[str]]) -> List[str]:
        if AI_MOCK:
            return ["mock"]
        if provider_order:
            return [p.lower() for p in provider_order if p]
        return AI_PROVIDER_ORDER

    async def generate(
        self,
        prompt: str,
        temperature: float,
        max_tokens: int,
        provider_order: Optional[List[str]] = None,
        org_id: Optional[str] = None,
        cache_key: Optional[str] = None,
    ) -> Dict[str, Any]:
        order = self._resolve_order(provider_order)
        cache_payload = {
            "prompt": prompt,
            "temperature": temperature,
            "max_tokens": max_tokens,
            "providers": order,
        }
        key = cache_key or self._hash_key(cache_payload)
        cached = self.cache.get(key)
        if cached:
            return {**cached, "cached": True}

        last_error: Optional[Exception] = None
        for provider_name in order:
            provider = self._providers.get(provider_name)
            if not provider:
                continue
            if hasattr(provider, "available") and not getattr(provider, "available"):
                continue
            try:
                result = await provider.generate(prompt, temperature, max_tokens)
                payload = self._result_payload(result)
                self.cache.set(key, payload)
                if org_id:
                    await self.usage.record(org_id, result.provider, result.usage)
                return {**payload, "cached": False}
            except Exception as exc:  # pragma: no cover - best effort
                last_error = exc
                continue

        raise RuntimeError(str(last_error) if last_error else "No providers available")

    def _result_payload(self, result: ProviderResult) -> Dict[str, Any]:
        return {
            "text": result.text,
            "provider": result.provider,
            "model": result.model,
            "usage": result.usage,
            "raw": result.raw,
        }
