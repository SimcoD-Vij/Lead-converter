import torch
import torchaudio
import whisper
import os

# Load Whisper model
print("Loading Whisper model...")
model = whisper.load_model("base")

def transcribe_file(filepath):
    if not os.path.exists(filepath):
        print(f"File not found: {filepath}")
        return None
    print(f"Transcribing {filepath}...")
    result = model.transcribe(filepath)
    return result["text"]

# 1. Transcribe a clip from the 'train' dataset
clip_path = r"D:\Hivericks\conversion-system\train\100038\audio.wav"
clip_text = transcribe_file(clip_path)
print(f"Clip 100038 Transcription: {clip_text}")

# 2. Transcribe the beginning of 'train data.m4a'
# Use torchaudio to load first 30 seconds
m4a_path = r"D:\Hivericks\conversion-system\input\train data.m4a"
if os.path.exists(m4a_path):
    print(f"Loading first 30s of {m4a_path}...")
    # Whisper can handle M4A directly if ffmpeg is in path
    # But let's be safe and just transcribe
    # result = model.transcribe(m4a_path) # This might take too long if it's 1 hour
    # Instead, let's use ffmpeg to get a small chunk
    os.system(f'ffmpeg -i "{m4a_path}" -t 30 -y /tmp/chunk.wav')
    chunk_text = transcribe_file("/tmp/chunk.wav")
    print(f"M4A First 30s Transcription: {chunk_text}")
else:
    print(f"M4A file not found at {m4a_path}")
