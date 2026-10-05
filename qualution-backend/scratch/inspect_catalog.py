import json
with open('app/data/misconception_catalog.json', 'r') as f:
    cat = json.load(f)
for i, e in enumerate(cat['entries']):
    gates = [g['gate'] for g in e['probe_circuits'][0]['gates']]
    print(f"[{i:2d}] id: {e['id']}")
    print(f"     mutation_ref: {e['mutation_ref']}")
    print(f"     concept_ids: {e['concept_ids']}")
    print(f"     probe_gates: {gates}")
