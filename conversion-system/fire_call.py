#!/usr/bin/env python3
"""Fire a Dograh call to Vijay (+917604896187) immediately."""

import urllib.request
import urllib.error
import json
import sys
import os

DOGRAH_URL = "http://localhost:8000"
TRIGGER_UUID = os.getenv("DOGRAH_TRIGGER_UUID", "YOUR_TRIGGER_UUID_HERE")
API_KEY = os.getenv("DOGRAH_API_KEY", "")
PHONE = "+917604896187"
LEAD_NAME = "Vijay"
LEAD_EMAIL = "rsvijaypargavan@gmail.com"

print(f"[*] Firing Dograh call to {PHONE}...")

payload = json.dumps({
    "phone_number": PHONE,
    "initial_context": {
        "lead_name": LEAD_NAME,
        "lead_email": LEAD_EMAIL,
        "lead_company": "",
        "lead_status": "CALL_IDLE"
    }
}).encode("utf-8")

url = f"{DOGRAH_URL}/api/v1/public/agent/{TRIGGER_UUID}"
req = urllib.request.Request(
    url,
    data=payload,
    headers={
        "Content-Type": "application/json",
        "X-API-Key": API_KEY
    },
    method="POST"
)

try:
    with urllib.request.urlopen(req, timeout=30) as resp:
        body = json.loads(resp.read().decode())
        print("[SUCCESS] Call initiated!")
        print(f"  Workflow Run ID : {body.get('workflow_run_id', 'N/A')}")
        print(f"  Status          : {body.get('status', 'N/A')}")
        print(f"  Full response   : {json.dumps(body, indent=2)}")
except urllib.error.HTTPError as e:
    body = e.read().decode()
    print(f"[FAIL] HTTP {e.code}: {body}")
    sys.exit(1)
except Exception as e:
    print(f"[FAIL] {type(e).__name__}: {e}")
    sys.exit(1)
