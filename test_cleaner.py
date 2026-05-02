import sys
import os
# Add the path to the GPT_SoVITS directory
sys.path.append(r"d:\Hivericks\Hivericks\conversion-system\voice cloning\GPT-SoVITS\GPT_SoVITS")
from text.cleaner import clean_text
print("Cleaner imported")
try:
    phones, word2ph, norm_text = clean_text("Hello there, how are you?", "en")
    print(f"Phones: {phones}")
    print(f"Norm text: {norm_text}")
except Exception as e:
    import traceback
    print(f"Error: {e}")
    traceback.print_exc()
