import os
import sys
sys.path.insert(0, os.getcwd())

from app.services.llm_service import llm_service, LLMWordingRequest

req = LLMWordingRequest(
    step_goal="Understand superposition state",
    facts_used=[{"qubits": 1, "gate": "h", "measurement_probabilities": {"0": 0.5, "1": 0.5}}],
    hint_level=1,
    offered_experiments=[],
    template_text="What state is created when an H gate acts on |0>?",
    misconception_name="hadamard-inverts-classical",
    correct_outcome="0.5"
)

text, path = llm_service.word_socratic_turn(req, timeout_seconds=15.0)
print(f"Path used: {path}")
print(f"Turn text: {text}")
