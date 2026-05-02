import whisper
import os

# Add ffmpeg to PATH
ffmpeg_dir = r"D:\Insta context\reel_intelligence\bin"
os.environ["PATH"] += os.pathsep + ffmpeg_dir

print(f"Using Whisper (with ffmpeg from {ffmpeg_dir})...")
model = whisper.load_model("base")

clips = [
    r"D:\Hivericks\conversion-system\train\100038\audio.wav",
    r"D:\Hivericks\conversion-system\train\101097\audio.wav",
    r"D:\Hivericks\conversion-system\train\102644\audio.wav",
    r"D:\Hivericks\conversion-system\train\105756\audio.wav",
    r"D:\Hivericks\conversion-system\train\110189\audio.wav",
    r"D:\Hivericks\conversion-system\train\120097\audio.wav",
    r"D:\Hivericks\conversion-system\train\130179\audio.wav",
    r"D:\Hivericks\conversion-system\train\140133\audio.wav",
    r"D:\Hivericks\conversion-system\train\150103\audio.wav",
    r"D:\Hivericks\conversion-system\train\160141\audio.wav"
]

for clip in clips:
    if os.path.exists(clip):
        print(f"Transcribing {clip}...")
        try:
            result = model.transcribe(clip)
            print(f"[{os.path.basename(os.path.dirname(clip))}] {result['text']}")
        except Exception as e:
            print(f"Error transcribing {clip}: {e}")
    else:
        print(f"Skip {clip} (Not found)")
