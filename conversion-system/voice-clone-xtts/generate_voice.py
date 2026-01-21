import argparse
import os
import sys
from TTS.api import TTS
from datetime import datetime

# Set up argument parser
parser = argparse.ArgumentParser(description='Generate voice audio using Coqui TTS (XTTS v2).')
parser.add_argument('--text', type=str, required=True, help='Text to speak.')
parser.add_argument('--voice', type=str, help='Path to the wav file to clone voice from (optional).')
parser.add_argument('--out', type=str, help='Output filename (optional).')
parser.add_argument('--speed', type=float, default=0.93, help='Speed of speech (default: 0.93)')
parser.add_argument('--language', type=str, default="en", help='Language code (default: en)')

args = parser.parse_args()

# Configuration
VOICE_PATHS = [
    "voices/my_voice.wav",
    "voices/voice1.wav",
    "voices/voice2.wav"
]
OUTPUT_DIR = "output"

# Ensure output directory exists
os.makedirs(OUTPUT_DIR, exist_ok=True)

# Determine output path
if args.out:
    output_path = os.path.join(OUTPUT_DIR, args.out)
    if not output_path.endswith('.wav'):
        output_path += ".wav"
else:
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    output_path = os.path.join(OUTPUT_DIR, f"voice_{timestamp}.wav")

# Determine voice files to use
if args.voice:
    # User specified a specific voice file
    if os.path.exists(args.voice):
        valid_voice_paths = [args.voice]
        print(f"🗣️ Cloning from specific voice file: {args.voice}")
    else:
        print(f"❌ Error: Specified voice file not found: {args.voice}")
        sys.exit(1)
else:
    # Default to the predefined list in voices/
    valid_voice_paths = []
    for p in VOICE_PATHS:
        if os.path.exists(p):
            valid_voice_paths.append(p)
        else:
            print(f"⚠️ Warning: Default voice file not found: {p}")
            
    if not valid_voice_paths:
        print("❌ Error: No valid voice files found in 'voices/' directory.")
        sys.exit(1)
    print(f"👥 Using default voice mix from {len(valid_voice_paths)} files.")

print(f"📝 Text: {args.text}")
print(f"🎙 Loading XTTS model...")

try:
    # Initialize TTS
    tts = TTS(
        model_name="tts_models/multilingual/multi-dataset/xtts_v2",
        gpu=False
    )

    print("🔊 Generating voice...")
    tts.tts_to_file(
        text=args.text,
        speaker_wav=valid_voice_paths,
        language=args.language,
        file_path=output_path,
        speed=args.speed,
        temperature=0.7,
        repetition_penalty=1.1
    )

    print(f"✅ Success! Saved to: {output_path}")

except Exception as e:
    print(f"❌ Error during generation: {str(e)}")
