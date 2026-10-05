import os, time, requests
from dotenv import load_dotenv
load_dotenv('.env')

key = os.getenv('NVIDIA_API_KEY')
h = {'Authorization': f'Bearer {key}', 'Content-Type': 'application/json'}

print("Fetching models from https://integrate.api.nvidia.com/v1/models ...")
res = requests.get('https://integrate.api.nvidia.com/v1/models', headers=h, timeout=10)
if res.status_code != 200:
    print(f"Failed to fetch models: {res.status_code}")
    exit(1)

all_models = [m['id'] for m in res.json().get('data', [])]
print(f"Total models in account: {len(all_models)}")

# Filter candidate chat / instruct models
chat_candidates = [
    m for m in all_models
    if any(k in m.lower() for k in ['instruct', 'chat', 'flash', 'it'])
    and not any(k in m.lower() for k in ['embed', 'guard', 'safety', 'parse', 'reward'])
]

print(f"Identified {len(chat_candidates)} candidate instruct/chat models to probe.")

working_models = []
failed_models = []

for mid in chat_candidates:
    body = {
        'model': mid,
        'messages': [{'role': 'user', 'content': 'Hi'}],
        'max_tokens': 1
    }
    t0 = time.time()
    try:
        r = requests.post('https://integrate.api.nvidia.com/v1/chat/completions', headers=h, json=body, timeout=8)
        lat = round((time.time() - t0) * 1000, 1)
        if r.status_code == 200:
            print(f"  [200 OK] {mid} ({lat}ms)")
            working_models.append((mid, lat))
        else:
            print(f"  [{r.status_code}] {mid}")
            failed_models.append((mid, r.status_code))
    except Exception as e:
        print(f"  [TIMEOUT/ERR] {mid}: {e}")
        failed_models.append((mid, "timeout"))

print("\n=== SUMMARY OF WORKING CHAT MODELS ===")
for m, lat in working_models:
    print(f"  * {m} (latency: {lat}ms)")

print(f"\nTotal working: {len(working_models)}, Total failed/deprecate: {len(failed_models)}")
