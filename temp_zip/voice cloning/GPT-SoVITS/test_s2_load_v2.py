import os
import sys

print("Python script started...")
sys.stdout.flush()

try:
    print("Setting up paths...")
    sys.path.append(r"d:\Hivericks\conversion-system\voice cloning\GPT-SoVITS")
    sys.path.append(r"d:\Hivericks\conversion-system\voice cloning\GPT-SoVITS\GPT_SoVITS")
    sys.stdout.flush()

    print("Importing torch...")
    import torch
    print(f"Torch version: {torch.__version__}")
    sys.stdout.flush()

    print("Importing utils...")
    import utils
    print("Utils imported.")
    sys.stdout.flush()

    print("Importing models...")
    from module.models import SynthesizerTrn
    print("Models imported.")
    sys.stdout.flush()

    print("Importing data_utils...")
    from module.data_utils import TextAudioSpeakerLoader
    print("Data utils imported.")
    sys.stdout.flush()

    print("Test complete (imports only).")
except Exception as e:
    print(f"Error during imports: {e}")
    import traceback
    traceback.print_exc()
