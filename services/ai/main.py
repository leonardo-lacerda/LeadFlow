import asyncio
import logging
from typing import Any, Dict, List, Optional
from urllib.parse import urlparse

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field

from core.cache import TTLCache
from core.config import AI_CACHE_TTL, AI_WEBHOOK_SECRET, BACKEND_WEBHOOK_URL, PROMPT_STORE_PATH
from core.jobs import job_store
from core.progress import ProgressReporter
from core.prompts import PromptStore
from core.runner import run_with_limit
from core.usage import UsageTracker
from engine import AIEngine
from utils import (
    build_company_summary,
    build_lead_summary,
    extract_json,
    render_template,
    safe_float,
    safe_int,
)

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(title="Lastreia AI Service")

usage_tracker = UsageTracker()
engine = AIEngine(TTLCache(AI_CACHE_TTL), usage_tracker)
prompt_store = PromptStore(PROMPT_STORE_PATH)


class BaseRequest(BaseModel):
    job_id: Optional[str] = Field(default=None)
    webhook_url: Optional[str] = Field(default=None)
    webhook_secret: Optional[str] = Field(default=None)
    provider_order: Optional[List[str]] = Field(default=None)
    org_id: Optional[str] = Field(default=None)
    temperature: float = Field(default=0.2)
    max_tokens: int = Field(default=512)
    cache_key: Optional[str] = Field(default=None)


class ScoreRequest(BaseRequest):
    lead: Dict[str, Any]
    icp: Optional[Dict[str, Any]] = None
    prompt_id: Optional[str] = None
    variables: Optional[Dict[str, Any]] = None


class ScoreBulkRequest(BaseRequest):
    leads: List[Dict[str, Any]]
    icp: Optional[Dict[str, Any]] = None
    prompt_id: Optional[str] = None
    variables: Optional[Dict[str, Any]] = None


class GenerateRequest(BaseRequest):
    type: str
    lead: Dict[str, Any]
    company: Optional[Dict[str, Any]] = None
    tone: Optional[str] = "friendly"
    language: Optional[str] = "pt-BR"
    variants: int = 1
    prompt_id: Optional[str] = None
    variables: Optional[Dict[str, Any]] = None


class AnalyzeRequest(BaseRequest):
    message: str
    tone: Optional[str] = "neutral"
    language: Optional[str] = "pt-BR"
    prompt_id: Optional[str] = None
    variables: Optional[Dict[str, Any]] = None


class PromptCreateRequest(BaseModel):
    name: str
    content: str
    variables: Optional[List[str]] = None
    description: Optional[str] = None
    category: Optional[str] = None


class PromptUpdateRequest(BaseModel):
    name: Optional[str] = None
    content: Optional[str] = None
    variables: Optional[List[str]] = None
    description: Optional[str] = None
    category: Optional[str] = None


@app.on_event("startup")
async def _startup() -> None:
    await prompt_store.load()
    await prompt_store.ensure_defaults()


def _resolve_webhook_url(value: Optional[str]) -> Optional[str]:
    return value or BACKEND_WEBHOOK_URL or None


def _normalize_webhook_target(value: Optional[str]) -> Optional[str]:
    if not value:
        return None
    try:
        parsed = urlparse(value.strip())
    except ValueError:
        return None

    if not parsed.scheme or not parsed.netloc:
        return None

    path = parsed.path.rstrip("/") or "/"
    return f"{parsed.scheme.lower()}://{parsed.netloc.lower()}{path}"


def _resolve_webhook_secret(value: Optional[str], webhook_url: Optional[str]) -> Optional[str]:
    if value:
        return value

    resolved_target = _normalize_webhook_target(_resolve_webhook_url(webhook_url))
    default_target = _normalize_webhook_target(BACKEND_WEBHOOK_URL)
    if resolved_target and default_target and resolved_target == default_target:
        return AI_WEBHOOK_SECRET or None

    return None


def _lead_summary(lead: Dict[str, Any]) -> str:
    return build_lead_summary(lead)


def _icp_summary(icp: Optional[Dict[str, Any]]) -> str:
    if not icp:
        return "Not provided"
    parts = []
    for key, value in icp.items():
        if value is None:
            continue
        parts.append(f"{key}: {value}")
    return "\n".join(parts) if parts else "Not provided"


def _company_summary(lead: Dict[str, Any], company: Optional[Dict[str, Any]]) -> str:
    if company:
        return build_company_summary(company)
    fallback = {
        "name": lead.get("companyName"),
        "domain": lead.get("companyDomain"),
        "size": lead.get("companySize"),
        "industry": lead.get("industry"),
    }
    return build_company_summary(fallback)


async def _get_prompt(prompt_id: Optional[str], name: str) -> str:
    prompts = await prompt_store.list()
    if prompt_id:
        for prompt in prompts:
            if prompt.id == prompt_id or prompt.name == prompt_id:
                return prompt.content
    for prompt in prompts:
        if prompt.name == name:
            return prompt.content
    raise HTTPException(status_code=404, detail="Prompt not found")


def _heuristic_score(lead: Dict[str, Any], icp: Optional[Dict[str, Any]]) -> Dict[str, Any]:
    score = 30
    tags: List[str] = []
    if lead.get("email"):
        score += 15
    if lead.get("companyName"):
        score += 10
        tags.append("company_known")
    if lead.get("jobTitle"):
        score += 10
    if lead.get("linkedinUrl"):
        score += 10
    if lead.get("companySize"):
        score += 10
    if lead.get("industry"):
        tags.append(str(lead.get("industry")))
    icp_match = min(1.0, score / 100)
    if icp and icp.get("industry") and lead.get("industry") == icp.get("industry"):
        icp_match = min(1.0, icp_match + 0.1)
    return {
        "score": min(100, score),
        "icp_match": icp_match,
        "explanation": "Heuristic score based on available lead data.",
        "tags": tags,
    }


async def _score_lead(payload: ScoreRequest) -> Dict[str, Any]:
    variables = payload.variables or {}
    variables.update(
        {
            "lead_summary": _lead_summary(payload.lead),
            "icp_summary": _icp_summary(payload.icp),
        }
    )

    prompt = await _get_prompt(payload.prompt_id, "lead_scoring")
    rendered = render_template(prompt, variables)

    result = await engine.generate(
        rendered,
        temperature=payload.temperature,
        max_tokens=payload.max_tokens,
        provider_order=payload.provider_order,
        org_id=payload.org_id or "anonymous",
        cache_key=payload.cache_key,
    )

    parsed = extract_json(result.get("text", ""))
    if not parsed:
        parsed = _heuristic_score(payload.lead, payload.icp)

    return {
        "score": safe_int(parsed.get("score"), 0),
        "icp_match": safe_float(parsed.get("icp_match"), 0.0),
        "explanation": parsed.get("explanation") or "",
        "tags": parsed.get("tags") or [],
        "provider": result.get("provider"),
        "model": result.get("model"),
        "usage": result.get("usage"),
        "cached": result.get("cached"),
    }


async def _generate_message(payload: GenerateRequest) -> Dict[str, Any]:
    variables = payload.variables or {}
    variables.update(
        {
            "lead_summary": _lead_summary(payload.lead),
            "company_summary": _company_summary(payload.lead, payload.company),
            "tone": payload.tone or "friendly",
            "language": payload.language or "pt-BR",
            "variants": payload.variants,
        }
    )

    prompt_name = "email_generation" if payload.type.lower() == "email" else "whatsapp_generation"
    prompt = await _get_prompt(payload.prompt_id, prompt_name)
    rendered = render_template(prompt, variables)

    if payload.variants > 1:
        rendered += f"\n\nGenerate {payload.variants} variants and return JSON with key 'variants'."

    result = await engine.generate(
        rendered,
        temperature=payload.temperature,
        max_tokens=payload.max_tokens,
        provider_order=payload.provider_order,
        org_id=payload.org_id or "anonymous",
        cache_key=payload.cache_key,
    )

    parsed = extract_json(result.get("text", ""))
    variants = parsed.get("variants") if isinstance(parsed.get("variants"), list) else None

    if payload.type.lower() == "email":
        if variants:
            responses = [
                {"subject": item.get("subject", ""), "body": item.get("body", "")} for item in variants
            ]
        else:
            responses = [
                {
                    "subject": parsed.get("subject", ""),
                    "body": parsed.get("body", parsed.get("message", "")),
                }
            ]
    else:
        if variants:
            responses = [{"message": item.get("message", "")} for item in variants]
        else:
            responses = [{"message": parsed.get("message", result.get("text", ""))}]

    return {
        "variants": responses,
        "provider": result.get("provider"),
        "model": result.get("model"),
        "usage": result.get("usage"),
        "cached": result.get("cached"),
    }


async def _analyze_message(prompt_name: str, payload: AnalyzeRequest) -> Dict[str, Any]:
    variables = payload.variables or {}
    variables.update(
        {
            "message": payload.message,
            "tone": payload.tone or "neutral",
            "language": payload.language or "pt-BR",
        }
    )

    prompt = await _get_prompt(payload.prompt_id, prompt_name)
    rendered = render_template(prompt, variables)

    result = await engine.generate(
        rendered,
        temperature=payload.temperature,
        max_tokens=payload.max_tokens,
        provider_order=payload.provider_order,
        org_id=payload.org_id or "anonymous",
        cache_key=payload.cache_key,
    )

    parsed = extract_json(result.get("text", ""))
    return {
        "result": parsed,
        "provider": result.get("provider"),
        "model": result.get("model"),
        "usage": result.get("usage"),
        "cached": result.get("cached"),
    }


@app.get("/health")
async def health() -> Dict[str, str]:
    return {"status": "ok"}


@app.get("/usage")
async def usage(org_id: Optional[str] = None) -> Dict[str, Any]:
    return {"usage": await usage_tracker.snapshot(org_id)}


@app.get("/jobs/{job_id}")
async def get_job(job_id: str) -> Dict[str, Any]:
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


@app.get("/prompts")
async def list_prompts() -> Dict[str, Any]:
    prompts = await prompt_store.list()
    return {"data": [prompt.to_dict() for prompt in prompts]}


@app.get("/prompts/{prompt_id}")
async def get_prompt(prompt_id: str) -> Dict[str, Any]:
    prompt = await prompt_store.get(prompt_id)
    if not prompt:
        raise HTTPException(status_code=404, detail="Prompt not found")
    return {"data": prompt.to_dict()}


@app.post("/prompts")
async def create_prompt(payload: PromptCreateRequest) -> Dict[str, Any]:
    prompt = await prompt_store.create(
        name=payload.name,
        content=payload.content,
        variables=payload.variables or [],
        description=payload.description,
        category=payload.category,
    )
    return {"data": prompt.to_dict()}


@app.put("/prompts/{prompt_id}")
async def update_prompt(prompt_id: str, payload: PromptUpdateRequest) -> Dict[str, Any]:
    prompt = await prompt_store.update(
        prompt_id,
        name=payload.name,
        content=payload.content,
        variables=payload.variables,
        description=payload.description,
        category=payload.category,
    )
    if not prompt:
        raise HTTPException(status_code=404, detail="Prompt not found")
    return {"data": prompt.to_dict()}


@app.delete("/prompts/{prompt_id}")
async def delete_prompt(prompt_id: str) -> Dict[str, Any]:
    removed = await prompt_store.delete(prompt_id)
    if not removed:
        raise HTTPException(status_code=404, detail="Prompt not found")
    return {"success": True}


@app.post("/score")
async def score(payload: ScoreRequest) -> Dict[str, Any]:
    result = await _score_lead(payload)
    return {"data": result}


@app.post("/score/bulk")
async def score_bulk(payload: ScoreBulkRequest) -> Dict[str, Any]:
    job = await job_store.create({"leads": payload.leads}, job_id=payload.job_id)
    webhook_url = _resolve_webhook_url(payload.webhook_url)
    webhook_secret = _resolve_webhook_secret(payload.webhook_secret, payload.webhook_url)
    reporter = ProgressReporter(job.id, webhook_url, webhook_secret)

    async def _task() -> None:
        try:
            total = len(payload.leads)
            await reporter.start(total_items=total)
            counter = 0
            counter_lock = asyncio.Lock()
            results: List[Dict[str, Any]] = []

            async def _run(lead_item: Dict[str, Any]) -> Dict[str, Any]:
                request = ScoreRequest(
                    lead=lead_item,
                    icp=payload.icp,
                    prompt_id=payload.prompt_id,
                    variables=payload.variables,
                    provider_order=payload.provider_order,
                    org_id=payload.org_id,
                    temperature=payload.temperature,
                    max_tokens=payload.max_tokens,
                    cache_key=payload.cache_key,
                )
                return await _score_lead(request)

            async def _wrapped(lead_item: Dict[str, Any]) -> None:
                nonlocal counter
                result = await _run(lead_item)
                results.append({"leadId": lead_item.get("id"), **result})
                async with counter_lock:
                    counter += 1
                    await reporter.update(counter)

            tasks = [run_with_limit(_wrapped(lead)) for lead in payload.leads]
            await asyncio.gather(*tasks)
            await reporter.finish(results)
        except Exception as exc:
            logger.exception("Bulk scoring failed")
            await reporter.fail(str(exc))

    asyncio.create_task(_task())
    return {"job_id": job.id, "status": "started"}


@app.post("/generate")
async def generate(payload: GenerateRequest) -> Dict[str, Any]:
    result = await _generate_message(payload)
    return {"data": result}


@app.post("/generate/email")
async def generate_email(payload: GenerateRequest) -> Dict[str, Any]:
    payload.type = "email"
    result = await _generate_message(payload)
    return {"data": result}


@app.post("/generate/whatsapp")
async def generate_whatsapp(payload: GenerateRequest) -> Dict[str, Any]:
    payload.type = "whatsapp"
    result = await _generate_message(payload)
    return {"data": result}


@app.post("/analyze/intent")
async def analyze_intent(payload: AnalyzeRequest) -> Dict[str, Any]:
    return {"data": await _analyze_message("intent_classification", payload)}


@app.post("/analyze/sentiment")
async def analyze_sentiment(payload: AnalyzeRequest) -> Dict[str, Any]:
    return {"data": await _analyze_message("sentiment_analysis", payload)}


@app.post("/analyze/categorize")
async def analyze_categorize(payload: AnalyzeRequest) -> Dict[str, Any]:
    return {"data": await _analyze_message("auto_categorization", payload)}


@app.post("/analyze/suggest")
async def analyze_suggest(payload: AnalyzeRequest) -> Dict[str, Any]:
    return {"data": await _analyze_message("suggested_response", payload)}


@app.post("/analyze/meeting")
async def analyze_meeting(payload: AnalyzeRequest) -> Dict[str, Any]:
    return {"data": await _analyze_message("meeting_detection", payload)}


@app.post("/predict/best-time")
async def predict_best_time(payload: AnalyzeRequest) -> Dict[str, Any]:
    return {"data": await _analyze_message("best_time_prediction", payload)}


@app.post("/optimize/subject")
async def optimize_subject(payload: AnalyzeRequest) -> Dict[str, Any]:
    return {"data": await _analyze_message("subject_optimization", payload)}


@app.post("/optimize/length")
async def optimize_length(payload: AnalyzeRequest) -> Dict[str, Any]:
    return {"data": await _analyze_message("length_optimization", payload)}


@app.post("/predict/engagement")
async def predict_engagement(payload: AnalyzeRequest) -> Dict[str, Any]:
    return {"data": await _analyze_message("engagement_prediction", payload)}
