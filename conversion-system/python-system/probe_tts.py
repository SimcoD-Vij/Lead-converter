import TTS
import os

print(f"TTS Path: {os.path.dirname(TTS.__file__)}")

def explore_module(module_name):
    try:
        mod = __import__(module_name, fromlist=['*'])
        print(f"Module {module_name} found.")
        print(f"Dir: {dir(mod)}")
    except ImportError:
        print(f"Module {module_name} NOT found.")

# Try common locations for Trainer
explore_module("trainer")
explore_module("TTS.trainer")
explore_module("TTS.utils.trainer")

# Check for XTTS trainer specifically
try:
    from TTS.tts.models.xtts import Xtts
    print("Xtts model class found in TTS.tts.models.xtts")
except ImportError:
    print("Xtts model class NOT found correctly.")
