from __future__ import annotations

import json
from typing import Dict

from .base import Provider, ProviderResult


class MockProvider(Provider):
    name = "mock"

    async def generate(self, prompt: str, temperature: float, max_tokens: int) -> ProviderResult:
        payload = {
            "message": "This is a mock response.",
            "temperature": temperature,
            "max_tokens": max_tokens,
            "prompt_preview": prompt[:200],
        }
        return ProviderResult(
            text=json.dumps(payload),
            raw=payload,
            usage={"prompt_tokens": 0, "completion_tokens": 0, "total_tokens": 0},
            model="mock",
            provider=self.name,
        )
