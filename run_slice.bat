@echo off
set PYTHONPATH=d:\Hivericks\Hivericks\conversion-system\voice cloning\GPT-SoVITS;d:\Hivericks\Hivericks\conversion-system\voice cloning\GPT-SoVITS\GPT_SoVITS
"E:\NvidiaGPU\conda310\python.exe" "d:\Hivericks\Hivericks\conversion-system\voice cloning\GPT-SoVITS\tools\slice_audio.py" "D:\Hivericks\Hivericks\conversion-system\voice cloning\english accent\dataset\english dataset.wav" "D:\Hivericks\Hivericks\conversion-system\voice cloning\english accent\dataset\sliced" -34 4000 300 10 500 0.9 0.25 0 1
