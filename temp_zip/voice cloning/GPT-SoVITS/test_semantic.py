import os
import sys
import torch
import traceback

# Setup PYTHONPATH manually in script for testing
sys.path.append(r"d:\Hivericks\conversion-system\voice cloning\GPT-SoVITS")
sys.path.append(r"d:\Hivericks\conversion-system\voice cloning\GPT-SoVITS\GPT_SoVITS")

import utils
from module.models import SynthesizerTrn
from tools.my_utils import clean_path

inp_text = r"d:\Hivericks\conversion-system\voice cloning\english accent\dataset\asr_opt\sliced.list"
exp_name = "english_voice"
i_part = "0"
all_parts = "1"
opt_dir = r"d:\Hivericks\conversion-system\voice cloning\GPT-SoVITS\logs\english_voice"
pretrained_s2G = r"d:\Hivericks\conversion-system\voice cloning\GPT-SoVITS\GPT_SoVITS\Pretrained_models\gsv-v2final-pretrained\s2G2333k.pth"
s2config_path = r"d:\Hivericks\conversion-system\voice cloning\GPT-SoVITS\GPT_SoVITS\configs\s2.json"
is_half = False

print(f"DEBUG: inp_text={inp_text}")
print(f"DEBUG: opt_dir={opt_dir}")
print(f"DEBUG: pretrained_s2G={pretrained_s2G}")

hubert_dir = "%s/4-cnhubert" % (opt_dir)
semantic_path = "%s/6-name2semantic-%s.tsv" % (opt_dir, i_part)

print(f"DEBUG: hubert_dir={hubert_dir}")
print(f"DEBUG: semantic_path={semantic_path}")

if not os.path.exists(pretrained_s2G):
    print("ERROR: pretrained_s2G missing")
    sys.exit(1)

size = os.path.getsize(pretrained_s2G)
if size < 82978 * 1024:
    version = "v1"
elif size < 100 * 1024 * 1024:
    version = "v2"
elif size < 103520 * 1024:
    version = "v1"
elif size < 700 * 1024 * 1024:
    version = "v2"
else:
    version = "v3"
print(f"DEBUG: version detected as {version}")

hps = utils.get_hparams_from_file(s2config_path)
vq_model = SynthesizerTrn(
    hps.data.filter_length // 2 + 1,
    hps.train.segment_size // hps.data.hop_length,
    n_speakers=hps.data.n_speakers,
    version=version,
    **hps.model,
)
vq_model = vq_model.to("cpu")
vq_model.eval()

print("DEBUG: Loading state dict...")
try:
    checkpoint = torch.load(pretrained_s2G, map_location="cpu", weights_only=False)
    vq_model.load_state_dict(checkpoint["weight"], strict=False)
    print("DEBUG: State dict loaded successfully")
except Exception as e:
    print(f"ERROR loading state dict: {e}")
    traceback.print_exc()
    sys.exit(1)

def name2go(wav_name, lines):
    hubert_path = "%s/%s.pt" % (hubert_dir, wav_name)
    if not os.path.exists(hubert_path):
        # print(f"DEBUG: hubert_path missing: {hubert_path}")
        return
    ssl_content = torch.load(hubert_path, map_location="cpu")
    codes = vq_model.extract_latent(ssl_content)
    semantic = " ".join([str(i) for i in codes[0, 0, :].tolist()])
    lines.append("%s\t%s" % (wav_name, semantic))

print("DEBUG: Reading inp_text...")
with open(inp_text, "r", encoding="utf8") as f:
    lines = f.read().strip("\n").split("\n")

print(f"DEBUG: Total lines in sliced.list: {len(lines)}")

lines1 = []
count = 0
for line in lines[int(i_part) :: int(all_parts)]:
    try:
        wav_name, spk_name, language, text = line.split("|")
        wav_name = clean_path(wav_name)
        wav_name = os.path.basename(wav_name)
        name2go(wav_name, lines1)
        count += 1
        if count % 100 == 0:
            print(f"DEBUG: Processed {count}/{len(lines)}")
    except Exception as e:
        print(f"ERROR processing line {line}: {e}")

print(f"DEBUG: Successfully extracted {len(lines1)} semantic tokens")
with open(semantic_path, "w", encoding="utf8") as f:
    f.write("\n".join(lines1))
print(f"DEBUG: Saved to {semantic_path}")
