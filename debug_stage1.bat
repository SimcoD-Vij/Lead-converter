@echo off
set "PYTHONPATH=d:\Hivericks\Hivericks\conversion-system\voice cloning\GPT-SoVITS;d:\Hivericks\Hivericks\conversion-system\voice cloning\GPT-SoVITS\GPT_SoVITS"
set "CUDA_PATH=E:\NvidiaGPU\conda310\Lib\site-packages\nvidia"
set "PATH=%CUDA_PATH%\cublas\bin;%CUDA_PATH%\cudnn\bin;%CUDA_PATH%\curand\bin;%CUDA_PATH%\cusolver\bin;%CUDA_PATH%\cusparse\bin;%PATH%"

set "inp_text=D:\Hivericks\Hivericks\conversion-system\voice cloning\english accent\dataset\asr\sliced.list"
set "inp_wav_dir=D:\Hivericks\Hivericks\conversion-system\voice cloning\english accent\dataset\sliced"
set "exp_name=english_voice"
set "i_part=0"
set "all_parts=1"
set "opt_dir=d:\Hivericks\Hivericks\conversion-system\voice cloning\GPT-SoVITS\GPT_SoVITS\logs\english_voice"
set "bert_pretrained_dir=d:\Hivericks\Hivericks\conversion-system\voice cloning\GPT-SoVITS\GPT_SoVITS\pretrained_models\chinese-roberta-wwm-ext-large"
set "python_exe=E:\NvidiaGPU\conda310\python.exe"

"%python_exe%" "d:\Hivericks\Hivericks\conversion-system\voice cloning\GPT-SoVITS\GPT_SoVITS\prepare_datasets\1-get-text.py"
