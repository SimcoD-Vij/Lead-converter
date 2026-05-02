import urllib.request
import os

dest_dir = r"C:\Users\rsvij\AppData\Local\tts\tts_models--multilingual--multi-dataset--xtts_v2"
# Use Hugging Face resolve URLs for direct downloads
urls = {
    "dvae.pth": "https://huggingface.co/coqui/XTTS-v2/resolve/main/dvae.pth",
    "mel_norms.pth": "https://huggingface.co/coqui/XTTS-v2/resolve/main/mel_norms.pth"
}

for filename, url in urls.items():
    dest_path = os.path.join(dest_dir, filename)
    print(f"Downloading {url} to {dest_path}...")
    try:
        # Using a User-Agent to avoid potential blocks
        req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
        with urllib.request.urlopen(req) as response, open(dest_path, 'wb') as out_file:
            data = response.read()
            out_file.write(data)
        print(f"Downloaded {filename} successfully!")
    except Exception as e:
        print(f"Failed to download {filename}: {e}")
