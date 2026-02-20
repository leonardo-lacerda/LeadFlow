import logging
from typing import Any, Dict, Optional

from .http import post_json

logger = logging.getLogger(__name__)


async def send_webhook(url: Optional[str], payload: Dict[str, Any], secret: Optional[str] = None) -> None:
    if not url:
        return
    headers = {"content-type": "application/json"}
    if secret:
        headers["x-ai-secret"] = secret
    try:
        await post_json(url, payload=payload, headers=headers)
    except Exception as exc:
        logger.warning("Webhook failed: %s", exc)
