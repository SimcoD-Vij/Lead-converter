import torch
import os

checkpoint_dir = r"C:\Users\rsvij\AppData\Local\tts\tts_models--multilingual--multi-dataset--xtts_v2"
model_path = os.path.join(checkpoint_dir, "model.pth")

print(f"Loading state dict from {model_path}...")
try:
    state = torch.load(model_path, map_location="cpu")
    if "model" in state:
        state = state["model"]

    keys = list(state.keys())
    
    # Search for DVAE related keys with case-insensitive check
    print("\nDVAE related keys (all found):")
    dvae_keys = [k for k in keys if "dvae" in k.lower()]
    for k in dvae_keys:
        print(k)

except Exception as e:
    print(f"Error: {e}")
