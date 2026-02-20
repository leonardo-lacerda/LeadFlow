from __future__ import annotations

import json
import re
from typing import Any, Dict


def resolve_value(data: Dict[str, Any], path: str) -> Any:
    current: Any = data
    for part in path.split("."):
        if isinstance(current, dict) and part in current:
            current = current[part]
        else:
            return ""
    return current


def render_template(template: str, variables: Dict[str, Any]) -> str:
    pattern = re.compile(r"{{\s*([^}]+)\s*}}")

    def repl(match: re.Match[str]) -> str:
        key = match.group(1).strip()
        value = resolve_value(variables, key)
        return "" if value is None else str(value)

    return pattern.sub(repl, template)


def extract_json(text: str) -> Dict[str, Any]:
    if not text:
        return {}
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        pass

    start = text.find("{")
    end = text.rfind("}")
    if start == -1 or end == -1 or end <= start:
        return {}
    snippet = text[start : end + 1]
    try:
        return json.loads(snippet)
    except json.JSONDecodeError:
        return {}


def safe_float(value: Any, default: float = 0.0) -> float:
    try:
        return float(value)
    except (TypeError, ValueError):
        return default


def safe_int(value: Any, default: int = 0) -> int:
    try:
        return int(float(value))
    except (TypeError, ValueError):
        return default


def build_lead_summary(lead: Dict[str, Any]) -> str:
    if not lead:
        return ""
    parts = []
    name = lead.get("fullName") or lead.get("name") or ""
    if name:
        parts.append(f"Name: {name}")
    title = lead.get("jobTitle") or lead.get("title") or ""
    if title:
        parts.append(f"Title: {title}")
    email = lead.get("email") or ""
    if email:
        parts.append(f"Email: {email}")
    phone = lead.get("phone") or lead.get("whatsapp") or ""
    if phone:
        parts.append(f"Phone: {phone}")
    linkedin = lead.get("linkedinUrl") or lead.get("linkedin") or ""
    if linkedin:
        parts.append(f"LinkedIn: {linkedin}")
    company = lead.get("companyName") or lead.get("company") or ""
    if company:
        parts.append(f"Company: {company}")
    size = lead.get("companySize") or ""
    if size:
        parts.append(f"Company size: {size}")
    industry = lead.get("industry") or ""
    if industry:
        parts.append(f"Industry: {industry}")
    location = ", ".join(
        part
        for part in [lead.get("city"), lead.get("state"), lead.get("country")]
        if part
    )
    if location:
        parts.append(f"Location: {location}")
    return "\n".join(parts)


def build_company_summary(company: Dict[str, Any]) -> str:
    if not company:
        return ""
    parts = []
    name = company.get("name") or ""
    if name:
        parts.append(f"Name: {name}")
    domain = company.get("domain") or company.get("website") or ""
    if domain:
        parts.append(f"Domain: {domain}")
    size = company.get("size") or ""
    if size:
        parts.append(f"Size: {size}")
    industry = company.get("industry") or ""
    if industry:
        parts.append(f"Industry: {industry}")
    return "\n".join(parts)
