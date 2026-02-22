import asyncio
import logging
from typing import List, Optional, Dict, Any

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field

from core.config import BACKEND_WEBHOOK_URL, ENRICHMENT_WEBHOOK_SECRET
from core.jobs import job_store
from core.progress import ProgressReporter
from core.runner import run_with_limit
from pipeline import EnrichmentPipeline

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(title="Lastreia Enrichment Service")
pipeline = EnrichmentPipeline()


class BaseRequest(BaseModel):
    job_id: Optional[str] = Field(default=None)
    webhook_url: Optional[str] = Field(default=None)
    webhook_secret: Optional[str] = Field(default=None)


class EnrichRequest(BaseRequest):
    lead: Dict[str, Any]


class EnrichBulkRequest(BaseRequest):
    leads: List[Dict[str, Any]]


def _resolve_webhook_url(value: Optional[str]) -> Optional[str]:
    return value or BACKEND_WEBHOOK_URL or None


def _resolve_webhook_secret(value: Optional[str]) -> Optional[str]:
    return value or ENRICHMENT_WEBHOOK_SECRET or None


@app.get("/health")
async def health() -> dict:
    return {"status": "ok"}


@app.get("/jobs/{job_id}")
async def get_job(job_id: str) -> dict:
    job = await job_store.get(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    return {
        "job_id": job.id,
        "status": job.status,
        "query": job.query,
        "progress": job.progress,
        "totalItems": job.total_items,
        "processedItems": job.processed_items,
        "results": job.results,
        "error": job.error,
        "createdAt": job.created_at,
        "updatedAt": job.updated_at,
    }


async def _enrich_single(
    lead: Dict[str, Any],
    job_id: str,
    reporter: ProgressReporter,
) -> Dict[str, Any]:
    enriched = await pipeline.enrich(lead)
    await reporter.update(1, total_items=1, force=True)
    return enriched


async def _enrich_bulk(
    leads: List[Dict[str, Any]],
    job_id: str,
    reporter: ProgressReporter,
) -> List[Dict[str, Any]]:
    total = len(leads)
    await reporter.start(total_items=total)
    counter = 0
    counter_lock = asyncio.Lock()

    async def _run(index: int, item: Dict[str, Any]) -> Dict[str, Any]:
        enriched = await pipeline.enrich(item)
        nonlocal counter
        async with counter_lock:
            counter += 1
            await reporter.update(counter)
        return enriched

    tasks = [run_with_limit(_run(index, lead)) for index, lead in enumerate(leads)]
    return await asyncio.gather(*tasks)


@app.post("/enrich")
async def enrich(payload: EnrichRequest) -> dict:
    job = await job_store.create({"lead": payload.lead}, job_id=payload.job_id)
    webhook_url = _resolve_webhook_url(payload.webhook_url)
    webhook_secret = _resolve_webhook_secret(payload.webhook_secret)

    reporter = ProgressReporter(job.id, webhook_url, webhook_secret)

    async def _task() -> None:
        try:
            await reporter.start(total_items=1)
            enriched = await pipeline.enrich(payload.lead)
            await reporter.finish([enriched])
        except Exception as exc:
            logger.exception("Enrichment failed")
            await reporter.fail(str(exc))

    asyncio.create_task(run_with_limit(_task()))
    return {"job_id": job.id, "status": "started"}


@app.post("/enrich/bulk")
async def enrich_bulk(payload: EnrichBulkRequest) -> dict:
    job = await job_store.create({"leads": payload.leads}, job_id=payload.job_id)
    webhook_url = _resolve_webhook_url(payload.webhook_url)
    webhook_secret = _resolve_webhook_secret(payload.webhook_secret)

    reporter = ProgressReporter(job.id, webhook_url, webhook_secret)

    async def _task() -> None:
        try:
            enriched = await _enrich_bulk(payload.leads, job.id, reporter)
            await reporter.finish(enriched)
        except Exception as exc:
            logger.exception("Enrichment bulk failed")
            await reporter.fail(str(exc))

    asyncio.create_task(_task())
    return {"job_id": job.id, "status": "started"}
