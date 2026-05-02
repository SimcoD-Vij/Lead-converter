import os
# Set environment variable to allow loading weights before importing torch/TTS
os.environ["TORCH_FORCE_WEIGHTS_ONLY_LOAD"] = "0"
import torch
from TTS.api import TTS
import numpy as np
from scipy.io.wavfile import write

device = "cuda" if torch.cuda.is_available() else "cpu"
print(f"Loading XTTS-v2 model onto {device.upper()}...")

# Path to the reference voice we just created
SPEAKER_WAV_PATH = r"D:\Hivericks\conversion-system\python-system\reference_voice.wav"
OUTPUT_PATH = r"D:\Hivericks\conversion-system\python-system\test_cloned_tamil.wav"

if not os.path.exists(SPEAKER_WAV_PATH):
    print(f"ERROR: reference_voice.wav not found at {SPEAKER_WAV_PATH}")
    exit(1)

# Load model
tts_model = TTS("tts_models/multilingual/multi-dataset/xtts_v2").to(device)

print("Synthesizing Tamil text...")
text = "வணக்கம், இது உங்கள் புதிய குரல். இது தமிழிலும் மிக நன்றாக வேலை செய்யும்."
# "Hello, this is your new voice. It works very well in Tamil too."

wav = tts_model.tts(
    text=text,
    speaker_wav=SPEAKER_WAV_PATH,
    language="ta"
)

# Save the output
audio_int16 = np.int16(np.array(wav) * 32767)
write(OUTPUT_PATH, 24000, audio_int16)

print(f"Success! Test audio saved to {OUTPUT_PATH}")
