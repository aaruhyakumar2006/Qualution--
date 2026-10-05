import json
import pytest
from pathlib import Path
from typing import List, Dict, Any

CATALOG_PATH = Path(__file__).parent.parent / "app" / "data" / "misconception_catalog.json"

LEAK_KEYWORDS = [
    " 50%", " 100%", "50/50", "yields |0>", "gives |0>", "yields |1>", "gives |1>",
    "is equal to", "no-cloning theorem", "deterministically", "bell state", "entropy = 1"
]

def validate_entry_hints(entry: Dict[str, Any]) -> List[str]:
    """
    Validates that hint levels 1-3 (indices 0, 1, 2) do not leak the final answer,
    quantitative outcomes, or name the misconception.
    Levels 1-3 MUST be probing/guiding questions ending with '?'.
    Only level 4 (index 3) is allowed to state the final answer.
    """
    errors = []
    hints = entry.get("hint_ladder", [])
    entry_id = entry.get("id", "unknown")

    if len(hints) != 4:
        errors.append(f"Entry '{entry_id}' must have exactly 4 hint levels, got {len(hints)}")
        return errors

    for lvl_idx in range(3):
        hint_text = hints[lvl_idx]

        # 1. Must end with a question mark
        if not hint_text.strip().endswith("?"):
            errors.append(
                f"Entry '{entry_id}' level {lvl_idx + 1} hint is not a probing question (must end with '?'): '{hint_text}'"
            )

        # 2. Check forbidden leaking keywords
        lower_text = hint_text.lower()
        for kw in LEAK_KEYWORDS:
            if kw in lower_text:
                errors.append(
                    f"Entry '{entry_id}' level {lvl_idx + 1} leaks answer keyword '{kw}': '{hint_text}'"
                )

    return errors

def test_catalog_hint_leakage_all_entries():
    with open(CATALOG_PATH, "r", encoding="utf-8") as f:
        data = json.load(f)

    all_errors = []
    for entry in data.get("entries", []):
        errs = validate_entry_hints(entry)
        all_errors.extend(errs)

    assert len(all_errors) == 0, f"Hint leakage detected in catalog entries:\n" + "\n".join(all_errors)

def test_hint_leakage_validator_catches_deliberate_leak():
    deliberate_leaking_entry = {
        "id": "deliberate-leak-test",
        "name": "Leaking Test Entry",
        "hint_ladder": [
            "What happens when you apply H?",
            "The outcome is 50/50 mixture yielding |0> 50% of the time.",  # Leaking!
            "How does Born rule work?",
            "Final level explanation."
        ]
    }
    errors = validate_entry_hints(deliberate_leaking_entry)
    assert len(errors) > 0, "Validator failed to catch deliberate hint leak"
    assert any("not a probing question" in e or "leaks answer keyword" in e for e in errors)
