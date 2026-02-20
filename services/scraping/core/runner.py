from __future__ import annotations

import asyncio
from typing import Awaitable

from .config import SCRAPER_CONCURRENCY

_semaphore = asyncio.Semaphore(max(1, SCRAPER_CONCURRENCY))


async def run_with_limit(coro: Awaitable[None]) -> None:
    async with _semaphore:
        await coro
