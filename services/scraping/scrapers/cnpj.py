import logging
import re
from typing import Any, Dict, List, Optional

from bs4 import BeautifulSoup

from core.config import CNPJ_WS_BASE_URL, SCRAPING_MOCK, SCRAPING_NO_API
from core.http import get_json, get_text
from core.progress import ProgressReporter
from core.proxy import proxy_manager
from core.rate_limiter import RateLimiter
from .mock import make_mock_leads

logger = logging.getLogger(__name__)
limiter = RateLimiter(rpm=60)


def _clean_cnpj(value: str) -> str:
    return re.sub(r"\D", "", value or "")


def _extract_text(value: Optional[str]) -> Optional[str]:
    if not value:
        return None
    cleaned = " ".join(value.split())
    return cleaned or None


def _extract_by_labels(soup: BeautifulSoup, labels: List[str]) -> Optional[str]:
    for label in labels:
        match = soup.find(string=re.compile(label, re.IGNORECASE))
        if not match:
            continue
        if match.parent:
            parent = match.parent
            if parent.name in {"th", "dt", "span", "b", "strong"}:
                sibling = parent.find_next_sibling(["td", "dd", "span", "div"])
                if sibling:
                    return _extract_text(sibling.get_text(" ", strip=True))
            sibling = parent.find_next_sibling()
            if sibling:
                return _extract_text(sibling.get_text(" ", strip=True))
        inline = _extract_text(str(match))
        if inline and ":" in inline:
            return _extract_text(inline.split(":", 1)[1])
    return None


def _extract_company_name(soup: BeautifulSoup) -> Optional[str]:
    heading = soup.find(["h1", "h2"])
    if heading:
        return _extract_text(heading.get_text(" ", strip=True))
    if soup.title and soup.title.string:
        title = _extract_text(soup.title.string)
        if title and "-" in title:
            return _extract_text(title.split("-", 1)[-1])
        return title
    return None


def _lead_from_provider(data: Dict[str, Any], cleaned: str) -> Dict[str, Any]:
    company_name = (
        data.get("razao_social")
        or data.get("nome_fantasia")
        or data.get("nome")
        or data.get("company")
    )
    address = data.get("endereco") or {}
    return {
        "companyName": company_name,
        "companyCnpj": data.get("cnpj") or cleaned,
        "companySize": data.get("porte"),
        "industry": data.get("cnae_principal") or data.get("atividade_principal"),
        "city": address.get("cidade") or data.get("municipio"),
        "state": address.get("estado") or data.get("uf"),
        "country": "BR",
        "phone": data.get("telefone"),
        "email": data.get("email"),
        "source": "cnpj",
        "sourceUrl": f"{CNPJ_WS_BASE_URL.rstrip('/')}/cnpj/{cleaned}",
        "tags": ["cnpj"],
    }


def _lead_from_cnpjbiz(soup: BeautifulSoup, cleaned: str) -> Dict[str, Any]:
    company_name = _extract_company_name(soup)
    email = _extract_by_labels(soup, ["E-mail", "Email"])
    phone = _extract_by_labels(soup, ["Telefone", "Fone", "Contato"])
    city = _extract_by_labels(soup, ["Municipio", "Municipio", "Munic"])
    state = _extract_by_labels(soup, ["UF", "Estado"])
    industry = _extract_by_labels(soup, ["Atividade principal", "CNAE", "Atividade"])
    company_size = _extract_by_labels(soup, ["Porte"])

    return {
        "companyName": company_name,
        "companyCnpj": cleaned,
        "companySize": company_size,
        "industry": industry,
        "city": city,
        "state": state,
        "country": "BR",
        "phone": phone,
        "email": email,
        "source": "cnpj",
        "sourceUrl": f"https://cnpj.biz/{cleaned}",
        "tags": ["cnpj"],
    }


def _lead_from_receitaws(data: Dict[str, Any], cleaned: str) -> Optional[Dict[str, Any]]:
    if not isinstance(data, dict):
        return None

    status = str(data.get("status") or "").upper()
    if status and status != "OK":
        return None

    company_name = (
        data.get("nome")
        or data.get("fantasia")
        or data.get("razao_social")
        or data.get("nome_fantasia")
    )
    industry = data.get("atividade_principal")
    if isinstance(industry, list) and industry:
        first = industry[0]
        industry = first.get("text") if isinstance(first, dict) else str(first)

    website = data.get("site")

    return {
        "companyName": company_name,
        "companyCnpj": data.get("cnpj") or cleaned,
        "companySize": data.get("porte"),
        "industry": industry,
        "city": data.get("municipio"),
        "state": data.get("uf"),
        "country": "BR",
        "phone": data.get("telefone"),
        "email": data.get("email"),
        "companyDomain": website,
        "source": "cnpj",
        "sourceUrl": f"https://www.receitaws.com.br/v1/cnpj/{cleaned}",
        "tags": ["cnpj", "receitaws"],
    }


async def scrape(
    cnpj: str | List[str],
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
            leads = make_mock_leads("cnpj", "CNPJ", min(limit, 5), {"companyCnpj": "00000000000100"})
        else:
            cnpjs = cnpj if isinstance(cnpj, list) else [cnpj]
            leads: List[Dict[str, Any]] = []
            total = min(limit, len(cnpjs))
            await reporter.update(0, total_items=total, force=True)

            for index, raw in enumerate(cnpjs[:limit], start=1):
                cleaned = _clean_cnpj(raw)
                if len(cleaned) != 14:
                    leads.append(
                        {
                            "companyCnpj": cleaned,
                            "source": "cnpj",
                            "sourceUrl": f"https://cnpj.biz/{cleaned}",
                            "tags": ["cnpj", "partial"],
                        }
                    )
                    await reporter.update(index, leads=[leads[-1]])
                    streamed_leads = True
                    continue

                proxy = await proxy_manager.next_proxy()
                lead_row: Optional[Dict[str, Any]] = None

                if not SCRAPING_NO_API and CNPJ_WS_BASE_URL:
                    try:
                        async with limiter:
                            data = await get_json(
                                f"{CNPJ_WS_BASE_URL.rstrip('/')}/cnpj/{cleaned}",
                                proxy=proxy,
                            )
                        lead_row = _lead_from_provider(data, cleaned)
                    except Exception as exc:
                        logger.warning("CNPJ provider failed for %s: %s", cleaned, str(exc))

                if not lead_row:
                    try:
                        async with limiter:
                            html = await get_text(f"https://cnpj.biz/{cleaned}", proxy=proxy)
                        soup = BeautifulSoup(html, "lxml")
                        lead_row = _lead_from_cnpjbiz(soup, cleaned)
                    except Exception as exc:
                        logger.warning("CNPJ cnpj.biz failed for %s: %s", cleaned, str(exc))

                if not lead_row:
                    try:
                        async with limiter:
                            data = await get_json(
                                f"https://www.receitaws.com.br/v1/cnpj/{cleaned}",
                                proxy=proxy,
                            )
                        lead_row = _lead_from_receitaws(data, cleaned)
                    except Exception as exc:
                        logger.warning("CNPJ receitaws failed for %s: %s", cleaned, str(exc))

                if lead_row:
                    leads.append(lead_row)
                else:
                    leads.append(
                        {
                            "companyCnpj": cleaned,
                            "source": "cnpj",
                            "sourceUrl": f"https://cnpj.biz/{cleaned}",
                            "tags": ["cnpj", "partial"],
                        }
                    )

                await reporter.update(index, leads=[leads[-1]])
                streamed_leads = True

        await reporter.finish(leads, send_leads=not streamed_leads)
    except Exception as exc:
        logger.exception("CNPJ scrape failed")
        await reporter.fail(str(exc))
