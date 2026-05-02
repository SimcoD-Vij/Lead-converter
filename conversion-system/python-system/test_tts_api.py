import requests
import json
import os

url = "http://127.0.0.1:8001/synthesize"

# This is the phonetic Tanglish translation to bypass the character parsing block in XTTS-v2.
# Since the reference voice is a native Tamil speaker, the "en" phonetic model will seamlessly adapt its accent!
payload = {
    "text": "Naan Hivericks il-irundhu Vijay pesu-hiren. Laptop charge seivadharkana thayarippai virka ingu vandhullen. Eppadi irukkireenga?",
    "language": "en"
}

headers = {
    "Content-Type": "application/json"
}

print("Sending request to local XTTS-v2 Voice Clone Server...")
response = requests.post(url, json=payload, headers=headers)

if response.status_code == 200:
    output_path = "test_tamil_voice.wav"
    with open(output_path, "wb") as f:
        f.write(response.content)
    print(f"Success! Audio saved to {os.path.abspath(output_path)}")
else:
    print(f"Error: Server returned status code {response.status_code}")
    print(response.text)
