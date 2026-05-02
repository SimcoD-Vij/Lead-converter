@echo off
set PYTHONPATH=d:\Hivericks\conversion-system\voice cloning\GPT-SoVITS;d:\Hivericks\conversion-system\voice cloning\GPT-SoVITS\GPT_SoVITS
cd /d "d:\Hivericks\conversion-system\voice cloning\GPT-SoVITS\GPT_SoVITS"
"E:\NvidiaGPU\conda310\python.exe" -u s1_train.py --config_file configs\s1_english.yaml > "d:\Hivericks\train_gpt_stdout.txt" 2> "d:\Hivericks\train_gpt_stderr.txt"
echo GPT Training finished with exit code %ERRORLEVEL%
