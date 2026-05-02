import os
import sys
import torch
try:
    from transformers import AutoModelForMaskedLM, AutoTokenizer
    print("Imports successful")
except Exception as e:
    print(f"Transformers import failed: {e}")

print(f"PyTorch version: {torch.__version__}")
print(f"CUDA available: {torch.cuda.is_available()}")
if torch.cuda.is_available():
    print(f"Device name: {torch.cuda.get_device_name(0)}")
