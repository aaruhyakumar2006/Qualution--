import os
import httpx
import json

key = os.getenv("NVIDIA_API_KEY", "")
print(f"Key present: {bool(key)}")

url = "https://integrate.api.nvidia.com/v1/chat/completions"
headers = {
    "Authorization": f"Bearer {key}",
    "Content-Type": "application/json"
}

payload = {
    "model": "meta/llama-3.2-11b-vision-instruct",
    "messages": [
        {
            "role": "system",
            "content": "You are Mario, a friendly Socratic quantum physics tutor. Output valid JSON only: {\"text\": \"...\", \"claims\": [], \"experiment_id\": null}"
        },
        {
            "role": "user",
            "content": "Reword this hint into a short question (max 40 words, at most 1 question mark): What state is created when an H gate acts on |0>?"
        }
    ],
    "temperature": 0.2,
    "max_tokens": 150
}

try:
    with httpx.Client(timeout=15.0) as client:
        r = client.post(url, headers=headers, json=payload)
        print("Status code:", r.status_code)
        if r.status_code == 200:
            content = r.json()["choices"][0]["message"]["content"]
            print("Content:", content)
        else:
            print("Response:", r.text)
except Exception as e:
    print("Error:", e)
