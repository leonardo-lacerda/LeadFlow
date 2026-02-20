from __future__ import annotations

from typing import Any, Dict

from core.http import post_json
from core.config import OPENAI_API_KEY, OPENAI_MODEL
from .base import Provider, ProviderResult


class OpenAIProvider(Provider):
    name = "openai"

    def __init__(self, api_key: str | None = None, model: str | None = None) -> None:
        self._api_key = api_key or OPENAI_API_KEY
        self._model = model or OPENAI_MODEL

    @property
    def available(self) -> bool:
        return bool(self._api_key)

    async def generate(self, prompt: str, temperature: float, max_tokens: int) -> ProviderResult:
        if not self._api_key:
            raise RuntimeError("OpenAI API key is missing")

        payload: Dict[str, Any] = {
            "model": self._model,
            "messages": [
                {"role": "system", "content": "You are a helpful assistant."},
                {"role": "user", "content": prompt},
            ],
            "temperature": temperature,
            "max_tokens": max_tokens,
        }

        response = await post_json(
            "https://api.openai.com/v1/chat/completions",
            payload=payload,
            headers={
                "authorization": f"Bearer {self._api_key}",
                "content-type": "application/json",
            },
        )

        message = (
            response.get("choices", [{}])[0]
            .get("message", {})
            .get("content", "")
        )
        usage = response.get("usage", {}) or {}
        normalized_usage = {
            "prompt_tokens": int(usage.get("prompt_tokens", 0)),
            "completion_tokens": int(usage.get("completion_tokens", 0)),
            "total_tokens": int(usage.get("total_tokens", 0)),
        }

        return ProviderResult(
            text=message or "",
            raw=response,
            usage=normalized_usage,
            model=self._model,
            provider=self.name,
        )
