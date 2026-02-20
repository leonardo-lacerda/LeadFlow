from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Dict


@dataclass
class ProviderResult:
    text: str
    raw: Dict[str, Any]
    usage: Dict[str, int]
    model: str
    provider: str


class Provider:
    name = "base"

    async def generate(
        self,
        prompt: str,
        temperature: float,
        max_tokens: int,
    ) -> ProviderResult:
        raise NotImplementedError
