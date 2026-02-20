from __future__ import annotations

import re
from typing import Dict, List, Optional
from urllib.parse import parse_qs, quote_plus, unquote, urlparse

from bs4 import BeautifulSoup

from core.http import get_text
from core.rate_limiter import RateLimiter

limiter = RateLimiter(rpm=20)
_SEARCH_DOMAINS = (
    "google.",
    "duckduckgo.com",
    "bing.com",
    "search.brave.com",
    "gstatic.com",
    "googleusercontent.com",
)
_LOW_VALUE_TITLES = {
    "read more",
    "translate this page",
    "about",
    "saiba mais",
    "ver mais",
}
_ASSET_EXTENSIONS = (
    ".png",
    ".jpg",
    ".jpeg",
    ".gif",
    ".webp",
    ".svg",
    ".ico",
    ".css",
    ".js",
)


def _extract_duckduckgo_url(raw_url: str) -> str:
    if not raw_url:
        return raw_url
    parsed = urlparse(raw_url)
    if parsed.netloc.endswith("duckduckgo.com") and parsed.path.startswith("/l/"):
        qs = parse_qs(parsed.query)
        candidate = (qs.get("uddg") or [None])[0]
        if candidate:
            return unquote(candidate)
    return raw_url


def _extract_google_redirect_url(raw_url: str) -> str:
    if not raw_url:
        return raw_url
    parsed = urlparse(raw_url)
    if "google." not in parsed.netloc:
        return raw_url
    qs = parse_qs(parsed.query)
    for key in ("url", "q", "uddg"):
        candidate = (qs.get(key) or [None])[0]
        if candidate and candidate.startswith("http"):
            return unquote(candidate)
    return raw_url


def _normalize_result_url(raw_url: str) -> str:
    if not raw_url:
        return raw_url
    value = raw_url.strip()
    value = re.sub(r"#.*$", "", value)
    value = value.rstrip(".,;")
    return value


def _is_blocked_host(host: str) -> bool:
    host_value = host.strip().lower()
    if not host_value:
        return True
    if host_value in {"localhost", "127.0.0.1", "::1"}:
        return True
    if host_value.endswith(".local"):
        return True
    if host_value.startswith("10.") or host_value.startswith("192.168.") or host_value.startswith("172.16."):
        return True
    return False


def _is_search_navigation_url(url: str) -> bool:
    parsed = urlparse(url)
    host = (parsed.netloc or "").lower()
    if _is_blocked_host(host):
        return True
    if any(domain in host for domain in _SEARCH_DOMAINS):
        return True
    if parsed.path.startswith("/search"):
        return True
    if parsed.path.lower().endswith(_ASSET_EXTENSIONS):
        return True
    return False


def _is_low_value_title(value: str) -> bool:
    normalized = re.sub(r"\s+", " ", value).strip().lower()
    if normalized.startswith("![image"):
        return True
    if normalized.startswith("image "):
        return True
    return normalized in _LOW_VALUE_TITLES


def _extract_site_filters(query: str) -> List[Dict[str, str]]:
    filters: List[Dict[str, str]] = []
    for match in re.findall(r"\bsite:([^\s]+)", query, flags=re.IGNORECASE):
        token = match.strip().strip('"').strip("'")
        if not token:
            continue
        normalized = token
        if not re.match(r"^https?://", normalized, flags=re.IGNORECASE):
            normalized = f"https://{normalized}"
        parsed = urlparse(normalized)
        domain = (parsed.netloc or parsed.path or "").strip().lower()
        domain = domain.replace("www.", "")
        path = (parsed.path or "").strip()
        if not domain:
            continue
        filters.append(
            {
                "domain": domain,
                "path": path,
            }
        )
    return filters


def _matches_site_filters(url: str, site_filters: List[Dict[str, str]]) -> bool:
    if not site_filters:
        return True
    parsed = urlparse(url)
    host = (parsed.netloc or "").lower().replace("www.", "")
    path = parsed.path or "/"
    for site_filter in site_filters:
        domain = site_filter["domain"]
        path_prefix = site_filter["path"] or ""
        if not (host == domain or host.endswith("." + domain)):
            continue
        if path_prefix and not path.startswith(path_prefix):
            continue
        return True
    return False


def _apply_site_filters(results: List[Dict[str, str]], site_filters: List[Dict[str, str]]) -> List[Dict[str, str]]:
    if not site_filters:
        return results
    return [item for item in results if _matches_site_filters(item.get("url") or "", site_filters)]


def _dedupe_merge(existing: List[Dict[str, str]], fresh: List[Dict[str, str]], limit: int) -> List[Dict[str, str]]:
    seen = {
        (_normalize_result_url(item.get("url") or "").lower(), (item.get("title") or "").strip().lower())
        for item in existing
    }
    merged = list(existing)
    for item in fresh:
        title = (item.get("title") or "").strip()
        url = _normalize_result_url(item.get("url") or "")
        if not title or not url or _is_low_value_title(title) or _is_search_navigation_url(url):
            continue
        key = (url.lower(), title.lower())
        if key in seen:
            continue
        seen.add(key)
        merged.append({"title": title, "url": url})
        if len(merged) >= limit:
            break
    return merged[:limit]


async def duckduckgo_search(
    query: str,
    limit: int,
    proxy: Optional[str] = None,
) -> List[Dict[str, str]]:
    async with limiter:
        html = await get_text("https://duckduckgo.com/html/", params={"q": query}, proxy=proxy)
    soup = BeautifulSoup(html, "lxml")
    results: List[Dict[str, str]] = []
    for link in soup.select("a.result__a"):
        title = (link.get_text() or "").strip()
        href = link.get("href") or ""
        if not title or not href:
            continue
        results.append(
            {
                "title": title,
                "url": _extract_duckduckgo_url(href),
            }
        )
        if len(results) >= limit:
            break
    return results


async def bing_search(
    query: str,
    limit: int,
    proxy: Optional[str] = None,
) -> List[Dict[str, str]]:
    async with limiter:
        html = await get_text("https://www.bing.com/search", params={"q": query}, proxy=proxy)
    soup = BeautifulSoup(html, "lxml")
    results: List[Dict[str, str]] = []
    for link in soup.select("li.b_algo h2 a"):
        title = (link.get_text() or "").strip()
        href = (link.get("href") or "").strip()
        if not title or not href:
            continue
        results.append(
            {
                "title": title,
                "url": href,
            }
        )
        if len(results) >= limit:
            break
    return results


async def brave_search(
    query: str,
    limit: int,
    proxy: Optional[str] = None,
) -> List[Dict[str, str]]:
    async with limiter:
        html = await get_text(
            "https://search.brave.com/search",
            params={"q": query, "source": "web"},
            proxy=proxy,
        )
    soup = BeautifulSoup(html, "lxml")
    results: List[Dict[str, str]] = []
    seen = set()
    for link in soup.select("main a[href]"):
        href = (link.get("href") or "").strip()
        if not href or not href.startswith("http"):
            continue
        if "search.brave.com" in href:
            continue
        title = (link.get_text() or "").strip()
        if not title:
            continue
        dedupe_key = (title.lower(), href)
        if dedupe_key in seen:
            continue
        seen.add(dedupe_key)
        results.append(
            {
                "title": title,
                "url": href,
            }
        )
        if len(results) >= limit:
            break
    return results


def _parse_jina_markdown_links(markdown: str) -> List[Dict[str, str]]:
    results: List[Dict[str, str]] = []
    seen = set()
    for match in re.finditer(r"(?<!!)\[([^\]]+)\]\((https?://[^\s\)]+)\)", markdown):
        title = (match.group(1) or "").strip()
        raw_url = (match.group(2) or "").strip()
        if not title or not raw_url:
            continue
        url = _normalize_result_url(_extract_google_redirect_url(unquote(raw_url)))
        if not url or _is_search_navigation_url(url) or _is_low_value_title(title):
            continue
        key = (title.lower(), url.lower())
        if key in seen:
            continue
        seen.add(key)
        results.append({"title": title, "url": url})
    return results


def _parse_jina_raw_links(markdown: str) -> List[Dict[str, str]]:
    # Some r.jina pages contain plain links not formatted as markdown anchors.
    results: List[Dict[str, str]] = []
    seen = set()
    for raw_url in re.findall(r"https?://[^\s\)\]]+", markdown):
        url = _normalize_result_url(_extract_google_redirect_url(unquote(raw_url)))
        if not url or _is_search_navigation_url(url):
            continue
        if url.lower() in seen:
            continue
        seen.add(url.lower())
        host = (urlparse(url).netloc or "resultado").replace("www.", "")
        if _is_blocked_host(host):
            continue
        results.append({"title": host, "url": url})
    return results


async def jina_google_search(
    query: str,
    limit: int,
    proxy: Optional[str] = None,
) -> List[Dict[str, str]]:
    source_url = f"http://www.google.com/search?q={quote_plus(query)}"
    async with limiter:
        markdown = await get_text(f"https://r.jina.ai/{source_url}", proxy=proxy)

    results = _parse_jina_markdown_links(markdown)
    if len(results) < limit:
        results = _dedupe_merge(results, _parse_jina_raw_links(markdown), limit)
    return results[:limit]


async def web_search(
    query: str,
    limit: int,
    proxy: Optional[str] = None,
) -> List[Dict[str, str]]:
    providers = (
        duckduckgo_search,
        bing_search,
        brave_search,
        jina_google_search,
    )
    results: List[Dict[str, str]] = []
    site_filters = _extract_site_filters(query)
    for provider in providers:
        try:
            provider_results = await provider(query, limit=limit, proxy=proxy)
        except Exception:
            provider_results = []
        if not provider_results:
            continue
        provider_results = _apply_site_filters(provider_results, site_filters)
        if not provider_results:
            continue
        results = _dedupe_merge(results, provider_results, limit)
        if len(results) >= limit:
            break
    return results[:limit]
