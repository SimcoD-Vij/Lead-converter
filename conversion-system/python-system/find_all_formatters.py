import TTS.tts.datasets as datasets
import inspect

print("Functions in TTS.tts.datasets (potential formatters):")
funcs = [name for name, obj in inspect.getmembers(datasets, inspect.isfunction)]
print(", ".join(funcs))

# Also check the formatters submodule if it exists
try:
    import TTS.tts.datasets.formatters as f
    print("\nFunctions in TTS.tts.datasets.formatters:")
    ffuncs = [name for name, obj in inspect.getmembers(f, inspect.isfunction)]
    print(", ".join(ffuncs))
except:
    pass
