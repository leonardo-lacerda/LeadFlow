import logging
import re
from typing import Any, Dict, Optional

from core.config import ENRICHMENT_MOCK, CNPJ_WS_BASE_URL
from core.http import get_json
from core.proxy import proxy_manager
from .base import BaseProvider, EnrichmentResult

logger = logging.getLogger(__name__)


def _clean_cnpj(value: str) -> str:
    return re.sub(r"\D", "", value or "")


class CnpjProvider(BaseProvider):
    name = "cnpj"
    cost = 0.0

    def can_run(self, lead: Dict[str, Any]) -> bool:
        return bool(lead.get("companyCnpj"))

    def cache_key(self, lead: Dict[str, Any]) -> Optional[str]:
        cnpj = lead.get("companyCnpj")
        return _clean_cnpj(cnpj) if cnpj else None

    async def enrich(self, lead: Dict[str, Any]) -> EnrichmentResult:
        cnpj = lead.get("companyCnpj")
        if not cnpj:
            return EnrichmentResult(data={})
        if ENRICHMENT_MOCK:
            return EnrichmentResult(
                data={
                    "companyName": lead.get("companyName") or "Empresa Exemplo",
                    "companyCnpj": _clean_cnpj(cnpj),
                    "companySize": "ME",
                    "industry": "Servicos",
                    "city": "Sao Paulo",
                    "state": "SP",
                    "country": "BR",
                    "phone": "+55 11 9999-9999",
                    "email": lead.get("email"),
                },
                confidence=0.2,
            )
        if not CNPJ_WS_BASE_URL:
            raise RuntimeError("CNPJ_WS_BASE_URL not set")
        proxy = await proxy_manager.next_proxy()
        data = await get_json(
            f"{CNPJ_WS_BASE_URL.rstrip('/')}/cnpj/{_clean_cnpj(cnpj)}", proxy=proxy
        )
        address = data.get("endereco") or {}
        result = {
            "companyName": data.get("razao_social")
            or data.get("nome_fantasia")
            or data.get("nome")
            or data.get("company"),
            "companyCnpj": data.get("cnpj") or _clean_cnpj(cnpj),
            "companySize": data.get("porte"),
            "industry": data.get("cnae_principal") or data.get("atividade_principal"),
            "city": address.get("cidade") or data.get("municipio"),
            "state": address.get("estado") or data.get("uf"),
            "country": "BR",
            "phone": data.get("telefone"),
            "email": data.get("email"),
        }
        return EnrichmentResult(data=result, confidence=0.25)
