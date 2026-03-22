import os

def read_pipecat_dograh():
    base_path = "/root/.local/lib/python3.12/site-packages/pipecat/services/dograh"
    files = ["llm.py", "stt.py", "tts.py"]
    
    for f in files:
        path = os.path.join(base_path, f)
        print(f"\n--- {f} ---")
        if os.path.exists(path):
            with open(path, 'r') as file:
                print(file.read())
        else:
            print(f"File not found: {path}")

if __name__ == "__main__":
    read_pipecat_dograh()
