import TTS.tts.datasets as datasets
import inspect

print("Formatters in TTS.tts.datasets:")
for name, obj in inspect.getmembers(datasets):
    if not name.startswith("_"):
        print(name)

# Specifically look for what load_tts_samples uses
from TTS.tts.datasets import load_tts_samples
print("\nChecking load_tts_samples code for formatters...")
# We can't easily read code here, but we can try common names
try:
    from TTS.tts.datasets.formatters import *
    print("Imported formatters from TTS.tts.datasets.formatters")
except:
    pass
