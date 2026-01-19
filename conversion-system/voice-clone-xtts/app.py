from TTS.api import TTS
import os
from datetime import datetime

# Use ALL available voice samples
VOICE_PATHS = [
    "voices/my_voice.wav",
    "voices/voice1.wav",
    "voices/voice2.wav"
]

OUTPUT_DIR = "output"
os.makedirs(OUTPUT_DIR, exist_ok=True)

print("🔊 Loading XTTS model (first time may take a minute)...")
tts = TTS(
    model_name="tts_models/multilingual/multi-dataset/xtts_v2",
    gpu=False
)

while True:
    text = input("\n📝 Enter text to speak (or type 'exit'): ")

    if text.lower().strip() == "exit":
        print("👋 Exiting...")
        break

    # Unique output file (no overwrite)
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    output_path = f"{OUTPUT_DIR}/voice_{timestamp}.wav"

    print("🎙 Generating voice...")

    tts.tts_to_file(
        text=text,
        speaker_wav=VOICE_PATHS,   # ← ALL 3 voices used here
        language="en",
        file_path=output_path,
        speed=0.93,                # natural pacing
        temperature=0.7,           # less robotic
        repetition_penalty=1.1
    )

    print(f"✅ Saved: {output_path}")
