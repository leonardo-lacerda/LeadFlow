from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Dict, List, Optional

from .callbacks import send_webhook
from .jobs import job_store, STATUS_RUNNING


@dataclass
class ProgressReporter:
    job_id: str
    webhook_url: Optional[str] = None
    webhook_secret: Optional[str] = None
    total_items: Optional[int] = None
    processed_items: int = 0
    _last_progress: int = 0

    async def start(self, total_items: Optional[int] = None) -> None:
        if total_items is not None:
            self.total_items = total_items
        update_kwargs: Dict[str, Any] = {"status": STATUS_RUNNING, "progress": 0}
        if self.total_items is not None:
            update_kwargs["total_items"] = self.total_items
            update_kwargs["processed_items"] = 0
        await job_store.update(self.job_id, **update_kwargs)
        await self._send(
            status=STATUS_RUNNING,
            progress=0,
            total_items=self.total_items,
            processed_items=0 if self.total_items is not None else None,
        )

    async def update(
        self, processed_items: int, total_items: Optional[int] = None, force: bool = False
    ) -> None:
        if total_items is not None:
            self.total_items = total_items
        self.processed_items = processed_items
        if self.total_items is None or self.total_items == 0:
            return
        progress = min(100, int((processed_items / self.total_items) * 100))
        await job_store.update(
            self.job_id,
            status=STATUS_RUNNING,
            total_items=self.total_items,
            processed_items=processed_items,
            progress=progress,
        )
        if force or progress == 100 or progress >= self._last_progress + 10:
            self._last_progress = progress
            await self._send(
                status=STATUS_RUNNING,
                progress=progress,
                total_items=self.total_items,
                processed_items=processed_items,
            )

    async def finish(self, results: List[Dict[str, Any]]) -> None:
        total = self.total_items if self.total_items is not None else len(results)
        processed = self.processed_items if self.processed_items else len(results)
        await job_store.complete(
            self.job_id,
            results=results,
            total_items=total,
            processed_items=processed,
        )
        await self._send(
            status="COMPLETED",
            progress=100,
            total_items=total,
            processed_items=processed,
            results=results,
        )

    async def fail(self, error: str) -> None:
        await job_store.fail(self.job_id, error=error)
        await self._send(status="FAILED", error=error)

    async def _send(
        self,
        status: str,
        progress: Optional[int] = None,
        total_items: Optional[int] = None,
        processed_items: Optional[int] = None,
        results: Optional[List[Dict[str, Any]]] = None,
        error: Optional[str] = None,
    ) -> None:
        payload: Dict[str, Any] = {"job_id": self.job_id, "status": status}
        if progress is not None:
            payload["progress"] = progress
        if total_items is not None:
            payload["totalItems"] = total_items
        if processed_items is not None:
            payload["processedItems"] = processed_items
        if results is not None:
            payload["results"] = results
        if error is not None:
            payload["error"] = error
        await send_webhook(self.webhook_url, payload, secret=self.webhook_secret)
