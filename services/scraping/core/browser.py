import asyncio
from typing import Optional, Dict

from playwright.async_api import async_playwright, Browser, BrowserContext


class BrowserManager:
    def __init__(self) -> None:
        self._playwright = None
        self._browser: Optional[Browser] = None
        self._lock = asyncio.Lock()

    async def start(self) -> None:
        async with self._lock:
            if self._browser:
                return
            self._playwright = await async_playwright().start()
            self._browser = await self._playwright.chromium.launch(headless=True)

    async def new_context(self, proxy: Optional[Dict[str, str]] = None) -> BrowserContext:
        await self.start()
        assert self._browser is not None
        return await self._browser.new_context(proxy=proxy)

    async def close(self) -> None:
        async with self._lock:
            if self._browser:
                await self._browser.close()
                self._browser = None
            if self._playwright:
                await self._playwright.stop()
                self._playwright = None


browser_manager = BrowserManager()
