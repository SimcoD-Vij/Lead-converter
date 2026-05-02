import sys, os

# Set stdout to utf-8 to avoid console encoding errors
sys.stdout.reconfigure(encoding='utf-8')

# Paths
BASE = r"d:\Hivericks\Hivericks\conversion-system\voice cloning\GPT-SoVITS"
GPT_BASE = os.path.join(BASE, "GPT_SoVITS")

sys.path.insert(0, BASE)
sys.path.insert(0, GPT_BASE)

os.environ["CUDA_VISIBLE_DEVICES"] = "0"

GPT_MODEL  = os.path.join(BASE, r"GPT_SoVITS\pretrained_models\gsv-v2final-pretrained\s1bert25hz-5kh-longer-epoch=12-step=369668.ckpt")
SOVITS_MODEL = os.path.join(BASE, r"logs\english_voice\logs_s2_v2\G_233333333333.pth")
REF_AUDIO  = os.path.join(r"d:\Hivericks\Hivericks\conversion-system\voice cloning\english accent\dataset\sliced\english dataset.wav_0000000000_0000157120.wav")
REF_TEXT   = "I mean, another video and we are starting with a new topic."
TARGET_TEXT = "Hello! My name is Vijay and I am your personal AI assistant. How can I help you today?"
OUTPUT_WAV  = r"d:\Hivericks\Hivericks\cloned_voice_output.wav"

print(f"GPT model   : {GPT_MODEL}")
print(f"SoVITS model: {SOVITS_MODEL}")
print(f"Ref audio   : {REF_AUDIO}")
print(f"Ref exists  : {os.path.exists(REF_AUDIO)}")
print(f"GPT exists  : {os.path.exists(GPT_MODEL)}")
print(f"S2 exists   : {os.path.exists(SOVITS_MODEL)}")
print()

from GPT_SoVITS.inference_webui import change_gpt_weights, change_sovits_weights, get_tts_wav, dict_language
import soundfile as sf
import numpy as np

en_key = None
for k, v in dict_language.items():
    if v == "en":
        en_key = k
        break

print("Loading GPT model...")
change_gpt_weights(GPT_MODEL)

print("Loading SoVITS model...")
change_sovits_weights(SOVITS_MODEL)

print(f"Generating speech for: {TARGET_TEXT!r}")
gen = get_tts_wav(
    ref_wav_path=REF_AUDIO,
    prompt_text=REF_TEXT,
    prompt_language=en_key,
    text=TARGET_TEXT,
    text_language=en_key,
    top_k=5,
    top_p=1.0,
    temperature=1.0,
    speed=1.0,
)

# Collect all chunks
sample_rate, list_audio = next(gen)

# list_audio is likely to be a list of numpy arrays, but we will check its type
if isinstance(list_audio, np.ndarray):
    audio = list_audio
else:
    audio = np.array(list_audio)

sf.write(OUTPUT_WAV, audio, sample_rate)
print(f"\n[SUCCESS] Saved to: {OUTPUT_WAV}")
print(f"   Sample rate: {sample_rate} Hz | Duration: {len(audio)/sample_rate:.2f}s")
