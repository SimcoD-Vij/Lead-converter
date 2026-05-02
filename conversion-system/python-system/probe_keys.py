import torch
import os

checkpoint_dir = r"C:\Users\rsvij\AppData\Local\tts\tts_models--multilingual--multi-dataset--xtts_v2"
model_path = os.path.join(checkpoint_dir, "model.pth")

print(f"Loading state dict from {model_path}...")
try:
    state = torch.load(model_path, map_location="cpu")
    if "model" in state:
        state = state["model"]

    print("State dict keys (first 20):")
    keys = list(state.keys())
    for k in keys[:20]:
        print(k)
    
    # Search for DVAE related keys
    print("\nDVAE related keys:")
    dvae_keys = [k for k in keys if "dvae" in k.lower()]
    for k in dvae_keys[:10]:
        print(k)

except Exception as e:
    print(f"Error: {e}")
