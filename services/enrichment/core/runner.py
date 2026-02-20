from __future__ import annotations

import asyncio
from typing import Awaitable, TypeVar

from .config import ENRICHMENT_CONCURRENCY

_semaphore = asyncio.Semaphore(max(1, ENRICHMENT_CONCURRENCY))

T = TypeVar("T")


async def run_with_limit(coro: Awaitable[T]) -> T:
    async with _semaphore:
        return await coro
