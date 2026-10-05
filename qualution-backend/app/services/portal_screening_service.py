import json
import logging
import re
from pathlib import Path
from typing import Optional, Dict, Any

from app.core.config import settings
from app.schemas.portal_screening import ScreeningOutput, ALLOWED_SCREENING_FLAGS
from app.services.providers.nvidia_provider import nvidia_provider

logger = logging.getLogger("portal_screening_service")

PROMPT_FILE = Path(__file__).resolve().parent.parent.parent / "prompts" / "screen_submission.v1.txt"
PROMPT_VERSION = "screen_submission.v1"


def load_prompt_template() -> str:
    """Loads the versioned prompt template from disk."""
    if not PROMPT_FILE.exists():
        logger.warning(f"Screening prompt template file not found at {PROMPT_FILE}, using built-in fallback.")
        return (
            "Analyze the community submission and output JSON conforming strictly to schema.\n"
            "Title: {title}\nType: {submission_type}\nNote: {note}\nURL: {url}"
        )
    with open(PROMPT_FILE, "r", encoding="utf-8") as f:
        return f.read()


PROMPT_TEMPLATE = load_prompt_template()


class PortalScreeningService:
    def __init__(self):
        self.prompt_version = PROMPT_VERSION

    @property
    def prompt_template(self) -> str:
        return load_prompt_template()

    def _extract_json_block(self, text: str) -> Optional[Dict[str, Any]]:
        """Extracts JSON dictionary from raw LLM output even if surrounded by markdown fences."""
        if not text:
            return None
        text = text.strip()
        # Strip markdown fences if present
        if text.startswith("```"):
            lines = text.splitlines()
            if lines[0].startswith("```"):
                lines = lines[1:]
            if lines and lines[-1].startswith("```"):
                lines = lines[:-1]
            text = "\n".join(lines).strip()

        try:
            return json.loads(text)
        except Exception:
            pass

        match = re.search(r"\{.*\}", text, re.DOTALL)
        if match:
            try:
                return json.loads(match.group(0))
            except Exception:
                pass
        return None

    def fallback_screening(self, reason: str = "AI screening unavailable") -> ScreeningOutput:
        """
        Graceful fallback when LLM is unavailable or invalid.
        Mark as 'unscreened' so human moderators can review.
        """
        return ScreeningOutput(
            relevance_score=1.0,
            spam_likelihood=0.0,
            flags=["unscreened"],
            reason=f"Pending human review ({reason})."
        )

    def screen_submission(
        self,
        title: str,
        submission_type: str,
        note: str,
        url: Optional[str] = None,
    ) -> ScreeningOutput:
        """
        Runs automated safety and relevance screening on user submissions.
        Returns a validated ScreeningOutput. On failure/timeout, gracefully falls back to unscreened.
        """
        url_text = url or "None"
        formatted_prompt = self.prompt_template.format(
            title=title,
            submission_type=submission_type,
            note=note,
            url=url_text,
        )

        system_instruction = (
            "You are the QUALUTION Telemetry Portal Community Safety & Quality Screener. "
            "Output ONLY valid raw JSON conforming strictly to the requested schema."
        )

        # Attempt 1 + 1 retry on malformed JSON
        for attempt in range(2):
            try:
                raw_response, _, status_code = nvidia_provider._call_chat_completions(
                    system_prompt=system_instruction,
                    user_prompt=formatted_prompt,
                    max_tokens=400,
                    temperature=0.1,
                )

                if raw_response and status_code == "success":
                    data = self._extract_json_block(raw_response)
                    if data and isinstance(data, dict):
                        # Filter flags to ALLOWED_SCREENING_FLAGS
                        raw_flags = data.get("flags", [])
                        valid_flags = [f for f in raw_flags if f in ALLOWED_SCREENING_FLAGS]
                        data["flags"] = valid_flags

                        validated = ScreeningOutput(**data)
                        return validated
                    else:
                        logger.warning(
                            f"Screening attempt {attempt + 1}: Malformed JSON in output: {raw_response[:100]}"
                        )
                else:
                    logger.info(f"Screening attempt {attempt + 1}: NVIDIA NIM returned {status_code}")
            except Exception as e:
                logger.warning(f"Screening attempt {attempt + 1} exception: {e}")

        logger.info(f"Screening fallback used for submission '{title}'. Setting flags=['unscreened'].")
        return self.fallback_screening("LLM screening unavailable or timed out")


portal_screening_service = PortalScreeningService()
