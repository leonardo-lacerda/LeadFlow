import logging
import re
from typing import Any, Dict, List, Optional
from urllib.parse import quote_plus, urlparse

from bs4 import BeautifulSoup

from core.config import SCRAPING_MOCK
from core.http import get_text
from core.progress import ProgressReporter
from core.proxy import proxy_manager
from core.rate_limiter import RateLimiter
from .contact_utils import (
    dedupe_tags,
    extract_domain,
    fetch_contact_profile,
    normalize_url,
    sanitize_contact_profile,
)
from .mock import make_mock_leads
from .search import web_search

logger = logging.getLogger(__name__)
limiter = RateLimiter(rpm=30)


def _clean_title(value: str) -> str:
    cleaned = re.sub(r"\s*-\s*Reclame\s+Aqui.*$", "", value, flags=re.IGNORECASE).strip()
    return cleaned or value


def _slug_to_name(value: str) -> str:
    slug = re.sub(r"[-_]+", " ", value).strip()
    return re.sub(r"\s+", " ", slug).title()


def _canonical_company_url(value: Optional[str]) -> Optional[str]:
    source_url = normalize_url(value)
    if not source_url:
        return None
    parsed = urlparse(source_url)
    parts = [part for part in parsed.path.split("/") if part]
    if len(parts) < 2 or parts[0] != "empresa":
        return None
    slug = parts[1]
    return f"{parsed.scheme}://{parsed.netloc}/empresa/{slug}/"


def _company_from_source(source_url: Optional[str], fallback_title: str) -> str:
    canonical = _canonical_company_url(source_url)
    if canonical:
        parsed = urlparse(canonical)
        parts = [part for part in parsed.path.split("/") if part]
        if len(parts) >= 2 and parts[1]:
            return _slug_to_name(parts[1])
    return _clean_title(fallback_title)


def _build_tags(email: Optional[str], phone: Optional[str], linkedin_url: Optional[str]) -> List[str]:
    tags = []
    if email:
        tags.append("has_email")
    if phone:
        tags.append("has_phone")
    if linkedin_url:
        tags.append("has_linkedin")
    return dedupe_tags(tags, source_tag="reclame_aqui")


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
            leads = make_mock_leads("reclame_aqui", query or "Reclame Aqui", min(limit, 10))
        else:
            leads = []
            seen = set()
            proxy = await proxy_manager.next_proxy()
            profile_budget = min(limit, 5)

            # Primary strategy: direct scraping
            url = f"https://www.reclameaqui.com.br/busca/?q={quote_plus(query)}"
            try:
                async with limiter:
                    html = await get_text(url, proxy=proxy)
                soup = BeautifulSoup(html, "lxml")
                company_links = soup.select("a[href*='/empresa/']")
                progress_total = max(1, len(company_links))
                await publish_progress(force=True)
                for link in company_links:
                    processed_items = min(progress_total, processed_items + 1)
                    await publish_progress()

                    name = (link.get_text() or "").strip()
                    href = link.get("href") or ""
                    source_url = _canonical_company_url(
                        f"https://www.reclameaqui.com.br{href}" if href.startswith("/") else href
                    )
                    if not name or not source_url or source_url in seen:
                        continue

                    seen.add(source_url)
                    profile = {
                        "email": None,
                        "phone": None,
                        "socials": {},
                        "domain": None,
                        "title": None,
                        "emails": [],
                        "phones": [],
                        "url": source_url,
                    }
                    if profile_budget > 0:
                        profile_budget -= 1
                        profile = await fetch_contact_profile(source_url, proxy=proxy)
                    profile = sanitize_contact_profile(
                        profile,
                        blocked_domains=["reclameaqui.com.br"],
                    )

                    socials = profile.get("socials") or {}
                    linkedin_url = socials.get("linkedin") if isinstance(socials, dict) else None
                    leads.append(
                        {
                            "companyName": _company_from_source(source_url, name),
                            "email": profile.get("email"),
                            "phone": profile.get("phone"),
                            "linkedinUrl": linkedin_url,
                            "companyDomain": profile.get("domain"),
                            "source": "reclame_aqui",
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
            except Exception as exc:
                logger.warning("Reclame Aqui direct scraping failed: %s", str(exc))

            # Fallback strategy: search engine results
            if len(leads) < limit:
                search_query = f"site:reclameaqui.com.br/empresa {query}".strip()
                results = await web_search(search_query, limit=max(limit * 2, 10), proxy=proxy)
                progress_total += max(len(results), 1)
                await publish_progress(force=True)
                for result in results:
                    processed_items = min(progress_total, processed_items + 1)
                    await publish_progress()

                    title = (result.get("title") or "").strip()
                    source_url = _canonical_company_url(result.get("url"))
                    if not title or not source_url or source_url in seen:
                        continue

                    seen.add(source_url)
                    profile = {
                        "email": None,
                        "phone": None,
                        "socials": {},
                        "domain": extract_domain(source_url),
                        "emails": [],
                        "phones": [],
                    }
                    if profile_budget > 0:
                        profile_budget -= 1
                        profile = await fetch_contact_profile(source_url, proxy=proxy)
                    profile = sanitize_contact_profile(
                        profile,
                        blocked_domains=["reclameaqui.com.br"],
                    )

                    socials = profile.get("socials") or {}
                    linkedin_url = socials.get("linkedin") if isinstance(socials, dict) else None
                    leads.append(
                        {
                            "companyName": _company_from_source(source_url, title),
                            "email": profile.get("email"),
                            "phone": profile.get("phone"),
                            "linkedinUrl": linkedin_url,
                            "companyDomain": profile.get("domain"),
                            "source": "reclame_aqui",
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

        await publish_progress(flush_leads=True)
        await reporter.finish(leads, send_leads=not streamed_leads)
    except Exception as exc:
        logger.exception("Reclame Aqui scrape failed")
        await reporter.fail(str(exc))
