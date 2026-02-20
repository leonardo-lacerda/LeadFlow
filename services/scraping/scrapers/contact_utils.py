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
