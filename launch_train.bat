@echo off
set PYTHONPATH=d:\Hivericks\Hivericks\conversion-system\voice cloning\GPT-SoVITS;d:\Hivericks\Hivericks\conversion-system\voice cloning\GPT-SoVITS\GPT_SoVITS
cd /d "d:\Hivericks\Hivericks\conversion-system\voice cloning\GPT-SoVITS\GPT_SoVITS"
"E:\NvidiaGPU\conda310\python.exe" -u s2_train.py --config configs\s2_english.json > "d:\Hivericks\Hivericks\train_stdout.txt" 2> "d:\Hivericks\Hivericks\train_stderr.txt"
echo Training finished with exit code %ERRORLEVEL%
