from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Dict, List, Optional

from .callbacks import send_webhook
from .jobs import job_store, STATUS_RUNNING

MIN_PROGRESS_STEP = 5


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
        self,
        processed_items: int,
        total_items: Optional[int] = None,
        force: bool = False,
        leads: Optional[List[Dict[str, Any]]] = None,
    ) -> None:
        if total_items is not None:
            self.total_items = total_items
        self.processed_items = processed_items
        progress: Optional[int] = None

        if self.total_items is not None and self.total_items > 0:
            progress = min(100, int((processed_items / self.total_items) * 100))

        update_kwargs: Dict[str, Any] = {
            "status": STATUS_RUNNING,
            "processed_items": processed_items,
        }
        if self.total_items is not None:
            update_kwargs["total_items"] = self.total_items
        if progress is not None:
            update_kwargs["progress"] = progress

        await job_store.update(self.job_id, **update_kwargs)

        should_send_progress = (
            force
            or progress == 100
            or (
                progress is not None
                and progress >= self._last_progress + MIN_PROGRESS_STEP
            )
        )
        should_send_leads = bool(leads)

        if should_send_progress or should_send_leads:
            if progress is not None:
                self._last_progress = progress
            await self._send(
                status=STATUS_RUNNING,
                progress=progress,
                total_items=self.total_items,
                processed_items=processed_items,
                leads=leads,
            )

    async def finish(
        self,
        leads: List[Dict[str, Any]],
        debug: Optional[Dict[str, Any]] = None,
        send_leads: bool = True,
    ) -> None:
        total = self.total_items if self.total_items is not None else len(leads)
        processed = self.processed_items if self.processed_items else len(leads)
        await job_store.complete(
            self.job_id,
            results=leads,
            total_items=total,
            processed_items=processed,
        )
        await self._send(
            status="COMPLETED",
            progress=100,
            total_items=total,
            processed_items=processed,
            leads=leads if send_leads else None,
            debug=debug,
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
        leads: Optional[List[Dict[str, Any]]] = None,
        error: Optional[str] = None,
        debug: Optional[Dict[str, Any]] = None,
    ) -> None:
        payload: Dict[str, Any] = {"job_id": self.job_id, "status": status}
        if progress is not None:
            payload["progress"] = progress
        if total_items is not None:
            payload["totalItems"] = total_items
        if processed_items is not None:
            payload["processedItems"] = processed_items
        if leads is not None:
            payload["leads"] = leads
        if error is not None:
            payload["error"] = error
        if debug is not None:
            payload["debug"] = debug
        await send_webhook(self.webhook_url, payload, secret=self.webhook_secret)
