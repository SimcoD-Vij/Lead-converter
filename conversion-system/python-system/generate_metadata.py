import os
import json
import csv

base_dir = r"D:\Hivericks\conversion-system\train"
output_csv = os.path.join(base_dir, "metadata.csv")

print(f"Generating metadata.csv with header in {base_dir}...")
count = 0
with open(output_csv, 'w', newline='', encoding='utf-8') as f:
    writer = csv.writer(f, delimiter='|')
    # Add header for coqui formatter
    writer.writerow(["audio_file", "text", "speaker_name"])
    
    for folder in os.listdir(base_dir):
        folder_path = os.path.join(base_dir, folder)
        if not os.path.isdir(folder_path):
            continue
        
        rel_audio_path = os.path.join(folder, "audio.wav")
        abs_audio_path = os.path.join(folder_path, "audio.wav")
        text_json = os.path.join(folder_path, "text.json")
        
        if os.path.exists(abs_audio_path) and os.path.exists(text_json):
            try:
                with open(text_json, 'r') as j:
                    data = json.load(j)
                    text = " ".join([w['word'] for w in data['words']])
                    if text.strip():
                        writer.writerow([rel_audio_path, text, "indian_male"])
                        count += 1
            except:
                pass

print(f"Done! Processed {count} clips with header.")
