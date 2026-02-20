from __future__ import annotations

from typing import Any, Dict

from core.http import post_json
from core.config import ANTHROPIC_API_KEY, ANTHROPIC_MODEL
from .base import Provider, ProviderResult


class AnthropicProvider(Provider):
    name = "anthropic"

    def __init__(self, api_key: str | None = None, model: str | None = None) -> None:
        self._api_key = api_key or ANTHROPIC_API_KEY
        self._model = model or ANTHROPIC_MODEL

    @property
    def available(self) -> bool:
        return bool(self._api_key)

    async def generate(self, prompt: str, temperature: float, max_tokens: int) -> ProviderResult:
        if not self._api_key:
            raise RuntimeError("Anthropic API key is missing")

        payload: Dict[str, Any] = {
            "model": self._model,
            "max_tokens": max_tokens,
            "temperature": temperature,
            "messages": [
                {"role": "user", "content": prompt},
            ],
        }

        response = await post_json(
            "https://api.anthropic.com/v1/messages",
            payload=payload,
            headers={
                "x-api-key": self._api_key,
                "anthropic-version": "2023-06-01",
                "content-type": "application/json",
            },
        )

        content = response.get("content", [])
        text = ""
        if content and isinstance(content, list):
            first = content[0]
            if isinstance(first, dict):
                text = first.get("text", "")

        usage = response.get("usage", {}) or {}
        normalized_usage = {
            "prompt_tokens": int(usage.get("input_tokens", 0)),
            "completion_tokens": int(usage.get("output_tokens", 0)),
            "total_tokens": int(usage.get("input_tokens", 0)) + int(usage.get("output_tokens", 0)),
        }

        return ProviderResult(
            text=text or "",
            raw=response,
            usage=normalized_usage,
            model=self._model,
            provider=self.name,
        )
