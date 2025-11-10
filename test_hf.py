import requests

HF_TOKEN = "hf_yourtoken_here"  # <-- paste your real Hugging Face API key
MODEL = "Gitwar/Llama-3.2-3B-Crop-Recommender"

headers = {"Authorization": f"Bearer {HF_TOKEN}"}
data = {"inputs": "Recommend crops for loamy soil in winter in Telangana."}

url = f"https://api-inference.huggingface.co/models/{MODEL}"
response = requests.post(url, headers=headers, json=data)

print("Status:", response.status_code)
print("Response:", response.text)
