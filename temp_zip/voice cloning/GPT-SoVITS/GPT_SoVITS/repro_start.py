import sys
import os

print("REPRO START", flush=True)
sys.path.append(r"d:\Hivericks\conversion-system\voice cloning\GPT-SoVITS")
sys.path.append(r"d:\Hivericks\conversion-system\voice cloning\GPT-SoVITS\GPT_SoVITS")

print("Importing utils...", flush=True)
import utils
print(f"Utils file: {utils.__file__}", flush=True)

print("Calling get_hparams...", flush=True)
# Mock sys.argv for argparse
sys.argv = [
    "s2_train.py",
    "--config", r"d:\Hivericks\conversion-system\voice cloning\GPT-SoVITS\GPT_SoVITS\configs\s2_english.json"
]

try:
    hps = utils.get_hparams(stage=2)
    print("get_hparams SUCCESS", flush=True)
    print(f"exp_dir: {hps.data.exp_dir}", flush=True)
except Exception as e:
    print(f"get_hparams FAILED: {e}", flush=True)
    import traceback
    traceback.print_exc()

print("REPRO END", flush=True)
