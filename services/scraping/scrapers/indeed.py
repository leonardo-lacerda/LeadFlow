import logging
import re
from typing import Any, Dict, List, Optional
from urllib.parse import quote_plus, unquote, urlparse

from bs4 import BeautifulSoup

from core.config import SCRAPING_MOCK
from core.http import get_text
from core.progress import ProgressReporter
from core.proxy import proxy_manager
from core.rate_limiter import RateLimiter
from .contact_utils import fetch_contact_profile, normalize_url
from .mock import make_mock_leads
from .search import web_search

logger = logging.getLogger(__name__)
limiter = RateLimiter(rpm=30)
_LOW_VALUE_TITLES = {"read more", "translate this page", "about", "indeed"}


def _company_from_title(value: str) -> str:
    cleaned = re.sub(r"\s*-\s*Indeed.*$", "", value, flags=re.IGNORECASE).strip()
    cleaned = re.sub(r"\s*-\s*Empregos.*$", "", cleaned, flags=re.IGNORECASE).strip()
    cleaned = re.sub(r"^Indeed\s+[^-—|]+[—\-|]\s*", "", cleaned, flags=re.IGNORECASE).strip()
    cleaned = re.sub(r"\s+", " ", cleaned).strip(" -|")
    return cleaned or value


def _is_low_value_title(value: str) -> bool:
    normalized = re.sub(r"\s+", " ", value).strip().lower()
    if not normalized:
        return True
    if normalized in _LOW_VALUE_TITLES:
        return True
    if "." in normalized and " " not in normalized:
        return True
    return False


def _slug_to_name(value: str) -> str:
    decoded = unquote(value or "").strip("/")
    tokens = [token for token in re.split(r"[-_]+", decoded) if token]
    if not tokens:
        return ""
    return " ".join(token.capitalize() for token in tokens)


def _company_from_url(value: Optional[str]) -> Optional[str]:
    source_url = normalize_url(value)
    if not source_url:
        return None
    parsed = urlparse(source_url)
    parts = [part for part in parsed.path.split("/") if part]
    if "cmp" in parts:
        idx = parts.index("cmp")
        if idx + 1 < len(parts):
            label = _slug_to_name(parts[idx + 1])
            return label or None
    return None


def _fallback_company_name(title: str, source_url: Optional[str]) -> str:
    from_url = _company_from_url(source_url)
    if from_url:
        return from_url
    return _company_from_title(title)


def _build_tags(email: Optional[str], phone: Optional[str], linkedin_url: Optional[str]) -> List[str]:
    tags = ["indeed", "jobs"]
    if email:
        tags.append("has_email")
    if phone:
        tags.append("has_phone")
    if linkedin_url:
        tags.append("has_linkedin")
    return tags


async def scrape(
    query: str,
    location: str,
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
            base = f"{query} {location}".strip() or "Indeed"
            leads = make_mock_leads("indeed", base, min(limit, 10))
        else:
            leads = []
            seen = set()
            proxy = await proxy_manager.next_proxy()
            profile_budget = min(limit, 4)

            # Primary strategy
            url = f"https://br.indeed.com/jobs?q={quote_plus(query)}&l={quote_plus(location)}"
            try:
                async with limiter:
                    html = await get_text(url, proxy=proxy)
                soup = BeautifulSoup(html, "lxml")
                cards = soup.select("div.job_seen_beacon")
                progress_total = max(1, len(cards))
                await publish_progress(force=True)
                for card in cards:
                    processed_items = min(progress_total, processed_items + 1)
                    await publish_progress()

                    company_el = card.select_one("span[data-testid='company-name']")
                    title_el = card.select_one("h2 a")
                    company_name = (
                        (company_el.get_text() if company_el else "")
                        or (title_el.get_text() if title_el else "")
                    ).strip()
                    href = title_el.get("href") if title_el else None
                    source_url = normalize_url(
                        f"https://br.indeed.com{href}" if href and href.startswith("/") else href
                    )
                    dedupe_key = source_url or company_name.lower()
                    if not company_name or not dedupe_key or dedupe_key in seen:
                        continue
                    seen.add(dedupe_key)

                    profile = {
                        "email": None,
                        "phone": None,
                        "socials": {},
                        "domain": None,
                        "emails": [],
                        "phones": [],
                    }
                    if source_url and profile_budget > 0:
                        profile_budget -= 1
                        profile = await fetch_contact_profile(source_url, proxy=proxy)

                    socials = profile.get("socials") or {}
                    linkedin_url = socials.get("linkedin") if isinstance(socials, dict) else None
                    leads.append(
                        {
                            "companyName": company_name,
                            "jobTitle": title_el.get_text(strip=True) if title_el else query,
                            "email": profile.get("email"),
                            "phone": profile.get("phone"),
                            "linkedinUrl": linkedin_url,
                            "city": location,
                            "country": "BR",
                            "companyDomain": profile.get("domain"),
                            "source": "indeed",
                            "sourceUrl": source_url or url,
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
                logger.warning("Indeed direct scraping failed: %s", str(exc))

            # Fallback strategy
            if len(leads) < limit:
                search_query = f"site:indeed.com {query} {location}".strip()
                results = await web_search(search_query, limit=max(limit * 2, 10), proxy=proxy)
                progress_total += max(len(results), 1)
                await publish_progress(force=True)
                for result in results:
                    processed_items = min(progress_total, processed_items + 1)
                    await publish_progress()

                    source_url = normalize_url(result.get("url"))
                    title = (result.get("title") or "").strip()
                    dedupe_key = source_url or title.lower()
                    if not dedupe_key or dedupe_key in seen:
                        continue
                    seen.add(dedupe_key)

                    company_name = _fallback_company_name(title, source_url)
                    if _is_low_value_title(company_name):
                        continue

                    profile = {
                        "email": None,
                        "phone": None,
                        "socials": {},
                        "domain": None,
                        "emails": [],
                        "phones": [],
                    }
                    if source_url and profile_budget > 0:
                        profile_budget -= 1
                        profile = await fetch_contact_profile(source_url, proxy=proxy)

                    socials = profile.get("socials") or {}
                    linkedin_url = socials.get("linkedin") if isinstance(socials, dict) else None
                    leads.append(
                        {
                            "companyName": company_name,
                            "jobTitle": query,
                            "email": profile.get("email"),
                            "phone": profile.get("phone"),
                            "linkedinUrl": linkedin_url,
                            "city": location,
                            "country": "BR",
                            "companyDomain": profile.get("domain"),
                            "source": "indeed",
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
        logger.exception("Indeed scrape failed")
        await reporter.fail(str(exc))
