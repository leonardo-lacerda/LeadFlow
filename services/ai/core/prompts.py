from __future__ import annotations

import asyncio
import json
import os
from dataclasses import asdict, dataclass, field
from datetime import datetime
from typing import Dict, List, Optional
from uuid import uuid4


@dataclass
class Prompt:
    id: str
    name: str
    content: str
    variables: List[str] = field(default_factory=list)
    description: Optional[str] = None
    category: Optional[str] = None
    created_at: str = ""
    updated_at: str = ""

    def to_dict(self) -> Dict[str, object]:
        return asdict(self)


DEFAULT_PROMPTS: List[Dict[str, object]] = [
    {
        "name": "lead_scoring",
        "category": "scoring",
        "description": "Score lead fit and ICP match",
        "variables": ["lead_summary", "icp_summary"],
        "content": (
            "You are a B2B lead scoring assistant.\n"
            "Return JSON only with keys: score (0-100), icp_match (0-1), explanation (string), tags (array).\n\n"
            "Lead:\n{{lead_summary}}\n\n"
            "ICP:\n{{icp_summary}}"
        ),
    },
    {
        "name": "email_generation",
        "category": "generation",
        "description": "Generate an outbound email",
        "variables": ["lead_summary", "company_summary", "tone", "language"],
        "content": (
            "You are an SDR writing outbound emails.\n"
            "Return JSON only: {\"subject\": \"...\", \"body\": \"...\"}.\n\n"
            "Tone: {{tone}}\n"
            "Language: {{language}}\n\n"
            "Lead:\n{{lead_summary}}\n\n"
            "Company:\n{{company_summary}}"
        ),
    },
    {
        "name": "whatsapp_generation",
        "category": "generation",
        "description": "Generate a WhatsApp message",
        "variables": ["lead_summary", "company_summary", "tone", "language"],
        "content": (
            "You are an SDR writing WhatsApp outreach. Keep it short.\n"
            "Return JSON only: {\"message\": \"...\"}.\n\n"
            "Tone: {{tone}}\n"
            "Language: {{language}}\n\n"
            "Lead:\n{{lead_summary}}\n\n"
            "Company:\n{{company_summary}}"
        ),
    },
    {
        "name": "intent_classification",
        "category": "analysis",
        "description": "Classify intent of a reply",
        "variables": ["message"],
        "content": (
            "Classify the intent of the reply.\n"
            "Possible intents: interested, not_interested, question, meeting_request, follow_up, complaint, unknown.\n"
            "Return JSON only: {\"intent\": \"...\", \"confidence\": 0-1}.\n\n"
            "Reply:\n{{message}}"
        ),
    },
    {
        "name": "sentiment_analysis",
        "category": "analysis",
        "description": "Analyze sentiment of a reply",
        "variables": ["message"],
        "content": (
            "Analyze sentiment of the reply.\n"
            "Return JSON only: {\"sentiment\": \"positive|neutral|negative\", \"confidence\": 0-1}.\n\n"
            "Reply:\n{{message}}"
        ),
    },
    {
        "name": "auto_categorization",
        "category": "analysis",
        "description": "Auto categorize replies",
        "variables": ["message"],
        "content": (
            "Categorize the reply into a short label (e.g. pricing, timing, competitor, objections, invalid).\n"
            "Return JSON only: {\"category\": \"...\"}.\n\n"
            "Reply:\n{{message}}"
        ),
    },
    {
        "name": "suggested_response",
        "category": "analysis",
        "description": "Suggest a response",
        "variables": ["message", "tone", "language"],
        "content": (
            "Write a short suggested response.\n"
            "Return JSON only: {\"response\": \"...\"}.\n\n"
            "Tone: {{tone}}\nLanguage: {{language}}\n\nReply:\n{{message}}"
        ),
    },
    {
        "name": "meeting_detection",
        "category": "analysis",
        "description": "Detect meeting intent",
        "variables": ["message"],
        "content": (
            "Detect if the reply is asking for a meeting or scheduling.\n"
            "Return JSON only: {\"meeting_detected\": true|false, \"details\": \"...\"}.\n\n"
            "Reply:\n{{message}}"
        ),
    },
    {
        "name": "best_time_prediction",
        "category": "prediction",
        "description": "Predict best time to send",
        "variables": ["lead_summary"],
        "content": (
            "Predict the best time window to send outreach (weekday + time range).\n"
            "Return JSON only: {\"best_time\": \"...\", \"reason\": \"...\"}.\n\n"
            "Lead:\n{{lead_summary}}"
        ),
    },
    {
        "name": "subject_optimization",
        "category": "optimization",
        "description": "Optimize subject line",
        "variables": ["subject", "lead_summary"],
        "content": (
            "Improve the subject line for higher opens.\n"
            "Return JSON only: {\"subject\": \"...\", \"reason\": \"...\"}.\n\n"
            "Original subject:\n{{subject}}\n\nLead:\n{{lead_summary}}"
        ),
    },
    {
        "name": "length_optimization",
        "category": "optimization",
        "description": "Optimize message length",
        "variables": ["message"],
        "content": (
            "Rewrite the message to optimal length and clarity.\n"
            "Return JSON only: {\"message\": \"...\"}.\n\n"
            "Message:\n{{message}}"
        ),
    },
    {
        "name": "engagement_prediction",
        "category": "prediction",
        "description": "Predict engagement likelihood",
        "variables": ["message", "lead_summary"],
        "content": (
            "Predict engagement likelihood from 0 to 1.\n"
            "Return JSON only: {\"engagement\": 0-1, \"reason\": \"...\"}.\n\n"
            "Message:\n{{message}}\n\nLead:\n{{lead_summary}}"
        ),
    },
]


class PromptStore:
    def __init__(self, path: str) -> None:
        self._path = path
        self._prompts: Dict[str, Prompt] = {}
        self._lock = asyncio.Lock()

    async def load(self) -> None:
        if not os.path.exists(self._path):
            return
        with open(self._path, "r", encoding="utf-8") as handle:
            data = json.load(handle)
        for item in data:
            prompt = Prompt(**item)
            self._prompts[prompt.id] = prompt

    async def save(self) -> None:
        os.makedirs(os.path.dirname(self._path), exist_ok=True)
        with open(self._path, "w", encoding="utf-8") as handle:
            json.dump([p.to_dict() for p in self._prompts.values()], handle, indent=2)

    async def ensure_defaults(self) -> None:
        if self._prompts:
            return
        for item in DEFAULT_PROMPTS:
            await self.create(
                name=str(item["name"]),
                content=str(item["content"]),
                variables=list(item.get("variables", [])),
                description=item.get("description"),
                category=item.get("category"),
            )

    async def list(self) -> List[Prompt]:
        async with self._lock:
            return list(self._prompts.values())

    async def get(self, prompt_id: str) -> Optional[Prompt]:
        async with self._lock:
            return self._prompts.get(prompt_id)

    async def create(
        self,
        name: str,
        content: str,
        variables: Optional[List[str]] = None,
        description: Optional[str] = None,
        category: Optional[str] = None,
    ) -> Prompt:
        now = datetime.utcnow().isoformat() + "Z"
        prompt = Prompt(
            id=uuid4().hex,
            name=name,
            content=content,
            variables=variables or [],
            description=description,
            category=category,
            created_at=now,
            updated_at=now,
        )
        async with self._lock:
            self._prompts[prompt.id] = prompt
            await self.save()
        return prompt

    async def update(
        self,
        prompt_id: str,
        name: Optional[str] = None,
        content: Optional[str] = None,
        variables: Optional[List[str]] = None,
        description: Optional[str] = None,
        category: Optional[str] = None,
    ) -> Optional[Prompt]:
        async with self._lock:
            prompt = self._prompts.get(prompt_id)
            if not prompt:
                return None
            if name is not None:
                prompt.name = name
            if content is not None:
                prompt.content = content
            if variables is not None:
                prompt.variables = variables
            if description is not None:
                prompt.description = description
            if category is not None:
                prompt.category = category
            prompt.updated_at = datetime.utcnow().isoformat() + "Z"
            await self.save()
            return prompt

    async def delete(self, prompt_id: str) -> bool:
        async with self._lock:
            if prompt_id not in self._prompts:
                return False
            self._prompts.pop(prompt_id, None)
            await self.save()
            return True
