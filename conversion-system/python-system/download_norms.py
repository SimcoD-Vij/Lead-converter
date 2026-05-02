import urllib.request
import os

dest_dir = r"C:\Users\rsvij\AppData\Local\tts\tts_models--multilingual--multi-dataset--xtts_v2"
url = "https://coqui.gateway.scarf.sh/hf-coqui/XTTS-v2/main/mel_norms.pth"
dest_path = os.path.join(dest_dir, "mel_norms.pth")

print(f"Downloading {url} to {dest_path}...")
try:
    urllib.request.urlretrieve(url, dest_path)
    print("Download successful!")
except Exception as e:
    print(f"Download failed: {e}")
