import os
from TTS.tts.configs.xtts_config import XttsConfig
from TTS.tts.models.xtts import Xtts

checkpoint_dir = r"C:\Users\rsvij\AppData\Local\tts\tts_models--multilingual--multi-dataset--xtts_v2"
model_path = os.path.join(checkpoint_dir, "model.pth")
config_path = os.path.join(checkpoint_dir, "config.json")

print(f"Loading model architecture...")
config = XttsConfig()
config.load_json(config_path)
model = Xtts.init_from_config(config)

print("Model Attributes:")
for name, module in model.named_children():
    print(f"- {name}: {type(module)}")

if hasattr(model, "dvae"):
    print("\nModel has 'dvae' attribute.")
else:
    print("\nModel DOES NOT have 'dvae' attribute.")
