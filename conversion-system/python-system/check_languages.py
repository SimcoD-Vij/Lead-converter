import os
import functools
import torch
# Set environment variable and monkeypatch BEFORE anything else
os.environ["TORCH_FORCE_WEIGHTS_ONLY_LOAD"] = "0"
torch.load = functools.partial(torch.load, weights_only=False)

from TTS.api import TTS

print("Loading XTTS-v2 for language check...")
try:
    tts = TTS("tts_models/multilingual/multi-dataset/xtts_v2")
    print("Supported languages:")
    print(tts.languages)
except Exception as e:
    print(f"Failed to check languages: {e}")
