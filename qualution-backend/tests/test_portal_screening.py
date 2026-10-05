import pytest
from unittest.mock import patch
from app.services.portal_screening_service import portal_screening_service
from app.schemas.portal_screening import ScreeningOutput

def test_screening_success_valid_json():
    mock_llm_json = '{"relevance_score": 0.95, "spam_likelihood": 0.05, "flags": ["spam"], "reason": "Valid educational resource on VQE algorithm."}'
    with patch("app.services.providers.nvidia_provider.nvidia_provider._call_chat_completions", return_value=(mock_llm_json, {}, "success")):
        res = portal_screening_service.screen_submission(
            title="Introduction to VQE with Qiskit",
            submission_type="resource",
            note="Great tutorial for beginners",
            url="https://example.com/vqe-tutorial"
        )
        assert isinstance(res, ScreeningOutput)
        assert res.relevance_score == 0.95
        assert res.spam_likelihood == 0.05
        assert "spam" in res.flags

def test_screening_markdown_fence_extraction():
    mock_llm_output = "```json\n{\n  \"relevance_score\": 0.05,\n  \"spam_likelihood\": 0.95,\n  \"flags\": [\"spam\", \"off_topic\"],\n  \"reason\": \"Commercial spam link.\"\n}\n```"
    with patch("app.services.providers.nvidia_provider.nvidia_provider._call_chat_completions", return_value=(mock_llm_output, {}, "success")):
        res = portal_screening_service.screen_submission(
            title="Buy cheap casino chips",
            submission_type="news",
            note="Visit our casino website now",
            url="https://spam.com"
        )
        assert res.spam_likelihood == 0.95
        assert "spam" in res.flags
        assert "off_topic" in res.flags

def test_screening_fallback_on_llm_timeout_or_error():
    with patch("app.services.providers.nvidia_provider.nvidia_provider._call_chat_completions", side_effect=TimeoutError("NVIDIA NIM timed out")):
        res = portal_screening_service.screen_submission(
            title="Quantum Key Distribution in Satellite Links",
            submission_type="paper",
            note="New QKD preprint on arXiv",
            url="https://arxiv.org/abs/2601.12345"
        )
        assert isinstance(res, ScreeningOutput)
        assert res.flags == ["unscreened"]
        assert "Pending human review" in res.reason
        assert res.spam_likelihood == 0.0  # Never reject purely on AI failure

def test_screening_invalid_flags_filtered():
    mock_llm_json = '{"relevance_score": 0.9, "spam_likelihood": 0.1, "flags": ["off_topic", "invalid_random_flag_xyz"], "reason": "Good article."}'
    with patch("app.services.providers.nvidia_provider.nvidia_provider._call_chat_completions", return_value=(mock_llm_json, {}, "success")):
        res = portal_screening_service.screen_submission(
            title="Quantum Annealing Overview",
            submission_type="news",
            note="D-Wave announcement",
            url="https://example.com/dwave"
        )
        assert "off_topic" in res.flags
        assert "invalid_random_flag_xyz" not in res.flags
