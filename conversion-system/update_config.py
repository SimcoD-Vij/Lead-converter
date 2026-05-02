import subprocess
import json

config = {
    "llm": {"provider": "dograh", "api_key": "mps-non-production", "model": "default"},
    "stt": {"provider": "dograh", "api_key": "mps-non-production", "model": "default"},
    "tts": {"provider": "dograh", "api_key": "mps-non-production", "voice": "default", "speed": 1.0}
}
json_str = json.dumps(config)
sql = f"UPDATE user_configurations SET configuration = '{json_str}' WHERE user_id = 6;"
command = ["docker", "exec", "dograh_postgres", "psql", "-U", "postgres", "-d", "dograh", "-c", sql]

print(f"Executing: {' '.join(command)}")
result = subprocess.run(command, capture_output=True, text=True)
print(f"Stdout: {result.stdout}")
print(f"Stderr: {result.stderr}")
