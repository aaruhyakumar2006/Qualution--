import os
import sys
import json
import time

sys.path.insert(0, os.getcwd())

from app.services.llm_service import llm_service, LLMWordingRequest
from app.services.diagnosis_engine import diagnosis_engine
from app.services.fact_extractor import extract_circuit_facts

# 5 Misconceptions across different hint levels (10 turns total)
test_cases = [
    # 1. hadamard-inverts-classical (hint level 1)
    ("hadamard-inverts-classical", 1, "What operation does H perform on |0>?"),
    # 2. hadamard-inverts-classical (hint level 2)
    ("hadamard-inverts-classical", 2, "How do the Bloch vectors differ between X|0> and H|0>?"),
    # 3. superposition-not-mixture (hint level 1)
    ("superposition-not-mixture", 1, "What happens when two H gates are applied in series?"),
    # 4. superposition-not-mixture (hint level 3)
    ("superposition-not-mixture", 3, "Do quantum probability amplitudes interfere constructively or destructively?"),
    # 5. measurement-deterministic (hint level 1)
    ("measurement-deterministic", 1, "What state is created before measurement?"),
    # 6. measurement-deterministic (hint level 2)
    ("measurement-deterministic", 2, "Does the Born rule give probabilistic or deterministic outcomes for |+>?"),
    # 7. grover-oracle-bit-flip (hint level 1)
    ("grover-oracle-bit-flip", 1, "How does phase kickback differ from a bit flip?"),
    # 8. grover-oracle-bit-flip (hint level 2)
    ("grover-oracle-bit-flip", 2, "What state must the ancilla qubit be in to reflect relative phase?"),
    # 9. grover-over-iteration (hint level 1)
    ("grover-over-iteration", 1, "How does the state amplitude rotate in the 2D Grover subspace?"),
    # 10. grover-over-iteration (hint level 3)
    ("grover-over-iteration", 3, "What happens to target probability when the optimal rotation angle is exceeded?"),
]

print(f"=== RUNNING LIVE 10-TURN SMOKE TEST WITH NVIDIA NIM ({len(test_cases)} TURNS) ===")
results = []

for idx, (m_id, hint_lvl, template) in enumerate(test_cases, 1):
    entry = next(e for e in diagnosis_engine.catalog.entries if e.id == m_id)
    probe = entry.probe_circuits[0]
    facts = extract_circuit_facts(probe)
    
    req = LLMWordingRequest(
        step_goal=f"Address misconception {m_id}",
        facts_used=[{"facts": facts["measurement_probabilities"]}],
        hint_level=hint_lvl,
        offered_experiments=[],
        template_text=template,
        misconception_name=m_id,
        correct_outcome=str(facts["measurement_probabilities"])
    )
    
    t0 = time.time()
    turn_text, path = llm_service.word_socratic_turn(req, timeout_seconds=15.0)
    dur = round(time.time() - t0, 3)
    
    print(f"Turn {idx:2d} | [{m_id}] (lvl {hint_lvl}) -> Path: {path} ({dur}s)")
    print(f"         Prompt : {template}")
    print(f"         Output : {turn_text}\n")
    
    results.append({
        "turn": idx,
        "misconception_id": m_id,
        "hint_level": hint_lvl,
        "path_used": path,
        "duration_seconds": dur,
        "text": turn_text
    })

passed_count = sum(1 for r in results if r["path_used"] == "llm_verified")
print(f"SUMMARY: {passed_count}/{len(results)} turns live verified with NVIDIA NIM.")

with open("scratch/live_smoke_results.json", "w") as f:
    json.dump(results, f, indent=2)
