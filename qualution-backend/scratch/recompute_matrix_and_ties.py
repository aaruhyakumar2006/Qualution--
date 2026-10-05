import sys, os
sys.path.insert(0, os.getcwd())
import json
import numpy as np
from app.services.diagnosis_engine import diagnosis_engine, select_discriminating_probe, compute_tvd
from app.services.mutation_library import mutation_registry
from app.services.fact_extractor import extract_circuit_facts

entries = diagnosis_engine.catalog.entries
n = len(entries)
entry_ids = [e.id for e in entries]

print(f"=== RECOMPUTED SYNTHETIC STUDENT DIAGNOSIS MATRIX (N={n}) ===")
print("Evidence Score Definition:")
print("  Evidence Score = round(max(0.0, (1.0 - TVD) * conf_weight), 4)")
print("  Where TVD in [0.0, 1.0] is Total Variation Distance, and conf_weight = 1.5 when confidence >= 0.8.")
print("  A score of 1.50 represents an exact match (TVD = 0.0) with high confidence (1.0 * 1.5 = 1.50).")
print("\nIndex mapping:")
for i, eid in enumerate(entry_ids):
    print(f"  [{i:2d}] {eid} (mut: {entries[i].mutation_ref})")

matrix = np.zeros((n, n))

for i, target_entry in enumerate(entries):
    probe = target_entry.probe_circuits[0]
    mutated_circ = mutation_registry.mutate(target_entry.mutation_ref, probe)
    mutated_facts = extract_circuit_facts(mutated_circ)
    student_pred = mutated_facts["measurement_probabilities"]
    
    # Run diagnose across all entries without filtering by current_step_id
    res = diagnosis_engine.diagnose(circuit=probe, student_prediction=student_pred, confidence=0.9)
    
    candidate_dists = {r["misconception_id"]: r["distance_to_student"] for r in res.ranked_candidates}
    
    for j, candidate_entry in enumerate(entries):
        matrix[i, j] = candidate_dists.get(candidate_entry.id, 1.0)

print("\n--- Pairwise TVD Distance Matrix ---")
header_str = "        " + " ".join([f"[{j:2d}]" for j in range(n)])
print(header_str)
for i in range(n):
    row_str = f"[{i:2d}]   " + " ".join([f"{matrix[i,j]:.2f}" for j in range(n)])
    print(row_str)

print("\n--- Diagnostic Resolution & Disambiguation Analysis ---")
for i, target_entry in enumerate(entries):
    top_matches = [entries[j] for j in range(n) if matrix[i, j] <= 0.05]
    if len(top_matches) == 1:
        print(f"[{i:2d}] {target_entry.id}: UNIQUELY DIAGNOSABLE DIRECTLY (no tie)")
    else:
        tied_ids = [m.id for m in top_matches]
        disc_probe = select_discriminating_probe(top_matches)
        
        # Test if discriminating probe separates them
        probe_dist = []
        for m in top_matches:
            c = mutation_registry.mutate(m.mutation_ref, disc_probe)
            probs = extract_circuit_facts(c)["measurement_probabilities"]
            probe_dist.append((m.id, probs))
        
        min_sep = 1.0
        for p1 in range(len(probe_dist)):
            for p2 in range(p1 + 1, len(probe_dist)):
                sep = compute_tvd(probe_dist[p1][1], probe_dist[p2][1])
                min_sep = min(min_sep, sep)
        
        if min_sep >= 0.25:
            print(f"[{i:2d}] {target_entry.id}: TIED DIRECTLY with {tied_ids} -> RESOLVED AFTER 1 DISAMBIGUATION (TVD >= {min_sep:.2f})")
        else:
            print(f"[{i:2d}] {target_entry.id}: TIED with {tied_ids} -> PROBABLY INDISTINGUISHABLE (TVD = {min_sep:.2f})")
