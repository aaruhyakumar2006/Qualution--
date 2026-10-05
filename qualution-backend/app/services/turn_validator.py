import re
from typing import List, Dict, Any, Optional, Union
from pydantic import BaseModel

class ValidationResult(BaseModel):
    is_valid: bool
    issues: List[str]

BANNED_SOLUTION_KEYWORDS = [
    "answer", "solution", "fix", "you should place", "replace it with", "correct answer"
]

BANNED_COMMERCIAL_CATCHPHRASES = [
    "it's-a me", "its-a me", "mamma mia", "mama mia", "wahoo", "let's-a go",
    "lets-a go", "super mario", "bowser", "princess peach"
]

def validate_turn_text(
    text: str,
    hint_level: int,
    misconception_name: Optional[str] = None,
    correct_outcome: Optional[Union[str, Dict[str, Any]]] = None,
    facts_used: List[Any] = None,
    experiment_id: Optional[str] = None,
    offered_experiments: List[str] = None,
    word_limit: int = 40
) -> ValidationResult:
    """
    Hardened Turn Text Validator for Stage M4 (Templates) and Stage M5 (LLM).
    Enforces strict pedagogical, security, and originality constraints:
    - At most one question mark.
    - No compound questions (multiple interrogative clauses connected by conjunctions/punctuation).
    - Word limit <= 40 words.
    - No outcome / target probability / misconception name leakage below Level 4.
    - Banned solution keywords check below Level 4.
    - Every number in text appears in facts_used.
    - experiment_id is in offered set.
    - No URLs, markdown code blocks, or HTML tags.
    - No prohibited commercial mascot catchphrases.
    """
    issues: List[str] = []
    facts_used = facts_used or []
    offered_experiments = offered_experiments or []

    # 1. At most one question mark
    qmark_count = text.count("?")
    if qmark_count > 1:
        issues.append(f"Turn text contains {qmark_count} question marks (max 1 allowed).")

    # 2. Compound question check (multiple interrogative clauses)
    compound_pattern = re.compile(
        r'\b(what|why|how|which|where|when|who)\b.+?(?:,|;|\band\b|\bor\b|\bwhile\b|\bbut\b)\s+(?:what|why|how|which|where|when|who)\b',
        re.IGNORECASE
    )
    if compound_pattern.search(text):
        issues.append("Compound question detected: multiple interrogative clauses in a single turn.")

    # 3. Word limit <= 40 words
    words = text.strip().split()
    if len(words) > word_limit:
        issues.append(f"Turn text exceeds word limit ({len(words)} > {word_limit}).")

    # 4. Leakage checks below Level 4
    if hint_level < 4:
        # Banned keywords
        for kw in BANNED_SOLUTION_KEYWORDS:
            if re.search(r'\b' + re.escape(kw) + r'\b', text, re.IGNORECASE):
                issues.append(f"Leaked solution keyword '{kw}' below Level 4.")

        # Misconception name leakage
        if misconception_name and misconception_name.lower() in text.lower():
            issues.append(f"Leaked misconception name '{misconception_name}' below Level 4.")

        # Outcome leakage: verify target outcome is not directly revealed if student did not observe it
        if correct_outcome:
            if isinstance(correct_outcome, str):
                if len(correct_outcome) > 1 and correct_outcome.lower() in text.lower():
                    issues.append(f"Leaked correct outcome '{correct_outcome}' below Level 4.")
            elif isinstance(correct_outcome, dict):
                for outcome_key, prob in correct_outcome.items():
                    if float(prob) >= 0.99:
                        if outcome_key in text and ("100%" in text or "1.0" in text or "probability 1" in text):
                            issues.append(f"Leaked correct target state '{outcome_key}' with 100% probability below Level 4.")

    # 5. Commercial character catchphrases check
    for phrase in BANNED_COMMERCIAL_CATCHPHRASES:
        if phrase in text.lower():
            issues.append(f"Turn text contains prohibited commercial mascot catchphrase: '{phrase}'.")

    # 6. Number grounding check: Every number in text must appear in facts_used
    numbers_in_text = re.findall(r'\b\d+(?:\.\d+)?\b', text)
    allowed_numbers = set()
    for f in facts_used:
        if isinstance(f, (int, float)):
            allowed_numbers.add(str(f))
            if 0.0 <= float(f) <= 1.0:
                allowed_numbers.add(str(int(round(float(f) * 100))))
        elif isinstance(f, dict):
            for k, v in f.items():
                allowed_numbers.add(str(k))
                if isinstance(v, (int, float)):
                    allowed_numbers.add(str(v))
                    if 0.0 <= float(v) <= 1.0:
                        allowed_numbers.add(str(int(round(float(v) * 100))))
                elif isinstance(v, str):
                    allowed_numbers.update(re.findall(r'\b\d+(?:\.\d+)?\b', v))
        elif isinstance(f, str):
            allowed_numbers.update(re.findall(r'\b\d+(?:\.\d+)?\b', f))

    for num in numbers_in_text:
        # Ignore common hint level or qubit index numbers if small integers
        if num in ["1", "2", "3", "4", "0"]:
            continue
        if num not in allowed_numbers:
            issues.append(f"Number '{num}' in turn text was not found in facts_used.")

    # 7. Offered experiment ID validation
    if experiment_id and offered_experiments and experiment_id not in offered_experiments:
        issues.append(f"Experiment ID '{experiment_id}' is not in offered experiments set.")

    # 8. Security formatting checks (No URLs, HTML, Code blocks)
    if "http://" in text or "https://" in text or "www." in text:
        issues.append("Turn text contains unallowed URL.")
    if "<" in text and ">" in text:
        issues.append("Turn text contains HTML tags.")
    if "```" in text:
        issues.append("Turn text contains Markdown code fences.")

    return ValidationResult(
        is_valid=len(issues) == 0,
        issues=issues
    )
