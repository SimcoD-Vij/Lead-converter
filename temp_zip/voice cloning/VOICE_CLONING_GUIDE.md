# Voice Cloning System: Setup & Training Guide

This guide outlines the process for fine-tuning the GPT-SoVITS model using your own dataset (Indian English).

## Prerequisites

- **Hardware**: Dedicated NVIDIA GPU (minimum 6GB VRAM recommended).
- **Software**: 
  - [Python 3.10+](https://www.python.org/)
  - [FFmpeg](https://ffmpeg.org/download.html) (Installed and in your system PATH).
  - [NVIDIA CUDA Toolkit 11.8 or later](https://developer.nvidia.com/cuda-downloads).

## 1. Environment Setup

### Local Setup (Windows)
We recommend using a dedicated Conda environment. The following has been tested with `E:\NvidiaGPU\conda310`.

1. Clone the repository and install dependencies:
   ```powershell
   git clone https://github.com/RVC-Boss/GPT-SoVITS.git
   cd GPT-SoVITS
   pip install -r requirements.txt
   ```
2. Install additional required packages for training:
   ```powershell
   pip install x_transformers ffmpeg-python
   ```

## 2. Dataset Preparation

Your dataset should be located in:
`d:\Hivericks\conversion-system\voice cloning\english accent\dataset`

The system expects sliced audio segments and their transcriptions. If you have a single large `.wav` file, you must first slice it using the GPT-SoVITS built-in tools.

## 3. Training the Acoustic Model (SoVITS - Stage 1)

The SoVITS model maps text phonemes to acoustic features.

### Training Configuration
- **Config file**: `GPT_SoVITS/configs/s2_english.json`
- **Batch Size**: 2 (Optimized for 6GB VRAM)
- **Epochs**: 20–30 recommended for best quality.

### How to Start Training
Run the provided batch script:
`d:\Hivericks\launch_train.bat`

This script handles the `PYTHONPATH` and background execution, writing logs to `d:\Hivericks\train_stdout.txt`.

## 4. Training the Auto-Regressive Model (GPT - Stage 2)

The GPT model models the natural flow and cadence of speech.

### Training Configuration
- **Config file**: `GPT_SoVITS/configs/s1_english.yaml`
- **Paths**: Points to the extracted semantic and phoneme files in `logs/english_voice/`.

### How to Start Training
Wait for SoVITS (Stage 1) to finish, then run:
`d:\Hivericks\launch_gpt_train.bat`

Logs will be written to `d:\Hivericks\train_gpt_stdout.txt`.

## 5. Dockerization

To run the system in a Docker container with GPU support:

1. **Build the Image**:
   ```bash
   docker build -t voice-cloning-trainer -f Dockerfile.voice .
   ```
2. **Launch with Docker Compose**:
   ```bash
   docker-compose -f docker-compose.voice.yml up -d
   ```

## 6. Troubleshooting

- **Silent Exit (Code 0)**: Usually caused by missing system dependencies like `ffmpeg` or GPU driver incompatibilities.
- **CUDA Out of Memory**: If this happens, reduce the `batch_size` in the `.json` (SoVITS) or `.yaml` (GPT) config files.
- **AttributeError (name)**: This occurs if `hps.name` is missing from the config; ensure the config file matches the template provided in the implementation.
