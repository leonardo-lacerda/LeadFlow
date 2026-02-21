import re
from typing import Any, Dict, List, Optional
from urllib.parse import urlparse

from bs4 import BeautifulSoup

from core.http import get_text

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
DEFAULT_NON_BUSINESS_DOMAINS = (
    "google.com",
    "google.com.br",
    "googleusercontent.com",
    "duckduckgo.com",
    "bing.com",
    "search.brave.com",
    "linkedin.com",
    "indeed.com",
    "indeed.com.br",
    "catho.com.br",
    "reclameaqui.com.br",
    "mercadolivre.com.br",
    "mercadolibre.com",
    "comprasnet.gov.br",
    "gov.br",
)


def normalize_url(value: Optional[str]) -> Optional[str]:
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


def normalize_domain(value: Optional[str]) -> Optional[str]:
    if not value:
        return None
    normalized_url = normalize_url(value)
    if normalized_url:
        return extract_domain(normalized_url)
    cleaned = str(value).strip().lower()
    if not cleaned:
        return None
    cleaned = re.sub(r"^https?://", "", cleaned, flags=re.IGNORECASE)
    cleaned = cleaned.split("/", 1)[0].strip()
    if cleaned.startswith("www."):
        cleaned = cleaned[4:]
    return cleaned or None


def extract_domain(value: Optional[str]) -> Optional[str]:
    if not value:
        return None
    parsed = urlparse(value)
    host = (parsed.hostname or "").strip().lower()
    if host.startswith("www."):
        host = host[4:]
    return host or None


def is_social_domain(domain: Optional[str]) -> bool:
    if not domain:
        return False
    return any(host in domain for host in SOCIAL_HOSTS.values())


def is_non_business_domain(
    domain: Optional[str],
    blocked_domains: Optional[List[str]] = None,
) -> bool:
    normalized = normalize_domain(domain)
    if not normalized:
        return True
    merged_blocklist = list(DEFAULT_NON_BUSINESS_DOMAINS)
    for item in blocked_domains or []:
        value = normalize_domain(item)
        if value:
            merged_blocklist.append(value)
    return any(
        normalized == blocked or normalized.endswith(f".{blocked}")
        for blocked in merged_blocklist
    )


def filter_business_domain(
    domain: Optional[str],
    blocked_domains: Optional[List[str]] = None,
) -> Optional[str]:
    normalized = normalize_domain(domain)
    if not normalized:
        return None
    if is_non_business_domain(normalized, blocked_domains):
        return None
    return normalized


def dedupe_tags(values: List[Optional[str]], source_tag: Optional[str] = None) -> List[str]:
    result: List[str] = []
    seen = set()

    def _push(raw: Optional[str]) -> None:
        if not raw:
            return
        cleaned = " ".join(str(raw).split()).strip()
        if not cleaned:
            return
        key = cleaned.lower()
        if key in seen:
            return
        seen.add(key)
        result.append(cleaned)

    _push(source_tag)
    for value in values:
        _push(value)
    return result


def _normalize_email(value: Optional[str]) -> Optional[str]:
    if not value:
        return None
    cleaned = str(value).strip().lower().strip(".,;:<>")
    if not cleaned:
        return None
    if not EMAIL_PATTERN.fullmatch(cleaned):
        return None
    return cleaned


def _normalize_phone(value: Optional[str]) -> Optional[str]:
    if not value:
        return None
    cleaned = " ".join(str(value).split()).strip()
    if not cleaned:
        return None
    digits = re.sub(r"\D", "", cleaned)
    if len(digits) < 8:
        return None
    return cleaned


def _normalize_email_list(values: List[Optional[str]], max_items: int = 5) -> List[str]:
    result: List[str] = []
    seen = set()
    for value in values:
        normalized = _normalize_email(value)
        if not normalized or normalized in seen:
            continue
        seen.add(normalized)
        result.append(normalized)
        if len(result) >= max_items:
            break
    return result


def _normalize_phone_list(values: List[Optional[str]], max_items: int = 5) -> List[str]:
    result: List[str] = []
    seen = set()
    for value in values:
        normalized = _normalize_phone(value)
        if not normalized:
            continue
        digits_key = re.sub(r"\D", "", normalized)
        if digits_key in seen:
            continue
        seen.add(digits_key)
        result.append(normalized)
        if len(result) >= max_items:
            break
    return result


def sanitize_contact_profile(
    profile: Dict[str, Any],
    blocked_domains: Optional[List[str]] = None,
) -> Dict[str, Any]:
    raw_emails = profile.get("emails")
    raw_phones = profile.get("phones")
    emails = _normalize_email_list(
        raw_emails if isinstance(raw_emails, list) else [profile.get("email")]
    )
    phones = _normalize_phone_list(
        raw_phones if isinstance(raw_phones, list) else [profile.get("phone")]
    )

    socials_raw = profile.get("socials")
    socials = (
        extract_social_links(
            list(socials_raw.values()) if isinstance(socials_raw, dict) else []
        )
        if socials_raw
        else {}
    )

    title_value = profile.get("title")
    title = " ".join(str(title_value).split()).strip() if title_value else None
    if title == "":
        title = None

    return {
        "url": normalize_url(profile.get("url")),
        "domain": filter_business_domain(profile.get("domain"), blocked_domains),
        "email": emails[0] if emails else None,
        "phone": phones[0] if phones else None,
        "emails": emails,
        "phones": phones,
        "socials": socials,
        "title": title,
    }


def extract_social_links(values: List[Optional[str]]) -> Dict[str, str]:
    links: Dict[str, str] = {}
    for raw in values:
        url = normalize_url(raw)
        domain = extract_domain(url)
        if not url or not domain:
            continue
        for label, host in SOCIAL_HOSTS.items():
            if host in domain and label not in links:
                links[label] = url
    return links


def extract_contacts_from_html(html: str) -> Dict[str, Any]:
    soup = BeautifulSoup(html, "lxml")
    title = (soup.title.get_text(strip=True) if soup.title else "") or None
    text_content = soup.get_text(" ", strip=True)
    emails = list(dict.fromkeys(EMAIL_PATTERN.findall(text_content)))[:5]
    phones = list(dict.fromkeys(PHONE_PATTERN.findall(text_content)))[:5]

    href_values: List[Optional[str]] = []
    for link in soup.select("a[href]"):
        href = (link.get("href") or "").strip()
        if not href:
            continue
        if href.lower().startswith("mailto:"):
            mail = href.split(":", 1)[1].strip()
            if mail:
                emails.append(mail)
            continue
        if href.lower().startswith("tel:"):
            phone = href.split(":", 1)[1].strip()
            if phone:
                phones.append(phone)
            continue
        href_values.append(href)

    socials = extract_social_links(href_values)

    dedup_emails = list(dict.fromkeys(emails))[:5]
    dedup_phones = list(dict.fromkeys(phones))[:5]

    return {
        "title": title,
        "email": dedup_emails[0] if dedup_emails else None,
        "phone": dedup_phones[0] if dedup_phones else None,
        "emails": dedup_emails,
        "phones": dedup_phones,
        "socials": socials,
    }


async def fetch_contact_profile(url: Optional[str], proxy: Optional[str] = None) -> Dict[str, Any]:
    normalized = normalize_url(url)
    if not normalized:
        return {
            "url": None,
            "domain": None,
            "email": None,
            "phone": None,
            "emails": [],
            "phones": [],
            "socials": {},
            "title": None,
        }

    domain = extract_domain(normalized)
    if is_social_domain(domain):
        return {
            "url": normalized,
            "domain": None,
            "email": None,
            "phone": None,
            "emails": [],
            "phones": [],
            "socials": extract_social_links([normalized]),
            "title": None,
        }

    try:
        html = await get_text(
            normalized,
            proxy=proxy,
            headers={"accept-language": "pt-BR,pt;q=0.9,en-US;q=0.8"},
        )
        details = extract_contacts_from_html(html)
        return {
            "url": normalized,
            "domain": domain,
            **details,
        }
    except Exception:
        return {
            "url": normalized,
            "domain": domain,
            "email": None,
            "phone": None,
            "emails": [],
            "phones": [],
            "socials": {},
            "title": None,
        }
