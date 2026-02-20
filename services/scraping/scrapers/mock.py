from __future__ import annotations

import re
import unicodedata
from typing import Any, Dict, List


def _slugify(value: str) -> str:
    normalized = unicodedata.normalize("NFKD", value or "")
    ascii_text = normalized.encode("ascii", "ignore").decode("ascii")
    slug = re.sub(r"[^a-zA-Z0-9]+", "", ascii_text).lower()
    return slug or "empresa"


def make_mock_leads(source: str, base_name: str, limit: int, extra: Dict[str, Any] | None = None) -> List[Dict[str, Any]]:
    leads: List[Dict[str, Any]] = []
    extra = extra or {}
    for i in range(1, limit + 1):
        domain = _slugify(base_name)
        leads.append(
            {
                "companyName": f"{base_name} {i}",
                "fullName": f"Contato {i}",
                "email": f"contato{i}@{domain}.com.br",
                "phone": f"+55 11 9{i:04d}-0000",
                "city": "Sao Paulo",
                "state": "SP",
                "country": "BR",
                "source": source,
                "tags": ["mock"],
                **extra,
            }
        )
    return leads
