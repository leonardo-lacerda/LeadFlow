import logging
import re
from urllib.parse import parse_qs
from typing import Any, Dict, List, Optional
from urllib.parse import urlparse

from core.config import SCRAPING_MOCK
from core.progress import ProgressReporter
from core.proxy import proxy_manager
from core.rate_limiter import RateLimiter
from .contact_utils import dedupe_tags, fetch_contact_profile, normalize_url, sanitize_contact_profile
from .mock import make_mock_leads
from .search import web_search

logger = logging.getLogger(__name__)
limiter = RateLimiter(rpm=20)
_LOW_VALUE_TITLES = {"read more", "translate this page", "about"}


def _clean_title(value: str) -> str:
    cleaned = re.sub(r"\s*-\s*ComprasNet.*$", "", value, flags=re.IGNORECASE).strip()
    cleaned = re.sub(r"\s*-\s*GOV\.BR.*$", "", cleaned, flags=re.IGNORECASE).strip()
    cleaned = re.sub(r"\s+", " ", cleaned).strip(" -|")
    return cleaned or value


def _is_low_value_title(value: Optional[str]) -> bool:
    normalized = re.sub(r"\s+", " ", value or "").strip().lower()
    if not normalized:
        return True
    if normalized in _LOW_VALUE_TITLES:
        return True
    if "compras.gov.br" in normalized or "comprasnet.gov.br" in normalized:
        return True
    if "consultalicitacoes" in normalized or "download" in normalized or "legislacao" in normalized:
        return True
    if normalized.startswith("![image") or normalized.startswith("image "):
        return True
    if "." in normalized and " " not in normalized:
        return True
    return False


def _name_from_source_url(value: Optional[str]) -> Optional[str]:
    source_url = normalize_url(value)
    if not source_url:
        return None
    parsed = urlparse(source_url)
    query = parse_qs(parsed.query or "")
    coduasg = ((query.get("coduasg") or [None])[0] or "").strip()
    numprp = ((query.get("numprp") or [None])[0] or "").strip()
    modprp = ((query.get("modprp") or [None])[0] or "").strip()
    if coduasg or numprp:
        label_parts = ["Licitacao"]
        if modprp:
            label_parts.append(f"Modalidade {modprp}")
        if coduasg:
            label_parts.append(f"UASG {coduasg}")
        if numprp:
            label_parts.append(f"Processo {numprp}")
        return " - ".join(label_parts)
    parts = [part for part in parsed.path.split("/") if part]
    if not parts:
        return None
    leaf = parts[-1]
    leaf = re.sub(r"\.asp$", "", leaf, flags=re.IGNORECASE)
    leaf = re.sub(r"[_\-]+", " ", leaf).strip()
    leaf = re.sub(r"\s+", " ", leaf).title()
    return leaf or None


def _resolve_company_name(title: str, source_url: Optional[str], profile_title: Optional[str]) -> Optional[str]:
    candidate = _clean_title(title)
    if _is_low_value_title(candidate):
        candidate = _clean_title(profile_title or "")
    if _is_low_value_title(candidate):
        candidate = _name_from_source_url(source_url) or ""
    if _is_low_value_title(candidate):
        return None
    return candidate


def _build_tags(email: Optional[str], phone: Optional[str], linkedin_url: Optional[str]) -> List[str]:
    tags = []
    if email:
        tags.append("has_email")
    if phone:
        tags.append("has_phone")
    if linkedin_url:
        tags.append("has_linkedin")
    return dedupe_tags(tags, source_tag="comprasnet")


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
            leads = make_mock_leads("comprasnet", query or "ComprasNet", limit)
        else:
            proxy = await proxy_manager.next_proxy()
            search_queries = [
                f"site:comprasnet.gov.br {query}".strip(),
                f"site:gov.br/compras {query}".strip(),
            ]
            leads = []
            seen = set()
            profile_budget = min(limit, 4)

            for search_query in search_queries:
                async with limiter:
                    results = await web_search(search_query, limit=max(limit * 2, 10), proxy=proxy)
                progress_total += max(len(results), 1)
                await publish_progress(force=True)

                for result in results:
                    processed_items = min(progress_total, processed_items + 1)
                    await publish_progress()

                    source_url = normalize_url(result.get("url"))
                    title = _clean_title(result.get("title") or "")
                    if source_url and "comprasnet.gov.br" not in source_url and "gov.br" not in source_url:
                        continue
                    dedupe_key = source_url or title.lower()
                    if not dedupe_key or dedupe_key in seen:
                        continue
                    seen.add(dedupe_key)

                    profile = {
                        "email": None,
                        "phone": None,
                        "socials": {},
                        "domain": None,
                        "title": None,
                        "emails": [],
                        "phones": [],
                    }
                    if source_url and profile_budget > 0:
                        profile_budget -= 1
                        profile = await fetch_contact_profile(source_url, proxy=proxy)
                    profile = sanitize_contact_profile(
                        profile,
                        blocked_domains=["comprasnet.gov.br", "gov.br"],
                    )

                    company_name = _resolve_company_name(title, source_url, profile.get("title"))
                    if not company_name:
                        continue

                    socials = profile.get("socials") or {}
                    linkedin_url = socials.get("linkedin") if isinstance(socials, dict) else None
                    leads.append(
                        {
                            "companyName": company_name,
                            "email": profile.get("email"),
                            "phone": profile.get("phone"),
                            "linkedinUrl": linkedin_url,
                            "companyDomain": profile.get("domain"),
                            "source": "comprasnet",
                            "sourceUrl": source_url,
                            "tags": _build_tags(
                                profile.get("email"),
                                profile.get("phone"),
                                linkedin_url,
                            ),
                            "enrichmentData": {
                                "socials": socials,
                                "contacts": {
                                    "emails": profile.get("emails") or [],
                                    "phones": profile.get("phones") or [],
                                },
                            },
                        }
                    )
                    pending_leads.append(leads[-1])
                    if len(pending_leads) >= 3:
                        await publish_progress(force=True, flush_leads=True)
                    if len(leads) >= limit:
                        break
                if len(leads) >= limit:
                    break

        await publish_progress(flush_leads=True)
        debug = {
            "mode": "mock" if SCRAPING_MOCK else "live",
            "requestedLimit": limit,
            "finalLeadCount": len(leads),
        }
        await reporter.finish(leads, debug=debug, send_leads=not streamed_leads)
    except Exception as exc:
        logger.exception("ComprasNet scrape failed")
        await reporter.fail(str(exc))
