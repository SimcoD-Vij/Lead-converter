import os

def patch_file(filepath):
    if not os.path.exists(filepath):
        print(f"File not found: {filepath}")
        return
    
    with open(filepath, 'r') as f:
        content = f.read()
    
    # Add X-OSS-USER header for local auth
    old_line = '"Authorization": f"Bearer {self._api_key}",'
    new_line = '"Authorization": f"Bearer {self._api_key}", "X-OSS-USER": "hivericks-admin",'
    
    if old_line in content:
        new_content = content.replace(old_line, new_line)
        with open(filepath, 'w') as f:
            f.write(new_content)
        print(f"Successfully patched {filepath}")
    else:
        print(f"Target line not found in {filepath}")

stt_path = "/root/.local/lib/python3.12/site-packages/pipecat/services/dograh/stt.py"
tts_path = "/root/.local/lib/python3.12/site-packages/pipecat/services/dograh/tts.py"

patch_file(stt_path)
patch_file(tts_path)
