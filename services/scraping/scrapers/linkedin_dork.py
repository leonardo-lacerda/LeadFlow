import logging
import re
from typing import Any, Dict, List, Optional
from urllib.parse import unquote, urlparse

from core.config import SCRAPING_MOCK, SCRAPING_NO_API, SERPAPI_KEY
from core.http import get_json
from core.progress import ProgressReporter
from core.proxy import proxy_manager
from core.rate_limiter import RateLimiter
from .contact_utils import dedupe_tags, normalize_url
from .mock import make_mock_leads
from .search import web_search

logger = logging.getLogger(__name__)
limiter = RateLimiter(rpm=20)
_LOW_VALUE_NAMES = {
    "read more",
    "about",
    "linkedin",
    "experience",
}


def _clean_title(value: str) -> str:
    cleaned = re.sub(r"([a-z])([A-ZÀ-ÖØ-Þ])", r"\1 \2", value).strip()
    cleaned = re.sub(r"\s+-\s+Linked\s*In.*$", "", cleaned, flags=re.IGNORECASE).strip()
    cleaned = re.sub(r"\|\s*Linked\s*In.*$", "", cleaned, flags=re.IGNORECASE).strip()
    cleaned = re.sub(
        r"^.*?›\s*(?:in|company)\s*›\s*[^\s]+\s+",
        "",
        cleaned,
        flags=re.IGNORECASE,
    ).strip()
    return cleaned or value


def _extract_company_from_name(value: str) -> Optional[str]:
    match = re.search(r"\bat\s+(.+)$", value, flags=re.IGNORECASE)
    if match:
        company = match.group(1).strip(" -|")
        if company:
            return company
    return None


def _is_low_value_name(value: Optional[str]) -> bool:
    normalized = re.sub(r"\s+", " ", value or "").strip().lower()
    if not normalized:
        return True
    if normalized in _LOW_VALUE_NAMES:
        return True
    if "." in normalized and " " not in normalized:
        return True
    return False


def _slug_to_label(value: str) -> str:
    slug = unquote(value or "").strip("/").strip().lower()
    if not slug:
        return ""
    tokens = [token for token in re.split(r"[-_]+", slug) if token]
    if len(tokens) > 1 and re.fullmatch(r"[a-f0-9]{6,}", tokens[-1]):
        tokens = tokens[:-1]
    if not tokens:
        return ""
    return " ".join(token.capitalize() for token in tokens)


def _is_linkedin_profile_url(value: Optional[str]) -> bool:
    normalized = normalize_url(value)
    if not normalized:
        return False
    parsed = urlparse(normalized)
    host = (parsed.hostname or "").lower()
    if host.startswith("www."):
        host = host[4:]
    if host != "linkedin.com" and not host.endswith(".linkedin.com"):
        return False
    path = (parsed.path or "").lower()
    return "/in/" in path or "/company/" in path


def _canonical_linkedin_url(value: Optional[str]) -> Optional[str]:
    normalized = normalize_url(value)
    if not normalized or not _is_linkedin_profile_url(normalized):
        return None
    parsed = urlparse(normalized)
    host = (parsed.hostname or "").lower()
    if host.startswith("www."):
        host = host[4:]
    path = re.sub(r"/+$", "", parsed.path or "")
    return f"https://{host}{path}"


def _infer_identity_from_url(url: str) -> Dict[str, Optional[str]]:
    parsed = urlparse(url)
    parts = [part for part in parsed.path.split("/") if part]
    for marker in ("in", "company"):
        if marker in parts:
            idx = parts.index(marker)
            if idx + 1 >= len(parts):
                break
            label = _slug_to_label(parts[idx + 1])
            if not label:
                break
            if marker == "company":
                return {
                    "full_name": None,
                    "company_name": label,
                }
            return {
                "full_name": label,
                "company_name": None,
            }
    return {"full_name": None, "company_name": None}


async def scrape(
    query: str,
    limit: int,
    job_id: str,
    webhook_url: Optional[str] = None,
    webhook_secret: Optional[str] = None,
) -> None:
    reporter = ProgressReporter(job_id, webhook_url, webhook_secret)
    progress_total = max(1, limit)
    processed_items = 0
    pending_leads: List[Dict[str, Any]] = []
    streamed_leads = False

    await reporter.start(total_items=progress_total)

    async def publish_progress(force: bool = False, flush_leads: bool = False) -> None:
        nonlocal pending_leads, streamed_leads
        leads_chunk = pending_leads if flush_leads and pending_leads else None
        await reporter.update(
            processed_items=processed_items,
            total_items=progress_total,
            force=force,
            leads=leads_chunk,
        )
        if leads_chunk:
            streamed_leads = True
            pending_leads = []

    try:
        leads: List[Dict[str, Any]]
        if SCRAPING_MOCK:
            leads = make_mock_leads("linkedin_dork", query or "LinkedIn", limit)
        elif SCRAPING_NO_API:
            proxy = await proxy_manager.next_proxy()
            leads = []
            seen = set()
            search_queries = [
                f"site:linkedin.com/in/ {query}".strip(),
                f"site:linkedin.com/company {query}".strip(),
            ]
            progress_total = max(1, len(search_queries))
            await publish_progress(force=True)
            for search_query in search_queries:
                results = await web_search(search_query, limit=max(limit * 2, 10), proxy=proxy)
                progress_total += max(len(results), 1)
                await publish_progress(force=True)
                for result in results:
                    processed_items = min(progress_total, processed_items + 1)
                    await publish_progress()

                    source_url = _canonical_linkedin_url(result.get("url"))
                    if not source_url:
                        continue
                    if source_url in seen:
                        continue
                    seen.add(source_url)

                    inferred = _infer_identity_from_url(source_url)
                    full_name = _clean_title(result.get("title") or "")
                    if _is_low_value_name(full_name):
                        full_name = inferred.get("full_name") or ""
                    company_name = _extract_company_from_name(full_name)
                    if not company_name:
                        company_name = inferred.get("company_name")
                    if _is_low_value_name(full_name):
                        full_name = None
                    if not full_name and not company_name:
                        continue

                    leads.append(
                        {
                            "fullName": full_name,
                            "companyName": company_name,
                            "linkedinUrl": source_url,
                            "source": "linkedin_dork",
                            "sourceUrl": source_url,
                            "tags": dedupe_tags(["has_linkedin"], source_tag="linkedin"),
                        }
                    )
                    pending_leads.append(leads[-1])
                    if len(pending_leads) >= 3:
                        await publish_progress(force=True, flush_leads=True)
                    if len(leads) >= limit:
                        break
                if len(leads) >= limit:
                    break
        else:
            if not SERPAPI_KEY:
                raise RuntimeError("SERPAPI_KEY not set for LinkedIn dorking")
            async with limiter:
                proxy = await proxy_manager.next_proxy()
                data = await get_json(
                    "https://serpapi.com/search.json",
                    params={
                        "engine": "google",
                        "q": f"site:linkedin.com/in/ {query}".strip(),
                        "api_key": SERPAPI_KEY,
                    },
                    proxy=proxy,
                )
            results = data.get("organic_results", [])[: limit * 2]
            progress_total = max(1, len(results))
            await publish_progress(force=True)
            leads = []
            seen = set()
            for item in results:
                processed_items = min(progress_total, processed_items + 1)
                await publish_progress()

                link = _canonical_linkedin_url(item.get("link"))
                if not link or link in seen:
                    continue
                seen.add(link)
                inferred = _infer_identity_from_url(link)
                full_name = _clean_title(item.get("title") or "")
                if _is_low_value_name(full_name):
                    full_name = inferred.get("full_name") or ""
                company_name = _extract_company_from_name(full_name)
                if not company_name:
                    company_name = inferred.get("company_name")
                if _is_low_value_name(full_name):
                    full_name = None
                if not full_name and not company_name:
                    continue

                leads.append(
                    {
                        "fullName": full_name,
                        "companyName": company_name,
                        "linkedinUrl": link,
                        "source": "linkedin_dork",
                        "sourceUrl": link,
                        "tags": dedupe_tags(["has_linkedin"], source_tag="linkedin"),
                    }
                )
                pending_leads.append(leads[-1])
                if len(pending_leads) >= 3:
                    await publish_progress(force=True, flush_leads=True)
                if len(leads) >= limit:
                    break

        await publish_progress(flush_leads=True)
        mode = "mock" if SCRAPING_MOCK else ("no_api" if SCRAPING_NO_API else "serpapi")
        debug = {
            "mode": mode,
            "requestedLimit": limit,
            "finalLeadCount": len(leads),
        }
        await reporter.finish(leads, debug=debug, send_leads=not streamed_leads)
    except Exception as exc:
        logger.exception("LinkedIn dork scrape failed")
        await reporter.fail(str(exc))
