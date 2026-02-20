import logging
from typing import Any, Dict, Optional

import httpx

from .http import post_json

logger = logging.getLogger(__name__)


async def send_webhook(url: Optional[str], payload: Dict[str, Any], secret: Optional[str] = None) -> None:
    if not url:
        return
    headers = {"content-type": "application/json"}
    if secret:
        headers["x-scraping-secret"] = secret
    try:
        await post_json(url, payload=payload, headers=headers)
    except Exception as exc:
        if isinstance(exc, httpx.HTTPStatusError) and exc.response is not None:
            response_text = exc.response.text
            if len(response_text) > 800:
                response_text = f"{response_text[:800]}..."
            logger.warning(
                "Webhook failed status=%s body=%s payload=%s",
                exc.response.status_code,
                response_text,
                payload,
            )
            return
        logger.warning("Webhook failed payload=%s error=%s", payload, exc)
