import subprocess
import os

env = os.environ.copy()
env["PYTHONPATH"] = r"d:\Hivericks\conversion-system\voice cloning\GPT-SoVITS;d:\Hivericks\conversion-system\voice cloning\GPT-SoVITS\GPT_SoVITS"

print("Starting wrapper execution...")
result = subprocess.run(
    [
        r"E:\NvidiaGPU\conda310\python.exe",
        "-u",
        r"d:\Hivericks\conversion-system\voice cloning\GPT-SoVITS\GPT_SoVITS\s2_train.py",
        "--config",
        r"d:\Hivericks\conversion-system\voice cloning\GPT-SoVITS\GPT_SoVITS\configs\s2_english.json"
    ],
    env=env,
    capture_output=True,
    text=True,
    encoding="utf-8"
)

print(f"Return code: {result.returncode}")
print(f"STDOUT ({len(result.stdout)} chars):")
print(result.stdout)
print(f"STDERR ({len(result.stderr)} chars):")
print(result.stderr)
print("Finished wrapper.")
