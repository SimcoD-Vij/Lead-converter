from TTS.tts.layers.xtts.trainer.gpt_trainer import GPTTrainerConfig, GPTArgs
import inspect

config = GPTTrainerConfig()
print("GPTTrainerConfig attributes:")
for name in dir(config):
    if not name.startswith("_"):
        print(name)

args = GPTArgs()
print("\nGPTArgs attributes:")
for name in dir(args):
    if not name.startswith("_"):
        print(name)
