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
from .contact_utils import dedupe_tags, fetch_contact_profile, normalize_url, sanitize_contact_profile
from .mock import make_mock_leads
from .search import web_search

logger = logging.getLogger(__name__)
limiter = RateLimiter(rpm=30)
_LOW_VALUE_TITLES = {"read more", "translate this page", "about", "indeed"}


def _company_from_title(value: str) -> str:
    cleaned = re.sub(r"\s+", " ", value).strip()
    cleaned = re.sub(
        r"^Indeed\s+[a-z0-9\.-]+\s+›\s+[^\s]+\s+",
        "",
        cleaned,
        flags=re.IGNORECASE,
    ).strip()
    cleaned = re.sub(r"\s*-\s*Indeed.*$", "", cleaned, flags=re.IGNORECASE).strip()
    cleaned = re.sub(r"\s*\|\s*Indeed.*$", "", cleaned, flags=re.IGNORECASE).strip()
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
    if "indeed.com" in normalized or "indeed.com.br" in normalized:
        return True
    if "." in normalized and " " not in normalized:
        return True
    return False


def _slug_to_name(value: str) -> str:
    decoded = unquote(value or "").strip("/")
    decoded = re.sub(r"\.html?$", "", decoded, flags=re.IGNORECASE)
    tokens = [token for token in re.split(r"[-_]+", decoded) if token]
    tokens = [token for token in tokens if token.lower() not in {"l", "vagas"}]
    if not tokens:
        return ""
    return " ".join(token.capitalize() for token in tokens)


def _company_from_url(value: Optional[str]) -> Optional[str]:
    source_url = normalize_url(value)
    if not source_url:
        return None
    parsed = urlparse(source_url)
    parts = [part for part in parsed.path.split("/") if part]
    if parts and parts[0].startswith("q-"):
        label = _slug_to_name(parts[0][2:])
        return label or None
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
    tags = ["jobs"]
    if email:
        tags.append("has_email")
    if phone:
        tags.append("has_phone")
    if linkedin_url:
        tags.append("has_linkedin")
    return dedupe_tags(tags, source_tag="indeed")


def _scaled_result_limit(
    requested: int,
    *,
    base: int,
    multiplier: int,
    ceiling: int,
) -> int:
    if requested <= 0:
        return base
    scaled = requested * multiplier
    return max(base, min(ceiling, scaled))


def _build_fallback_queries(query: str, location: str) -> List[str]:
    candidates = [
        f"site:indeed.com.br {query} {location}".strip(),
        f"site:indeed.com {query} {location}".strip(),
        f"site:indeed.com.br/vagas {query} {location}".strip(),
        f'"{query}" "{location}" "indeed"'.strip(),
    ]
    deduped: List[str] = []
    for candidate in candidates:
        if candidate and candidate not in deduped:
            deduped.append(candidate)
    return deduped


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
                    profile = sanitize_contact_profile(
                        profile,
                        blocked_domains=["indeed.com", "indeed.com.br"],
                    )

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
                fallback_queries = _build_fallback_queries(query, location)
                search_result_limit = _scaled_result_limit(
                    limit,
                    base=80,
                    multiplier=4,
                    ceiling=300,
                )
                for search_query in fallback_queries:
                    if len(leads) >= limit:
                        break
                    results = await web_search(
                        search_query,
                        limit=search_result_limit,
                        proxy=proxy,
                    )
                    progress_total += max(len(results), 1)
                    await publish_progress(force=True)
                    for result in results:
                        processed_items = min(progress_total, processed_items + 1)
                        await publish_progress()

                        source_url = normalize_url(result.get("url"))
                        title = (result.get("title") or "").strip()
                        if not source_url:
                            continue
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
                        profile = sanitize_contact_profile(
                            profile,
                            blocked_domains=["indeed.com", "indeed.com.br"],
                        )

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
