import asyncio
import logging
from typing import List, Optional

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field

from core.browser import browser_manager
from core.config import BACKEND_WEBHOOK_URL, SCRAPING_WEBHOOK_SECRET
from core.jobs import job_store
from core.runner import run_with_limit
from scrapers import (
    google_maps,
    cnpj,
    reclame_aqui,
    indeed,
    catho,
    mercado_livre,
    wappalyzer,
    linkedin_dork,
    comprasnet,
)

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(title="Lastreia Scraping Service")


class BaseRequest(BaseModel):
    job_id: Optional[str] = Field(default=None)
    webhook_url: Optional[str] = Field(default=None)
    webhook_secret: Optional[str] = Field(default=None)
    limit: int = Field(default=100, ge=1, le=1000)


class GoogleMapsRequest(BaseRequest):
    query: str
    location: str


class CnpjRequest(BaseRequest):
    cnpj: str | List[str]


class QueryRequest(BaseRequest):
    query: str
    location: Optional[str] = None


class UrlsRequest(BaseRequest):
    urls: str | List[str]


@app.on_event("startup")
async def _startup() -> None:
    await browser_manager.start()


@app.on_event("shutdown")
async def _shutdown() -> None:
    await browser_manager.close()


def _resolve_webhook_url(value: Optional[str]) -> Optional[str]:
    return value or BACKEND_WEBHOOK_URL or None


def _resolve_webhook_secret(value: Optional[str]) -> Optional[str]:
    return value or SCRAPING_WEBHOOK_SECRET or None


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
        "source": job.source,
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


@app.post("/scrape/google-maps")
async def scrape_google_maps(payload: GoogleMapsRequest) -> dict:
    job = await job_store.create("google_maps", payload.model_dump(), job_id=payload.job_id)
    asyncio.create_task(
        run_with_limit(
            google_maps.scrape(
                query=payload.query,
                location=payload.location,
                limit=payload.limit,
                job_id=job.id,
                webhook_url=_resolve_webhook_url(payload.webhook_url),
                webhook_secret=_resolve_webhook_secret(payload.webhook_secret),
            )
        )
    )
    return {"job_id": job.id, "status": "started"}


@app.post("/scrape/cnpj")
async def scrape_cnpj(payload: CnpjRequest) -> dict:
    job = await job_store.create("cnpj", payload.model_dump(), job_id=payload.job_id)
    asyncio.create_task(
        run_with_limit(
            cnpj.scrape(
                cnpj=payload.cnpj,
                limit=payload.limit,
                job_id=job.id,
                webhook_url=_resolve_webhook_url(payload.webhook_url),
                webhook_secret=_resolve_webhook_secret(payload.webhook_secret),
            )
        )
    )
    return {"job_id": job.id, "status": "started"}


@app.post("/scrape/reclame-aqui")
async def scrape_reclame_aqui(payload: QueryRequest) -> dict:
    job = await job_store.create("reclame_aqui", payload.model_dump(), job_id=payload.job_id)
    asyncio.create_task(
        run_with_limit(
            reclame_aqui.scrape(
                query=payload.query,
                limit=payload.limit,
                job_id=job.id,
                webhook_url=_resolve_webhook_url(payload.webhook_url),
                webhook_secret=_resolve_webhook_secret(payload.webhook_secret),
            )
        )
    )
    return {"job_id": job.id, "status": "started"}


@app.post("/scrape/indeed")
async def scrape_indeed(payload: QueryRequest) -> dict:
    if not payload.location:
        raise HTTPException(status_code=400, detail="location is required")
    job = await job_store.create("indeed", payload.model_dump(), job_id=payload.job_id)
    asyncio.create_task(
        run_with_limit(
            indeed.scrape(
                query=payload.query,
                location=payload.location,
                limit=payload.limit,
                job_id=job.id,
                webhook_url=_resolve_webhook_url(payload.webhook_url),
                webhook_secret=_resolve_webhook_secret(payload.webhook_secret),
            )
        )
    )
    return {"job_id": job.id, "status": "started"}


@app.post("/scrape/catho")
async def scrape_catho(payload: QueryRequest) -> dict:
    if not payload.location:
        raise HTTPException(status_code=400, detail="location is required")
    job = await job_store.create("catho", payload.model_dump(), job_id=payload.job_id)
    asyncio.create_task(
        run_with_limit(
            catho.scrape(
                query=payload.query,
                location=payload.location,
                limit=payload.limit,
                job_id=job.id,
                webhook_url=_resolve_webhook_url(payload.webhook_url),
                webhook_secret=_resolve_webhook_secret(payload.webhook_secret),
            )
        )
    )
    return {"job_id": job.id, "status": "started"}


@app.post("/scrape/mercado-livre")
async def scrape_mercado_livre(payload: QueryRequest) -> dict:
    job = await job_store.create("mercado_livre", payload.model_dump(), job_id=payload.job_id)
    asyncio.create_task(
        run_with_limit(
            mercado_livre.scrape(
                query=payload.query,
                limit=payload.limit,
                job_id=job.id,
                webhook_url=_resolve_webhook_url(payload.webhook_url),
                webhook_secret=_resolve_webhook_secret(payload.webhook_secret),
            )
        )
    )
    return {"job_id": job.id, "status": "started"}


@app.post("/scrape/wappalyzer")
async def scrape_wappalyzer(payload: UrlsRequest) -> dict:
    job = await job_store.create("wappalyzer", payload.model_dump(), job_id=payload.job_id)
    asyncio.create_task(
        run_with_limit(
            wappalyzer.scrape(
                urls=payload.urls,
                limit=payload.limit,
                job_id=job.id,
                webhook_url=_resolve_webhook_url(payload.webhook_url),
                webhook_secret=_resolve_webhook_secret(payload.webhook_secret),
            )
        )
    )
    return {"job_id": job.id, "status": "started"}


@app.post("/scrape/linkedin-dork")
async def scrape_linkedin_dork(payload: QueryRequest) -> dict:
    job = await job_store.create("linkedin_dork", payload.model_dump(), job_id=payload.job_id)
    asyncio.create_task(
        run_with_limit(
            linkedin_dork.scrape(
                query=payload.query,
                limit=payload.limit,
                job_id=job.id,
                webhook_url=_resolve_webhook_url(payload.webhook_url),
                webhook_secret=_resolve_webhook_secret(payload.webhook_secret),
            )
        )
    )
    return {"job_id": job.id, "status": "started"}


@app.post("/scrape/comprasnet")
async def scrape_comprasnet(payload: QueryRequest) -> dict:
    job = await job_store.create("comprasnet", payload.model_dump(), job_id=payload.job_id)
    asyncio.create_task(
        run_with_limit(
            comprasnet.scrape(
                query=payload.query,
                limit=payload.limit,
                job_id=job.id,
                webhook_url=_resolve_webhook_url(payload.webhook_url),
                webhook_secret=_resolve_webhook_secret(payload.webhook_secret),
            )
        )
    )
    return {"job_id": job.id, "status": "started"}
