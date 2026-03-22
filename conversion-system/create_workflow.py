#!/usr/bin/env python3
import urllib.request, json, sys

BASE = 'http://localhost:8000/api/v1'
CREDS = {'email': 'admin@hivericks.com', 'password': 'Hivericks@2025'}

def req(url, method='GET', data=None, headers={}):
    h = {'Content-Type': 'application/json'}
    h.update(headers)
    d = json.dumps(data).encode() if data else None
    r = urllib.request.Request(url, data=d, headers=h, method=method)
    try:
        with urllib.request.urlopen(r, timeout=10) as resp:
            return resp.status, json.loads(resp.read().decode())
    except Exception as e:
        return 500, str(e)

# 1. Login
st, res = req(f'{BASE}/auth/login', 'POST', CREDS)
TOKEN = res.get('token')
AUTH = {'Authorization': f'Bearer {TOKEN}'}

# 2. Create Workflow
print("Creating workflow...")
workflow_config = {
    "name": "Hivericks Sales AI",
    "description": "Voice sales bot for Hivericks",
    "is_active": True,
    "config": {
        "nodes": [
            {
                "id": "trigger",
                "type": "trigger",
                "config": {"type": "api"}
            },
            {
                "id": "ai_agent",
                "type": "ai_agent",
                "config": {
                    "prompt": "You are a sales assistant for Hivericks.",
                    "voice_id": "polly_matthew"
                }
            }
        ],
        "edges": [{"source": "trigger", "target": "ai_agent"}]
    }
}

st, wf_res = req(f'{BASE}/workflows', 'POST', workflow_config, headers=AUTH)
if st in (200, 201):
    wfid = wf_res.get('id')
    # Get full details for trigger_uuid
    st2, det = req(f'{BASE}/workflows/{wfid}', headers=AUTH)
    print(f"✅ WORKFLOW CREATED!")
    print(f"   WF ID: {wfid}")
    print(f"   TRIGGER UUID: {det.get('trigger_uuid')}")
else:
    print(f"❌ Failed to create workflow ({st}): {wf_res}")
