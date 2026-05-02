@echo off
set "PYTHONPATH=d:\Hivericks\Hivericks\conversion-system\voice cloning\GPT-SoVITS;d:\Hivericks\Hivericks\conversion-system\voice cloning\GPT-SoVITS\GPT_SoVITS"
set "CUDA_PATH=E:\NvidiaGPU\conda310\Lib\site-packages\nvidia"
set "PATH=%CUDA_PATH%\cublas\bin;%CUDA_PATH%\cudnn\bin;%CUDA_PATH%\curand\bin;%CUDA_PATH%\cusolver\bin;%CUDA_PATH%\cusparse\bin;%PATH%"
if not exist "D:\Hivericks\Hivericks\conversion-system\voice cloning\english accent\dataset\asr" mkdir "D:\Hivericks\Hivericks\conversion-system\voice cloning\english accent\dataset\asr"
"E:\NvidiaGPU\conda310\python.exe" "d:\Hivericks\Hivericks\conversion-system\voice cloning\GPT-SoVITS\tools\asr\fasterwhisper_asr.py" -i "D:\Hivericks\Hivericks\conversion-system\voice cloning\english accent\dataset\sliced" -o "D:\Hivericks\Hivericks\conversion-system\voice cloning\english accent\dataset\asr" -l en -p int8 -s base.en
