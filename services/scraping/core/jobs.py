from __future__ import annotations

import asyncio
from dataclasses import dataclass, field
from datetime import datetime
from typing import Any, Dict, List, Optional
from uuid import uuid4

STATUS_PENDING = "PENDING"
STATUS_RUNNING = "RUNNING"
STATUS_COMPLETED = "COMPLETED"
STATUS_FAILED = "FAILED"


@dataclass
class Job:
    id: str
    source: str
    status: str
    query: Dict[str, Any]
    created_at: str
    updated_at: str
    progress: int = 0
    total_items: int = 0
    processed_items: int = 0
    results: List[Dict[str, Any]] = field(default_factory=list)
    error: Optional[str] = None


class JobStore:
    def __init__(self) -> None:
        self._jobs: Dict[str, Job] = {}
        self._lock = asyncio.Lock()

    async def create(self, source: str, query: Dict[str, Any], job_id: Optional[str] = None) -> Job:
        jid = job_id or uuid4().hex
        now = datetime.utcnow().isoformat() + "Z"
        job = Job(
            id=jid,
            source=source,
            status=STATUS_PENDING,
            query=query,
            created_at=now,
            updated_at=now,
        )
        async with self._lock:
            self._jobs[jid] = job
        return job

    async def get(self, job_id: str) -> Optional[Job]:
        async with self._lock:
            return self._jobs.get(job_id)

    async def update(self, job_id: str, **kwargs: Any) -> Optional[Job]:
        async with self._lock:
            job = self._jobs.get(job_id)
            if not job:
                return None
            for key, value in kwargs.items():
                if hasattr(job, key):
                    setattr(job, key, value)
            job.updated_at = datetime.utcnow().isoformat() + "Z"
            return job

    async def complete(
        self,
        job_id: str,
        results: List[Dict[str, Any]],
        total_items: Optional[int] = None,
        processed_items: Optional[int] = None,
    ) -> Optional[Job]:
        total = total_items if total_items is not None else len(results)
        processed = processed_items if processed_items is not None else len(results)
        return await self.update(
            job_id,
            status=STATUS_COMPLETED,
            results=results,
            total_items=total,
            processed_items=processed,
            progress=100 if total else 0,
        )

    async def fail(self, job_id: str, error: str) -> Optional[Job]:
        return await self.update(job_id, status=STATUS_FAILED, error=error)


job_store = JobStore()
