from typing import Any, Dict, Optional

import httpx

from .config import AI_TIMEOUT
from .retry import retry_async

DEFAULT_HEADERS = {
    "user-agent": "Leadflow-AI-Service",
}


def _build_client() -> httpx.AsyncClient:
    return httpx.AsyncClient(timeout=AI_TIMEOUT)


def _merge_headers(headers: Optional[Dict[str, str]]) -> Dict[str, str]:
    if headers:
        return {**DEFAULT_HEADERS, **headers}
    return dict(DEFAULT_HEADERS)


@retry_async()
async def post_json(
    url: str,
    payload: Dict[str, Any],
    headers: Optional[Dict[str, str]] = None,
) -> Dict[str, Any]:
    async with _build_client() as client:
        response = await client.post(url, json=payload, headers=_merge_headers(headers))
        response.raise_for_status()
        return response.json()


@retry_async()
async def get_json(
    url: str,
    headers: Optional[Dict[str, str]] = None,
) -> Dict[str, Any]:
    async with _build_client() as client:
        response = await client.get(url, headers=_merge_headers(headers))
        response.raise_for_status()
        return response.json()
