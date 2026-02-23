import logging
from typing import Any, Dict, List, Optional
from urllib.parse import urlparse

from bs4 import BeautifulSoup

from core.config import SCRAPING_MOCK, SCRAPING_NO_API, WAPPALYZER_API_KEY
from core.http import get_json, get_text
from core.progress import ProgressReporter
from core.proxy import proxy_manager
from core.rate_limiter import RateLimiter
from .contact_utils import (
    dedupe_tags,
    extract_contacts_from_html,
    normalize_url,
    sanitize_contact_profile,
)
from .mock import make_mock_leads

logger = logging.getLogger(__name__)
limiter = RateLimiter(rpm=30)
_LOW_VALUE_TITLES = {
    "just a moment...",
    "access denied",
    "403 forbidden",
    "404 not found",
}

TECH_SIGNATURES = {
    "WordPress": ["wp-content", "wp-includes", "wordpress"],
    "Shopify": ["cdn.shopify.com", "shopify"],
    "Wix": ["wix.com", "wixsite"],
    "Squarespace": ["squarespace"],
    "Webflow": ["webflow"],
    "Next.js": ["_next/", "nextjs"],
    "React": ["react", "data-reactroot", "__react"],
    "Vue": ["vue", "data-v-"],
    "Angular": ["angular", "ng-app"],
    "Bootstrap": ["bootstrap"],
    "jQuery": ["jquery"],
}


def _domain(url: str) -> str:
    parsed = urlparse(url)
    host = parsed.netloc or url
    return host[4:] if host.startswith("www.") else host


def _detect_technologies(html: str) -> List[str]:
    tags = set()
    lower = html.lower()
    for tech, signatures in TECH_SIGNATURES.items():
        if any(sig in lower for sig in signatures):
            tags.add(tech)

    soup = BeautifulSoup(html, "lxml")
    generator = soup.find("meta", attrs={"name": "generator"})
    if generator:
        content = generator.get("content")
        if content:
            tags.add(content.split(" ")[0])

    return sorted(tags)


def _build_tags(technologies: List[str], email: Optional[str], phone: Optional[str], linkedin: Optional[str]) -> List[str]:
    tags = technologies[:] if technologies else ["unknown"]
    if email:
        tags.append("has_email")
    if phone:
        tags.append("has_phone")
    if linkedin:
        tags.append("has_linkedin")
    return dedupe_tags(tags, source_tag="wappalyzer")


def _resolve_company_name(title: Optional[str], url: str) -> str:
    if title:
        cleaned = " ".join(str(title).split()).strip()
        if cleaned and cleaned.lower() not in _LOW_VALUE_TITLES:
            return cleaned
    return _domain(url)


async def scrape(
    urls: str | List[str],
    limit: int,
    job_id: str,
    webhook_url: Optional[str] = None,
    webhook_secret: Optional[str] = None,
) -> None:
    reporter = ProgressReporter(job_id, webhook_url, webhook_secret)
    await reporter.start()
    streamed_leads = False
    try:
        if SCRAPING_MOCK:
            leads = make_mock_leads("wappalyzer", "Tech Stack", limit, {"tags": ["mock_tech"]})
        else:
            url_list = urls if isinstance(urls, list) else [urls]
            leads: List[Dict[str, Any]] = []
            total = min(limit, len(url_list))
            await reporter.update(0, total_items=total, force=True)
            for index, raw_url in enumerate(url_list[:limit], start=1):
                url = normalize_url(raw_url)
                if not url:
                    await reporter.update(index)
                    continue

                html = ""
                technologies: List[str] = []
                profile: Dict[str, Any] = {
                    "url": url,
                    "domain": _domain(url),
                    "title": None,
                    "email": None,
                    "phone": None,
                    "emails": [],
                    "phones": [],
                    "socials": {},
                }

                try:
                    async with limiter:
                        proxy = await proxy_manager.next_proxy()
                        if SCRAPING_NO_API:
                            html = await get_text(url, proxy=proxy)
                            technologies = _detect_technologies(html)
                            profile = {
                                "url": url,
                                "domain": _domain(url),
                                **extract_contacts_from_html(html),
                            }
                        else:
                            if not WAPPALYZER_API_KEY:
                                raise RuntimeError("WAPPALYZER_API_KEY not set")
                            data = await get_json(
                                "https://api.wappalyzer.com/v2/lookup/",
                                params={"urls": url},
                                headers={"x-api-key": WAPPALYZER_API_KEY},
                                proxy=proxy,
                            )
                            if isinstance(data, list) and data:
                                technologies = [
                                    t.get("name")
                                    for t in data[0].get("technologies", [])
                                    if t.get("name")
                                ]
                            try:
                                html = await get_text(url, proxy=proxy)
                                profile = {
                                    "url": url,
                                    "domain": _domain(url),
                                    **extract_contacts_from_html(html),
                                }
                            except Exception:
                                profile = {
                                    "url": url,
                                    "domain": _domain(url),
                                    "title": None,
                                    "email": None,
                                    "phone": None,
                                    "emails": [],
                                    "phones": [],
                                    "socials": {},
                                }
                except Exception as exc:
                    logger.warning("Wappalyzer probe failed for %s: %s", url, str(exc))
                    fallback_domain = _domain(url)
                    fallback_lead = {
                        "companyName": fallback_domain,
                        "companyDomain": fallback_domain,
                        "source": "wappalyzer",
                        "sourceUrl": url,
                        "tags": _build_tags([], None, None, None),
                        "enrichmentData": {
                            "technologies": [],
                            "socials": {},
                            "contacts": {"emails": [], "phones": []},
                            "probeError": str(exc),
                        },
                    }
                    leads.append(fallback_lead)
                    await reporter.update(index, leads=[fallback_lead])
                    streamed_leads = True
                    continue

                profile = sanitize_contact_profile(profile)
                socials_dict = profile.get("socials") if isinstance(profile.get("socials"), dict) else {}
                linkedin_url = socials_dict.get("linkedin")
                email = profile.get("email")
                phone = profile.get("phone")
                title = profile.get("title")
                company_name = _resolve_company_name(title, url)
                domain = _domain(url)

                leads.append(
                    {
                        "companyName": company_name,
                        "companyDomain": domain,
                        "email": email,
                        "phone": phone,
                        "linkedinUrl": linkedin_url,
                        "source": "wappalyzer",
                        "sourceUrl": url,
                        "tags": _build_tags(technologies, email, phone, linkedin_url),
                        "enrichmentData": {
                            "technologies": dedupe_tags(technologies),
                            "socials": socials_dict,
                            "contacts": {
                                "emails": profile.get("emails") if isinstance(profile, dict) else [],
                                "phones": profile.get("phones") if isinstance(profile, dict) else [],
                            },
                        },
                    }
                )
                await reporter.update(index, leads=[leads[-1]])
                streamed_leads = True

        debug = {
            "mode": "mock" if SCRAPING_MOCK else ("no_api" if SCRAPING_NO_API else "wappalyzer_api"),
            "requestedLimit": limit,
            "finalLeadCount": len(leads),
        }
        await reporter.finish(leads, debug=debug, send_leads=not streamed_leads)
    except Exception as exc:
        logger.exception("Wappalyzer scrape failed")
        await reporter.fail(str(exc))
