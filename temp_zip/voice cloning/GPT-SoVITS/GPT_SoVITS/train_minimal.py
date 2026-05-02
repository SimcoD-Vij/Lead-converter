import sys
import os

print("--- MINIMAL TRAIN START ---", flush=True)

# 1. Paths
sys.path.append(r"d:\Hivericks\conversion-system\voice cloning\GPT-SoVITS")
sys.path.append(r"d:\Hivericks\conversion-system\voice cloning\GPT-SoVITS\GPT_SoVITS")

# 2. Basic Imports
print("Importing utils...", flush=True)
import utils
print("Importing torch...", flush=True)
import torch

# 3. Model & Data Utils
print("Importing module.models...", flush=True)
from module.models import SynthesizerTrn
print("Importing module.data_utils...", flush=True)
from module.data_utils import TextAudioSpeakerLoader


# 4. Hparams
print("Loading hparams...", flush=True)
config_path = r"d:\Hivericks\conversion-system\voice cloning\GPT-SoVITS\GPT_SoVITS\configs\s2_english.json"
sys.argv = ["train_minimal.py", "--config", config_path]
hps = utils.get_hparams(stage=2)
print("Hparams loaded.", flush=True)

# 5. Device
device = torch.device("cpu")
print(f"Using device: {device}", flush=True)

# 6. Dataset Initializer
print("Initializing dataset...", flush=True)
train_dataset = TextAudioSpeakerLoader(hps.data, version=hps.model.version)
print(f"Dataset initialized: {len(train_dataset)} samples", flush=True)

# 7. Model Initializer
print("Initializing model...", flush=True)
net_g = SynthesizerTrn(
    hps.data.filter_length // 2 + 1,
    hps.train.segment_size // hps.data.hop_length,
    n_speakers=hps.data.n_speakers,
    **hps.model,
).to(device)
print("Model initialized.", flush=True)

print("--- MINIMAL TRAIN SUCCESS ---", flush=True)
