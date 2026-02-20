import asyncio
from typing import Optional, Dict
from urllib.parse import urlparse

from .config import PROXY_LIST


class ProxyManager:
    def __init__(self, proxies: list[str]) -> None:
        self._proxies = proxies
        self._index = 0
        self._lock = asyncio.Lock()

    def _normalize_proxy(self, proxy: str) -> str:
        if "://" not in proxy:
            return "http://" + proxy
        return proxy

    async def next_proxy(self) -> Optional[str]:
        if not self._proxies:
            return None
        async with self._lock:
            proxy = self._proxies[self._index % len(self._proxies)]
            self._index += 1
            return self._normalize_proxy(proxy)

    async def next_playwright_proxy(self) -> Optional[Dict[str, str]]:
        proxy = await self.next_proxy()
        if not proxy:
            return None
        parsed = urlparse(proxy)
        server = f"{parsed.scheme}://{parsed.hostname}:{parsed.port}"
        if parsed.username or parsed.password:
            return {
                "server": server,
                "username": parsed.username or "",
                "password": parsed.password or "",
            }
        return {"server": server}


proxy_manager = ProxyManager(PROXY_LIST)
