from typing import Any, Dict, Optional

import httpx

from .config import ENRICHMENT_TIMEOUT
from .retry import retry_async

DEFAULT_HEADERS = {
    "user-agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0 Safari/537.36",
    "accept-language": "pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7",
}


def _build_client(proxy: Optional[str]) -> httpx.AsyncClient:
    kwargs: Dict[str, Any] = {"timeout": ENRICHMENT_TIMEOUT}
    if proxy:
        try:
            return httpx.AsyncClient(**kwargs, proxy=proxy)
        except TypeError:
            return httpx.AsyncClient(**kwargs, proxies=proxy)
    return httpx.AsyncClient(**kwargs)


def _merge_headers(headers: Optional[Dict[str, str]]) -> Dict[str, str]:
    if headers:
        return {**DEFAULT_HEADERS, **headers}
    return dict(DEFAULT_HEADERS)


@retry_async()
async def get_json(
    url: str,
    params: Optional[Dict[str, Any]] = None,
    headers: Optional[Dict[str, str]] = None,
    proxy: Optional[str] = None,
) -> Dict[str, Any]:
    async with _build_client(proxy) as client:
        response = await client.get(url, params=params, headers=_merge_headers(headers))
        response.raise_for_status()
        return response.json()


@retry_async()
async def post_json(
    url: str,
    payload: Dict[str, Any],
    headers: Optional[Dict[str, str]] = None,
    proxy: Optional[str] = None,
) -> Dict[str, Any]:
    async with _build_client(proxy) as client:
        response = await client.post(url, json=payload, headers=_merge_headers(headers))
        response.raise_for_status()
        return response.json()
