import os
import functools
import torch
# Set environment variable and monkeypatch BEFORE anything else
os.environ["TORCH_FORCE_WEIGHTS_ONLY_LOAD"] = "0"
torch.load = functools.partial(torch.load, weights_only=False)

from TTS.api import TTS
import numpy as np
import torchaudio
import soundfile as sf
from scipy.io.wavfile import write

# Monkeypatch torchaudio.load to bypass the broken torchcodec requirement
def mock_load(filepath, **kwargs):
    print(f"DEBUG: Monkeypatched torchaudio.load called for {filepath}")
    data, samplerate = sf.read(filepath)
    # Ensure it's (channels, samples) and float32
    if len(data.shape) == 1:
        data = data[np.newaxis, :]
    else:
        data = data.T
    return torch.from_numpy(data).float(), samplerate

torchaudio.load = mock_load

device = "cuda" if torch.cuda.is_available() else "cpu"
print(f"Loading XTTS-v2 model onto {device.upper()}...")

SPEAKER_WAV_PATH = r"D:\Hivericks\conversion-system\python-system\reference_voice_simple.wav"
OUTPUT_PATH = r"D:\Hivericks\conversion-system\python-system\output_demo.wav"
text = "Hello, naan Vijay pesaren, X Corp la irundhu sales team la irukken. Ungalukku namma laptop charger oda demo kaamikka dhaan call pannirukken."

try:
    tts_model = TTS("tts_models/multilingual/multi-dataset/xtts_v2").to(device)
    print(f"Synthesizing: {text}")
    wav = tts_model.tts(
        text=text,
        speaker_wav=SPEAKER_WAV_PATH,
        language="en"
    )
    
    audio_int16 = np.int16(np.array(wav) * 32767)
    write(OUTPUT_PATH, 24000, audio_int16)
    print(f"Success! Demo audio saved to {OUTPUT_PATH}")
except Exception as e:
    print(f"Synthesis failed: {e}")
    import traceback
    traceback.print_exc()
