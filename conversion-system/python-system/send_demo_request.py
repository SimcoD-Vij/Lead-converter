import requests
import os

url = "http://localhost:8001/synthesize"
text = "Hello, naan Vijay pesaren, X Corp la irundhu sales team la irukken. Ungalukku namma laptop charger oda demo kaamikka dhaan call pannirukken."
payload = {"text": text, "language": "en"}
output_path = r"D:\Hivericks\conversion-system\python-system\output_demo.wav"

print(f"Sending synthesis request for: {text}")
try:
    response = requests.post(url, json=payload, timeout=120)
    if response.status_code == 200:
        with open(output_path, "wb") as f:
            f.write(response.content)
        print(f"Success! Audio saved to {output_path}")
    else:
        print(f"Error from server: {response.status_code}")
        print(response.text)
except Exception as e:
    print(f"Request failed: {e}")
