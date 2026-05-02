import os
import sys
import torch
import json

# Add project root to sys.path
sys.path.append(r"d:\Hivericks\conversion-system\voice cloning\GPT-SoVITS")
sys.path.append(r"d:\Hivericks\conversion-system\voice cloning\GPT-SoVITS\GPT_SoVITS")

import utils
from module.data_utils import TextAudioSpeakerLoader, TextAudioSpeakerCollate
from module.models import SynthesizerTrn

def test():
    config_path = r"d:\Hivericks\conversion-system\voice cloning\GPT-SoVITS\GPT_SoVITS\configs\s2_english.json"
    with open(config_path, "r") as f:
        config = json.load(f)
    
    from utils import HParams
    hps = HParams(**config)
    
    print("Loading dataset...")
    try:
        train_dataset = TextAudioSpeakerLoader(hps.data, version=hps.model.version)
        print(f"Dataset loaded: {len(train_dataset)} samples")
    except Exception as e:
        print(f"Error loading dataset: {e}")
        import traceback
        traceback.print_exc()
        return

    print("Initializing model...")
    device = "cpu"
    try:
        net_g = SynthesizerTrn(
            hps.data.filter_length // 2 + 1,
            hps.train.segment_size // hps.data.hop_length,
            n_speakers=hps.data.n_speakers,
            **hps.model,
        ).to(device)
        print("Model initialized successfully.")
    except Exception as e:
        print(f"Error initializing model: {e}")
        import traceback
        traceback.print_exc()
        return

    print("Checking pretrained weights...")
    if os.path.exists(hps.train.pretrained_s2G):
        print(f"Pretrained G exists: {hps.train.pretrained_s2G}")
        try:
            ckpt = torch.load(hps.train.pretrained_s2G, map_location="cpu")
            net_g.load_state_dict(ckpt["weight"], strict=False)
            print("Pretrained G loaded.")
        except Exception as e:
            print(f"Error loading pretrained G: {e}")
    else:
        print(f"Pretrained G NOT found at {hps.train.pretrained_s2G}")

if __name__ == "__main__":
    test()
