import torch
import os

checkpoint_dir = r"C:\Users\rsvij\AppData\Local\tts\tts_models--multilingual--multi-dataset--xtts_v2"
model_path = os.path.join(checkpoint_dir, "model.pth")

print(f"Loading state dict from {model_path}...")
try:
    state = torch.load(model_path, map_location="cpu")
    if "model" in state:
        state = state["model"]

    with open("model_keys.txt", "w") as f:
        for k in state.keys():
            f.write(k + "\n")
    print(f"Saved {len(state.keys())} keys to model_keys.txt")

except Exception as e:
    print(f"Error: {e}")
