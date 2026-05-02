import torch
import os

checkpoint_dir = r"C:\Users\rsvij\AppData\Local\tts\tts_models--multilingual--multi-dataset--xtts_v2"
model_path = os.path.join(checkpoint_dir, "model.pth")

print(f"Loading state dict from {model_path}...")
try:
    state = torch.load(model_path, map_location="cpu")
    if "model" in state:
        state = state["model"]

    # Extract DVAE
    print("Extracting DVAE weights...")
    dvae_state = {k.replace("dvae.", ""): v for k, v in state.items() if k.startswith("dvae.")}
    if dvae_state:
        torch.save(dvae_state, os.path.join(checkpoint_dir, "dvae.pth"))
        print("DVAE saved to dvae.pth")
    else:
        print("DVAE not found in state dict!")

    # Extract Mel Stats
    print("Extracting Mel Stats...")
    # Check common keys for mel stats in XTTS
    mel_stats = None
    for key in ["mel_stats", "xtts.mel_stats", "gpt.mel_stats"]:
        if key in state:
            mel_stats = state[key]
            print(f"Found mel stats in key: {key}")
            break
    
    if mel_stats is not None:
        torch.save(mel_stats, os.path.join(checkpoint_dir, "mel_norms.pth"))
        print("Mel stats saved to mel_norms.pth")
    else:
        print("Mel stats not found. Creating dummy...")
        dummy_stats = torch.zeros((1, 80))
        torch.save(dummy_stats, os.path.join(checkpoint_dir, "mel_norms.pth"))
        print("Dummy mel stats saved to mel_norms.pth")

except Exception as e:
    print(f"Error during extraction: {e}")
