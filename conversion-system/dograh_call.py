#!/usr/bin/env python3
"""Trigger a voice call using an external Dograh AI instance."""
import urllib.request
import urllib.error
import json
import os
import sys

def load_env(env_path):
    """Simple env loader if python-dotenv is not available."""
    if os.path.exists(env_path):
        with open(env_path) as f:
            for line in f:
                if "=" in line and not line.startswith("#"):
                    key, val = line.strip().split("=", 1)
                    os.environ[key] = val.strip('"').strip("'")

# Load environment variables
env_file = os.path.join(os.path.dirname(__file__), ".env")
load_env(env_file)

# Configuration from .env
API_URL = os.getenv("DOGRAH_API_URL", "http://3.95.139.180:8000").rstrip("/")
API_KEY = os.getenv("DOGRAH_API_KEY")
TRIGGER_UUID = os.getenv("DOGRAH_TRIGGER_UUID")
WORKFLOW_ID = os.getenv("DOGRAH_WORKFLOW_ID")
PHONE_NUMBER = "+917604896187"

def req(method, url, payload=None, headers={}):
    """Standard HTTP request helper."""
    data = json.dumps(payload).encode() if payload else None
    h = {"Content-Type": "application/json"}
    h.update(headers)
    r = urllib.request.Request(url, data=data, headers=h, method=method)
    try:
        with urllib.request.urlopen(r, timeout=30) as resp:
            return resp.status, json.loads(resp.read().decode())
    except urllib.error.HTTPError as e:
        err_body = e.read().decode()
        try:
            return e.code, json.loads(err_body)
        except:
            return e.code, {"error": err_body}
    except Exception as e:
        return 500, {"error": str(e)}

def trigger_call():
    if not all([API_KEY, TRIGGER_UUID]):
        print("❌ Error: DOGRAH_API_KEY and DOGRAH_TRIGGER_UUID must be set in .env")
        return

    print(f"🚀 Triggering call to {PHONE_NUMBER} via {API_URL}...")
    
    url = f"{API_URL}/api/v1/public/agent/{TRIGGER_UUID}"
    headers = {"X-API-Key": API_KEY}
    payload = {
        "phone_number": PHONE_NUMBER,
        "initial_context": {
            "lead_name": "Vijay",
            "lead_email": "rsvijaypargavan@gmail.com"
        }
    }

    code, resp = req("POST", url, payload, headers)

    if code == 200 or (isinstance(resp, dict) and "workflow_run_id" in resp):
        print(f"✅ Success! Workflow Run ID: {resp.get('workflow_run_id')}")
        print(f"🔗 View Call: {API_URL.replace(':8000', ':3010')}/calls/{resp.get('workflow_run_id')}")
    else:
        print(f"❌ Failed (HTTP {code}): {resp}")

if __name__ == "__main__":
    trigger_call()
