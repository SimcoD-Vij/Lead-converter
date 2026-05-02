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
set "ssl_pretrained_dir=d:\Hivericks\Hivericks\conversion-system\voice cloning\GPT-SoVITS\GPT_SoVITS\pretrained_models\chinese-hubert-base"
set "python_exe=E:\NvidiaGPU\conda310\python.exe"

if not exist "%opt_dir%" mkdir "%opt_dir%"

echo Running Stage 1: Text formatting and BERT features...
"%python_exe%" "d:\Hivericks\Hivericks\conversion-system\voice cloning\GPT-SoVITS\GPT_SoVITS\prepare_datasets\1-get-text.py"

echo Running Stage 2: SSL feature extraction...
set "cnhubert_base_dir=%ssl_pretrained_dir%"
"%python_exe%" "d:\Hivericks\Hivericks\conversion-system\voice cloning\GPT-SoVITS\GPT_SoVITS\prepare_datasets\2-get-hubert-wav32k.py"

echo Running Stage 3: Semantic token extraction...
set "pretrained_s2G=d:\Hivericks\Hivericks\conversion-system\voice cloning\GPT-SoVITS\GPT_SoVITS\pretrained_models\gsv-v2final-pretrained\s2G2333k.pth"
set "s2config_path=d:\Hivericks\Hivericks\conversion-system\voice cloning\GPT-SoVITS\GPT_SoVITS\configs\s2_english.json"
"%python_exe%" "d:\Hivericks\Hivericks\conversion-system\voice cloning\GPT-SoVITS\GPT_SoVITS\prepare_datasets\3-get-semantic.py"

echo Pre-processing finished!
