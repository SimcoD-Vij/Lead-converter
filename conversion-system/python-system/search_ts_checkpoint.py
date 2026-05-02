import os
import sys

search_path = r"D:\Hivericks\conversion-system\python-system\.venv\Lib\site-packages\TTS"
search_str = "ts_checkpoint"

print(f"Searching for '{search_str}' in {search_path}...")

for root, dirs, files in os.walk(search_path):
    for file in files:
        if file.endswith(".py"):
            full_path = os.path.join(root, file)
            try:
                with open(full_path, 'r', encoding='utf-8') as f:
                    if search_str in f.read():
                        print(f"FOUND in {full_path}")
            except:
                pass
