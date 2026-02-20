import logging
import re
import unicodedata
from typing import List, Dict, Any, Optional
from urllib.parse import quote_plus, unquote, urlparse

from bs4 import BeautifulSoup
from core.config import SCRAPING_MOCK, SCRAPING_NO_API, SERPAPI_KEY
from core.http import get_json, get_text
from core.proxy import proxy_manager
from core.progress import ProgressReporter
from core.rate_limiter import RateLimiter
from .mock import make_mock_leads
from .search import web_search

logger = logging.getLogger(__name__)
limiter = RateLimiter(rpm=30)
COMMON_QUERY_FIXES = {
    "resturante": "restaurante",
}
EMAIL_PATTERN = re.compile(r"[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}", re.IGNORECASE)
PHONE_PATTERN = re.compile(
    r"(?:\+?55[\s-]*)?(?:\(?\d{2}\)?[\s-]*)?(?:9?\d{4})[\s-]?\d{4}"
)
SOCIAL_HOSTS = {
    "linkedin": "linkedin.com",
    "instagram": "instagram.com",
    "facebook": "facebook.com",
    "twitter": "twitter.com",
    "x": "x.com",
    "youtube": "youtube.com",
    "tiktok": "tiktok.com",
}
GOOGLE_MAPS_ALLOWED_HOSTS = {
    "google.com",
    "google.com.br",
    "maps.google.com",
    "maps.google.com.br",
}
GOOGLE_MAPS_BLOCKED_PATH_PREFIXES = (
    "/maps/dir",
    "/maps/directions",
    "/maps/embed",
    "/maps/about",
    "/maps/reserve",
    "/maps/timeline",
    "/maps/contrib",
)
LOW_VALUE_GOOGLE_MAPS_TITLE_TOKENS = (
    "google maps",
    "directions",
    "traffic",
    "transit",
    "google help",
    "support google",
    "suporte do google",
    "ajuda do google",
    "search this area",
    "pesquisar locais",
    "reservar com o google",
)


def _clean_title(value: str) -> str:
    cleaned = re.sub(r"\s*[-|·—–]\s*Google Maps.*$", "", value, flags=re.IGNORECASE).strip()
    cleaned = re.sub(r"\s+Google Maps.*$", "", cleaned, flags=re.IGNORECASE).strip()
    return cleaned


def _is_generic_google_maps_title(value: str) -> bool:
    if not value:
        return True
    lowered = _normalize_text(value)
    return lowered in {"google maps", "maps", "google"}


def _is_low_value_google_maps_title(value: str) -> bool:
    if _is_generic_google_maps_title(value):
        return True
    normalized = _normalize_text(value)
    if not normalized:
        return True
    return any(token in normalized for token in LOW_VALUE_GOOGLE_MAPS_TITLE_TOKENS)


def _extract_domain(value: Optional[str]) -> Optional[str]:
    if not value:
        return None
    parsed = urlparse(value)
    host = (parsed.hostname or "").strip().lower()
    if host.startswith("www."):
        host = host[4:]
    return host or None


def _is_social_domain(domain: Optional[str]) -> bool:
    if not domain:
        return False
    return any(host in domain for host in SOCIAL_HOSTS.values())


def _is_non_business_domain(domain: Optional[str]) -> bool:
    if not domain:
        return True
    return (
        domain.endswith("google.com")
        or domain.endswith("google.com.br")
        or domain.endswith("googleusercontent.com")
        or domain.endswith("duckduckgo.com")
        or _is_social_domain(domain)
    )


def _extract_osm_name(item: Dict[str, Any]) -> str:
    name = str(item.get("name") or "").strip()
    if name:
        return name
    display_name = str(item.get("display_name") or "").strip()
    if not display_name:
        return ""
    return display_name.split(",")[0].strip()


def _extract_osm_source_url(item: Dict[str, Any]) -> Optional[str]:
    osm_type = str(item.get("osm_type") or "").strip()
    osm_id = str(item.get("osm_id") or "").strip()
    if not osm_type or not osm_id:
        return None
    return f"https://www.openstreetmap.org/{osm_type}/{osm_id}"


def _normalize_query_text(value: str) -> str:
    normalized = value.strip()
    for wrong, right in COMMON_QUERY_FIXES.items():
        normalized = re.sub(
            rf"\b{re.escape(wrong)}\b",
            right,
            normalized,
            flags=re.IGNORECASE,
        )
    return normalized


def _normalize_text(value: str) -> str:
    normalized = unicodedata.normalize("NFKD", value)
    ascii_value = normalized.encode("ascii", "ignore").decode("ascii")
    return ascii_value.lower().strip()


def _extract_location_tokens(value: str) -> List[str]:
    tokens = re.split(r"[^a-z0-9]+", _normalize_text(value))
    filtered = [token for token in tokens if len(token) >= 3]
    deduped: List[str] = []
    for token in filtered:
        if token not in deduped:
            deduped.append(token)
    return deduped


def _first_non_empty(*values: Optional[str]) -> Optional[str]:
    for value in values:
        if not value:
            continue
        cleaned = str(value).strip()
        if cleaned:
            return cleaned
    return None


def _normalize_url(value: Optional[str]) -> Optional[str]:
    if not value:
        return None
    cleaned = str(value).strip()
    if not cleaned:
        return None
    if cleaned.startswith("//"):
        return f"https:{cleaned}"
    if not re.match(r"^https?://", cleaned, flags=re.IGNORECASE):
        return f"https://{cleaned}"
    return cleaned


def _is_google_maps_url(value: Optional[str]) -> bool:
    normalized = _normalize_url(value)
    domain = _extract_domain(normalized)
    if not domain:
        return False
    if domain not in GOOGLE_MAPS_ALLOWED_HOSTS:
        return False
    parsed = urlparse(normalized)
    path = (parsed.path or "").lower()
    if any(path.startswith(prefix) for prefix in GOOGLE_MAPS_BLOCKED_PATH_PREFIXES):
        return False
    if domain.startswith("maps.google"):
        return True
    if not path.startswith("/maps"):
        return False
    if path in {"/maps", "/maps/"}:
        # Generic Maps landing pages are low-signal for lead extraction.
        query = (parsed.query or "").lower()
        return any(param in query for param in ("cid=", "q=", "query=", "ll=", "ftid="))
    return True


def _extract_company_from_google_maps_url(value: Optional[str]) -> Optional[str]:
    normalized = _normalize_url(value)
    if not normalized or not _is_google_maps_url(normalized):
        return None
    parsed = urlparse(normalized)
    path = parsed.path or ""
    for pattern in (r"/maps/place/([^/]+)", r"/maps/search/([^/]+)"):
        match = re.search(pattern, path, flags=re.IGNORECASE)
        if not match:
            continue
        candidate = unquote(match.group(1)).replace("+", " ").strip()
        candidate = re.sub(r"@\S+$", "", candidate).strip()
        cleaned = _clean_title(candidate)
        if cleaned and not _is_low_value_google_maps_title(cleaned):
            return cleaned
    query = parsed.query or ""
    for key in ("query", "q"):
        match = re.search(rf"(?:^|&){key}=([^&]+)", query, flags=re.IGNORECASE)
        if not match:
            continue
        candidate = unquote(match.group(1)).replace("+", " ").strip()
        cleaned = _clean_title(candidate)
        if cleaned and not _is_low_value_google_maps_title(cleaned):
            return cleaned
    return None


def _build_google_maps_search_url(company_name: str, location: str) -> str:
    query = " ".join([company_name.strip(), location.strip()]).strip()
    return f"https://www.google.com/maps/search/{quote_plus(query)}"


def _extract_social_links(values: List[Optional[str]]) -> Dict[str, str]:
    links: Dict[str, str] = {}
    for raw in values:
        url = _normalize_url(raw)
        domain = _extract_domain(url)
        if not url or not domain:
            continue
        for label, host in SOCIAL_HOSTS.items():
            if host in domain and label not in links:
                links[label] = url
    return links


def _merge_social_links(*sources: Dict[str, str]) -> Dict[str, str]:
    merged: Dict[str, str] = {}
    for source in sources:
        for key, value in source.items():
            if key not in merged:
                merged[key] = value
    return merged


def _extract_osm_contacts(item: Dict[str, Any]) -> Dict[str, Any]:
    extra_tags = item.get("extratags")
    tags = extra_tags if isinstance(extra_tags, dict) else {}

    website_candidate = _normalize_url(
        _first_non_empty(
            tags.get("website"),
            tags.get("contact:website"),
            tags.get("url"),
        )
    )
    phone = _first_non_empty(
        tags.get("phone"),
        tags.get("contact:phone"),
        tags.get("mobile"),
        tags.get("contact:mobile"),
    )
    email = _first_non_empty(
        tags.get("email"),
        tags.get("contact:email"),
    )

    social_links = _extract_social_links(
        [
            tags.get("instagram"),
            tags.get("contact:instagram"),
            tags.get("facebook"),
            tags.get("contact:facebook"),
            tags.get("linkedin"),
            tags.get("contact:linkedin"),
            tags.get("twitter"),
            tags.get("contact:twitter"),
            tags.get("x"),
            tags.get("youtube"),
            tags.get("tiktok"),
        ]
    )

    website = website_candidate
    website_domain = _extract_domain(website_candidate)
    if website_candidate and _is_social_domain(website_domain):
        social_links = _merge_social_links(social_links, _extract_social_links([website_candidate]))
        website = None

    return {
        "website": website,
        "phone": phone,
        "email": email,
        "socialLinks": social_links,
    }


async def _extract_website_contacts(
    website_url: Optional[str],
    proxy: Optional[str],
) -> Dict[str, Any]:
    if not website_url:
        return {
            "phone": None,
            "email": None,
            "socialLinks": {},
            "allEmails": [],
            "allPhones": [],
        }

    domain = _extract_domain(website_url)
    if _is_social_domain(domain):
        return {
            "phone": None,
            "email": None,
            "socialLinks": _extract_social_links([website_url]),
            "allEmails": [],
            "allPhones": [],
        }

    try:
        async with limiter:
            html = await get_text(
                website_url,
                proxy=proxy,
                headers={"accept-language": "pt-BR,pt;q=0.9,en-US;q=0.8"},
            )
    except Exception:
        return {
            "phone": None,
            "email": None,
            "socialLinks": {},
            "allEmails": [],
            "allPhones": [],
        }

    soup = BeautifulSoup(html, "lxml")
    text_content = soup.get_text(" ", strip=True)
    found_emails = list(dict.fromkeys(EMAIL_PATTERN.findall(text_content)))[:5]
    found_phones = list(dict.fromkeys(PHONE_PATTERN.findall(text_content)))[:5]

    href_values: List[Optional[str]] = []
    for link in soup.select("a[href]"):
        href = (link.get("href") or "").strip()
        if not href:
            continue
        if href.lower().startswith("mailto:"):
            mail = href.split(":", 1)[1].strip()
            if mail:
                found_emails.append(mail)
            continue
        if href.lower().startswith("tel:"):
            phone = href.split(":", 1)[1].strip()
            if phone:
                found_phones.append(phone)
            continue
        href_values.append(href)

    unique_emails = list(dict.fromkeys(found_emails))
    unique_phones = list(dict.fromkeys(found_phones))
    social_links = _extract_social_links(href_values)

    return {
        "phone": unique_phones[0] if unique_phones else None,
        "email": unique_emails[0] if unique_emails else None,
        "socialLinks": social_links,
        "allEmails": unique_emails[:5],
        "allPhones": unique_phones[:5],
    }


def _build_enrichment_data(
    *,
    map_url: Optional[str],
    raw_map_url: Optional[str],
    website_url: Optional[str],
    social_links: Dict[str, str],
    all_emails: List[str],
    all_phones: List[str],
    osm_url: Optional[str],
) -> Dict[str, Any]:
    return {
        "maps": {
            "url": map_url,
            "rawUrl": raw_map_url,
            "osmUrl": osm_url,
        },
        "website": website_url,
        "socials": social_links,
        "contacts": {
            "emails": all_emails,
            "phones": all_phones,
        },
    }

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

    logger.info(
        "Google Maps scrape started job_id=%s query=%s location=%s limit=%s no_api=%s mock=%s",
        job_id,
        query,
        location,
        limit,
        SCRAPING_NO_API,
        SCRAPING_MOCK,
    )
    try:
        leads: List[Dict[str, Any]]
        debug: Dict[str, Any] = {
            "jobId": job_id,
            "query": query,
            "location": location,
            "limit": limit,
        }
        if SCRAPING_MOCK:
            debug["mode"] = "mock"
            base = f"{query} {location}".strip() or "Google Maps"
            leads = make_mock_leads("google_maps", base, min(limit, 10), {"sourceUrl": "https://maps.google.com"})
        elif SCRAPING_NO_API:
            debug["mode"] = "no_api"
            normalized_query = _normalize_query_text(query)
            debug["normalizedQuery"] = normalized_query
            if normalized_query != query:
                logger.info(
                    "Google Maps query normalized job_id=%s original=%s normalized=%s",
                    job_id,
                    query,
                    normalized_query,
                )
            search_query = f'site:google.com/maps "{normalized_query}" "{location}"'.strip()
            proxy = await proxy_manager.next_proxy()
            results = await web_search(search_query, limit=min(limit, 50), proxy=proxy)
            progress_total = max(1, len(results))
            await publish_progress(force=True)
            leads = []
            seen = set()
            location_tokens = _extract_location_tokens(location)
            osm_enrichment_budget = min(limit, 20)
            website_enrichment_budget = min(max(3, limit // 5), 15)
            filtered_generic = 0
            filtered_missing_url = 0
            filtered_non_maps_url = 0
            filtered_duplicates = 0
            contact_enriched = {
                "withPhone": 0,
                "withEmail": 0,
                "withLinkedin": 0,
                "withWebsite": 0,
            }
            logger.info(
                "Google Maps no-api web_search finished job_id=%s query=%s results=%s",
                job_id,
                search_query,
                len(results),
            )
            for result in results:
                processed_items = min(progress_total, processed_items + 1)
                await publish_progress()

                source_url = _normalize_url(result.get("url"))
                if not source_url:
                    filtered_missing_url += 1
                    continue
                if not _is_google_maps_url(source_url):
                    filtered_non_maps_url += 1
                    continue

                cleaned_title = _clean_title(str(result.get("title") or ""))
                if _is_low_value_google_maps_title(cleaned_title):
                    cleaned_title = _extract_company_from_google_maps_url(source_url) or cleaned_title
                if _is_low_value_google_maps_title(cleaned_title):
                    filtered_generic += 1
                    continue

                map_url = source_url

                osm_item: Optional[Dict[str, Any]] = None
                if osm_enrichment_budget > 0:
                    osm_enrichment_budget -= 1
                    osm_query = f"{cleaned_title} {location}".strip()
                    try:
                        osm_results = await get_json(
                            "https://nominatim.openstreetmap.org/search",
                            params={
                                "q": osm_query,
                                "format": "jsonv2",
                                "addressdetails": 1,
                                "extratags": 1,
                                "limit": 3,
                            },
                            headers={"accept-language": "pt-BR,pt;q=0.9,en-US;q=0.8"},
                            proxy=proxy,
                        )
                        if isinstance(osm_results, list):
                            for candidate in osm_results:
                                if not isinstance(candidate, dict):
                                    continue
                                address = candidate.get("address")
                                address_dict = address if isinstance(address, dict) else {}
                                location_scope = " ".join(
                                    [
                                        str(address_dict.get("city") or ""),
                                        str(address_dict.get("town") or ""),
                                        str(address_dict.get("village") or ""),
                                        str(address_dict.get("state") or ""),
                                        str(address_dict.get("county") or ""),
                                        str(address_dict.get("region") or ""),
                                        str(address_dict.get("country") or ""),
                                    ]
                                ).strip()
                                normalized_scope = _normalize_text(location_scope)
                                if not location_tokens or (
                                    normalized_scope
                                    and any(token in normalized_scope for token in location_tokens)
                                ):
                                    osm_item = candidate
                                    break
                            if not osm_item and osm_results and isinstance(osm_results[0], dict):
                                osm_item = osm_results[0]
                    except Exception:
                        osm_item = None

                osm_contacts = _extract_osm_contacts(osm_item) if osm_item else {
                    "website": None,
                    "phone": None,
                    "email": None,
                    "socialLinks": {},
                }
                website_url = osm_contacts["website"]
                website_contacts = {
                    "phone": None,
                    "email": None,
                    "socialLinks": {},
                    "allEmails": [],
                    "allPhones": [],
                }
                if website_url and website_enrichment_budget > 0:
                    website_enrichment_budget -= 1
                    website_contacts = await _extract_website_contacts(website_url, proxy)

                social_links = _merge_social_links(
                    osm_contacts["socialLinks"],
                    website_contacts["socialLinks"],
                )
                email = _first_non_empty(
                    osm_contacts["email"],
                    website_contacts["email"],
                )
                phone = _first_non_empty(
                    osm_contacts["phone"],
                    website_contacts["phone"],
                )
                linkedin_url = social_links.get("linkedin")
                osm_source_url = _extract_osm_source_url(osm_item) if osm_item else None

                domain = _extract_domain(website_url) or _extract_domain(source_url)
                company_domain = None if _is_non_business_domain(domain) else domain
                all_emails = list(
                    dict.fromkeys(
                        [email] + website_contacts["allEmails"]
                    )
                )
                all_phones = list(
                    dict.fromkeys(
                        [phone] + website_contacts["allPhones"]
                    )
                )
                all_emails = [item for item in all_emails if item]
                all_phones = [item for item in all_phones if item]

                enrichment_data = _build_enrichment_data(
                    map_url=map_url,
                    raw_map_url=source_url,
                    website_url=website_url,
                    social_links=social_links,
                    all_emails=all_emails[:5],
                    all_phones=all_phones[:5],
                    osm_url=osm_source_url,
                )

                dedupe_key = f"{cleaned_title.lower()}|{map_url}"
                if dedupe_key in seen:
                    filtered_duplicates += 1
                    continue
                seen.add(dedupe_key)

                if phone:
                    contact_enriched["withPhone"] += 1
                if email:
                    contact_enriched["withEmail"] += 1
                if linkedin_url:
                    contact_enriched["withLinkedin"] += 1
                if website_url:
                    contact_enriched["withWebsite"] += 1

                lead_tags = ["google_maps"]
                if phone:
                    lead_tags.append("has_phone")
                if email:
                    lead_tags.append("has_email")
                if linkedin_url:
                    lead_tags.append("has_linkedin")
                if website_url:
                    lead_tags.append("has_website")

                leads.append(
                    {
                        "companyName": cleaned_title,
                        "email": email,
                        "phone": phone,
                        "whatsapp": phone,
                        "linkedinUrl": linkedin_url,
                        "companyDomain": company_domain,
                        "city": location,
                        "country": "BR",
                        "source": "google_maps",
                        "sourceUrl": map_url,
                        "tags": lead_tags,
                        "enrichmentData": enrichment_data,
                    }
                )
                pending_leads.append(leads[-1])
                if len(pending_leads) >= 3:
                    await publish_progress(force=True, flush_leads=True)
                if len(leads) >= limit:
                    break

            await publish_progress(flush_leads=True)

            debug["duckduckgo"] = {
                "query": search_query,
                "rawResults": len(results),
                "accepted": len(leads),
                "filteredGeneric": filtered_generic,
                "filteredMissingUrl": filtered_missing_url,
                "filteredNonMapsUrl": filtered_non_maps_url,
                "filteredDuplicates": filtered_duplicates,
                "contactEnriched": contact_enriched,
                "osmEnrichmentBudgetUsed": min(limit, 20) - osm_enrichment_budget,
                "websiteEnrichmentBudgetUsed": min(max(3, limit // 5), 15)
                - website_enrichment_budget,
            }

            if not leads:
                logger.warning(
                    "Google Maps no-api produced zero leads from web_search job_id=%s; starting OSM fallback",
                    job_id,
                )
                raw_osm_queries = [
                    f"{normalized_query} {location}".strip(),
                    f"{query} {location}".strip(),
                    f"{normalized_query} em {location}".strip(),
                    f"{normalized_query} near {location}".strip(),
                ]
                osm_queries = []
                for candidate in raw_osm_queries:
                    if candidate and candidate not in osm_queries:
                        osm_queries.append(candidate)

                osm_debug: List[Dict[str, Any]] = []
                location_tokens = _extract_location_tokens(location)
                for osm_query in osm_queries:
                    try:
                        logger.info(
                            "Google Maps OSM fallback query job_id=%s query=%s",
                            job_id,
                            osm_query,
                        )
                        osm_results = await get_json(
                            "https://nominatim.openstreetmap.org/search",
                            params={
                                "q": osm_query,
                                "format": "jsonv2",
                                "addressdetails": 1,
                                "extratags": 1,
                                "limit": min(limit, 50),
                            },
                            headers={"accept-language": "pt-BR,pt;q=0.9,en-US;q=0.8"},
                            proxy=proxy,
                        )
                    except Exception as exc:
                        logger.warning(
                            "Google Maps OSM fallback failed job_id=%s query=%s error=%s",
                            job_id,
                            osm_query,
                            str(exc),
                        )
                        osm_debug.append(
                            {
                                "query": osm_query,
                                "error": str(exc),
                            }
                        )
                        continue

                    result_count = len(osm_results) if isinstance(osm_results, list) else 0
                    progress_total += max(result_count, 1)
                    await publish_progress(force=True)
                    osm_entry: Dict[str, Any] = {
                        "query": osm_query,
                        "rawResults": result_count,
                        "accepted": 0,
                    }

                    if isinstance(osm_results, list):
                        filtered_by_location = 0
                        contact_from_fallback = {
                            "withPhone": 0,
                            "withEmail": 0,
                            "withLinkedin": 0,
                            "withWebsite": 0,
                        }
                        for item in osm_results:
                            processed_items = min(progress_total, processed_items + 1)
                            await publish_progress()

                            if not isinstance(item, dict):
                                continue
                            company_name = _extract_osm_name(item)
                            if not company_name:
                                continue
                            osm_source_url = _extract_osm_source_url(item)
                            if not osm_source_url:
                                continue

                            address = item.get("address")
                            address_dict = address if isinstance(address, dict) else {}
                            location_scope = " ".join(
                                [
                                    str(address_dict.get("city") or ""),
                                    str(address_dict.get("town") or ""),
                                    str(address_dict.get("village") or ""),
                                    str(address_dict.get("state") or ""),
                                    str(address_dict.get("county") or ""),
                                    str(address_dict.get("region") or ""),
                                    str(address_dict.get("country") or ""),
                                ]
                            ).strip()
                            normalized_scope = _normalize_text(location_scope)
                            if location_tokens and normalized_scope:
                                matches = sum(
                                    1 for token in location_tokens if token in normalized_scope
                                )
                                if matches == 0:
                                    filtered_by_location += 1
                                    continue
                            city = (
                                str(address_dict.get("city") or "")
                                or str(address_dict.get("town") or "")
                                or str(address_dict.get("village") or "")
                                or location
                            )
                            country_code = str(address_dict.get("country_code") or "BR").upper()

                            map_url = _build_google_maps_search_url(company_name, city)
                            osm_contacts = _extract_osm_contacts(item)
                            website_url = osm_contacts["website"]
                            website_contacts = {
                                "phone": None,
                                "email": None,
                                "socialLinks": {},
                                "allEmails": [],
                                "allPhones": [],
                            }
                            if website_url and website_enrichment_budget > 0:
                                website_enrichment_budget -= 1
                                website_contacts = await _extract_website_contacts(
                                    website_url, proxy
                                )

                            social_links = _merge_social_links(
                                osm_contacts["socialLinks"],
                                website_contacts["socialLinks"],
                            )
                            email = _first_non_empty(
                                osm_contacts["email"],
                                website_contacts["email"],
                            )
                            phone = _first_non_empty(
                                osm_contacts["phone"],
                                website_contacts["phone"],
                            )
                            linkedin_url = social_links.get("linkedin")

                            all_emails = list(
                                dict.fromkeys([email] + website_contacts["allEmails"])
                            )
                            all_phones = list(
                                dict.fromkeys([phone] + website_contacts["allPhones"])
                            )
                            all_emails = [item for item in all_emails if item]
                            all_phones = [item for item in all_phones if item]

                            domain = _extract_domain(website_url) if website_url else None
                            company_domain = None if _is_non_business_domain(domain) else domain
                            enrichment_data = _build_enrichment_data(
                                map_url=map_url,
                                raw_map_url=map_url,
                                website_url=website_url,
                                social_links=social_links,
                                all_emails=all_emails[:5],
                                all_phones=all_phones[:5],
                                osm_url=osm_source_url,
                            )

                            dedupe_key = f"osm|{company_name.lower()}|{map_url}"
                            if dedupe_key in seen:
                                continue
                            seen.add(dedupe_key)

                            if phone:
                                contact_from_fallback["withPhone"] += 1
                            if email:
                                contact_from_fallback["withEmail"] += 1
                            if linkedin_url:
                                contact_from_fallback["withLinkedin"] += 1
                            if website_url:
                                contact_from_fallback["withWebsite"] += 1

                            contact_enriched["withPhone"] += int(bool(phone))
                            contact_enriched["withEmail"] += int(bool(email))
                            contact_enriched["withLinkedin"] += int(bool(linkedin_url))
                            contact_enriched["withWebsite"] += int(bool(website_url))

                            lead_tags = ["google_maps", "osm_fallback"]
                            if phone:
                                lead_tags.append("has_phone")
                            if email:
                                lead_tags.append("has_email")
                            if linkedin_url:
                                lead_tags.append("has_linkedin")
                            if website_url:
                                lead_tags.append("has_website")

                            leads.append(
                                {
                                    "companyName": company_name,
                                    "email": email,
                                    "phone": phone,
                                    "whatsapp": phone,
                                    "linkedinUrl": linkedin_url,
                                    "companyDomain": company_domain,
                                    "city": city,
                                    "country": country_code,
                                    "source": "google_maps",
                                    "sourceUrl": map_url,
                                    "tags": lead_tags,
                                    "enrichmentData": enrichment_data,
                                }
                            )
                            pending_leads.append(leads[-1])
                            if len(pending_leads) >= 3:
                                await publish_progress(force=True, flush_leads=True)
                            osm_entry["accepted"] = int(osm_entry["accepted"]) + 1
                            if len(leads) >= limit:
                                break
                        osm_entry["filteredByLocation"] = filtered_by_location
                        osm_entry["contactEnriched"] = contact_from_fallback

                    osm_debug.append(osm_entry)
                    if leads:
                        break

                await publish_progress(flush_leads=True)
                debug["osmFallback"] = osm_debug
        else:
            debug["mode"] = "serpapi"
            if not SERPAPI_KEY:
                raise RuntimeError("SERPAPI_KEY not set for Google Maps scraping")
            async with limiter:
                proxy = await proxy_manager.next_proxy()
                data = await get_json(
                    "https://serpapi.com/search.json",
                    params={
                        "engine": "google_maps",
                        "q": f"{query} {location}".strip(),
                        "api_key": SERPAPI_KEY,
                    },
                    proxy=proxy,
                )
            results = data.get("local_results", [])[:limit]
            progress_total = max(1, len(results))
            await publish_progress(force=True)
            leads = []
            website_enrichment_budget = min(max(3, limit // 5), 15)
            for item in results:
                processed_items = min(progress_total, processed_items + 1)
                await publish_progress()

                company_name = str(item.get("title") or "").strip()
                if not company_name:
                    continue
                website_url = _normalize_url(item.get("website"))
                map_url = _normalize_url(item.get("link")) or _build_google_maps_search_url(
                    company_name, location
                )
                website_contacts = {
                    "phone": None,
                    "email": None,
                    "socialLinks": {},
                    "allEmails": [],
                    "allPhones": [],
                }
                if website_url and website_enrichment_budget > 0:
                    website_enrichment_budget -= 1
                    website_contacts = await _extract_website_contacts(website_url, proxy)

                social_links = website_contacts["socialLinks"]
                email = website_contacts["email"]
                phone = _first_non_empty(item.get("phone"), website_contacts["phone"])
                linkedin_url = social_links.get("linkedin")
                domain = _extract_domain(website_url)
                company_domain = None if _is_non_business_domain(domain) else domain
                enrichment_data = _build_enrichment_data(
                    map_url=map_url,
                    raw_map_url=map_url,
                    website_url=website_url,
                    social_links=social_links,
                    all_emails=website_contacts["allEmails"][:5],
                    all_phones=website_contacts["allPhones"][:5],
                    osm_url=None,
                )

                lead_tags = ["google_maps"]
                if phone:
                    lead_tags.append("has_phone")
                if email:
                    lead_tags.append("has_email")
                if linkedin_url:
                    lead_tags.append("has_linkedin")
                if website_url:
                    lead_tags.append("has_website")

                leads.append(
                    {
                        "companyName": company_name,
                        "phone": phone,
                        "whatsapp": phone,
                        "email": email,
                        "linkedinUrl": linkedin_url,
                        "companyDomain": company_domain,
                        "city": location,
                        "country": "BR",
                        "source": "google_maps",
                        "sourceUrl": map_url,
                        "tags": lead_tags,
                        "enrichmentData": enrichment_data,
                    }
                )
                pending_leads.append(leads[-1])
                if len(pending_leads) >= 3:
                    await publish_progress(force=True, flush_leads=True)

            await publish_progress(flush_leads=True)

        debug["finalLeadCount"] = len(leads)
        logger.info(
            "Google Maps scrape finished job_id=%s leads=%s mode=%s",
            job_id,
            len(leads),
            debug.get("mode"),
        )
        if not leads:
            logger.warning(
                "Google Maps scrape finished with zero leads job_id=%s debug=%s",
                job_id,
                debug,
            )
        await reporter.finish(leads, debug=debug, send_leads=not streamed_leads)
    except Exception as exc:
        logger.exception("Google Maps scrape failed")
        await reporter.fail(str(exc))

