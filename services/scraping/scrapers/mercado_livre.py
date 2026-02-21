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
_LOW_VALUE_TITLES = {"read more", "translate this page", "about"}


def _clean_name(value: str) -> str:
    cleaned = re.sub(r"^\s*por\s+", "", value, flags=re.IGNORECASE).strip()
    cleaned = re.sub(r"\s+no\s+Mercado\s+Livre.*$", "", cleaned, flags=re.IGNORECASE).strip()
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


def _name_from_url(value: Optional[str]) -> Optional[str]:
    source_url = normalize_url(value)
    if not source_url:
        return None
    parsed = urlparse(source_url)
    parts = [part for part in parsed.path.split("/") if part]
    if "loja" in parts:
        idx = parts.index("loja")
        if idx + 1 < len(parts):
            slug = unquote(parts[idx + 1])
            label = re.sub(r"[-_]+", " ", slug).strip()
            label = re.sub(r"\s+", " ", label).title()
            return label or None
    return None


def _build_tags(email: Optional[str], phone: Optional[str], linkedin_url: Optional[str]) -> List[str]:
    tags = ["marketplace"]
    if email:
        tags.append("has_email")
    if phone:
        tags.append("has_phone")
    if linkedin_url:
        tags.append("has_linkedin")
    return dedupe_tags(tags, source_tag="mercado_livre")


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
            leads = make_mock_leads("mercado_livre", query or "Mercado Livre", min(limit, 10))
        else:
            url = f"https://lista.mercadolivre.com.br/{quote_plus(query)}"
            leads = []
            seen = set()
            proxy = await proxy_manager.next_proxy()
            profile_budget = min(limit, 4)

            # Primary strategy
            try:
                async with limiter:
                    html = await get_text(url, proxy=proxy)
                soup = BeautifulSoup(html, "lxml")

                seller_candidates = []
                for selector in [
                    "span.ui-search-item__seller-info-text",
                    "a.poly-component__seller",
                    "span.poly-component__seller",
                    "a.ui-search-item__group__element.ui-search-link",
                ]:
                    seller_candidates.extend(soup.select(selector))
                progress_total = max(1, len(seller_candidates))
                await publish_progress(force=True)

                for node in seller_candidates:
                    processed_items = min(progress_total, processed_items + 1)
                    await publish_progress()

                    name = _clean_name((node.get_text() or "").strip())
                    href = node.get("href") if hasattr(node, "get") else None
                    source_url = normalize_url(href) or url
                    dedupe_key = source_url or name.lower()
                    if not name or not dedupe_key or dedupe_key in seen:
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
                        blocked_domains=["mercadolivre.com.br", "mercadolibre.com"],
                    )

                    socials = profile.get("socials") or {}
                    linkedin_url = socials.get("linkedin") if isinstance(socials, dict) else None
                    leads.append(
                        {
                            "companyName": name,
                            "email": profile.get("email"),
                            "phone": profile.get("phone"),
                            "linkedinUrl": linkedin_url,
                            "companyDomain": profile.get("domain"),
                            "source": "mercado_livre",
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
                logger.warning("Mercado Livre direct scraping failed: %s", str(exc))

            # Fallback strategy
            if len(leads) < limit:
                search_query = f"site:mercadolivre.com.br {query}".strip()
                results = await web_search(search_query, limit=max(limit * 2, 10), proxy=proxy)
                progress_total += max(len(results), 1)
                await publish_progress(force=True)
                for result in results:
                    processed_items = min(progress_total, processed_items + 1)
                    await publish_progress()

                    title = _clean_name((result.get("title") or "").strip())
                    source_url = normalize_url(result.get("url"))
                    if not source_url:
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
                        "emails": [],
                        "phones": [],
                    }
                    if source_url and profile_budget > 0:
                        profile_budget -= 1
                        profile = await fetch_contact_profile(source_url, proxy=proxy)
                    profile = sanitize_contact_profile(
                        profile,
                        blocked_domains=["mercadolivre.com.br", "mercadolibre.com"],
                    )

                    company_name = title
                    if _is_low_value_title(company_name):
                        company_name = _name_from_url(source_url) or ""
                    if _is_low_value_title(company_name):
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
                            "source": "mercado_livre",
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
        logger.exception("Mercado Livre scrape failed")
        await reporter.fail(str(exc))
