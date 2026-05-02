@echo off
set "PYTHONPATH=d:\Hivericks\Hivericks\conversion-system\voice cloning\GPT-SoVITS;d:\Hivericks\Hivericks\conversion-system\voice cloning\GPT-SoVITS\GPT_SoVITS"
set "CUDA_PATH=E:\NvidiaGPU\conda310\Lib\site-packages\nvidia"
set "PATH=%CUDA_PATH%\cublas\bin;%CUDA_PATH%\cudnn\bin;%CUDA_PATH%\curand\bin;%CUDA_PATH%\cusolver\bin;%CUDA_PATH%\cusparse\bin;%PATH%"
"E:\NvidiaGPU\conda310\python.exe" "d:\Hivericks\Hivericks\conversion-system\voice cloning\GPT-SoVITS\tools\asr\fasterwhisper_asr.py" -i "d:\Hivericks\Hivericks\test_asr_input" -o "d:\Hivericks\Hivericks\test_asr_output" -l en -p float32 -s base.en
