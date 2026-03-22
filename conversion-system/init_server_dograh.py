#!/usr/bin/env python3
"""
Server Initializer: Create a workflow and get its Trigger UUID.
"""
import urllib.request, json, sys

BASE = 'http://localhost:8000/api/v1'
CREDS = {'email': 'admin@hivericks.com', 'password': 'Hivericks@2025'}

def req(url, method='GET', data=None, headers={}):
    h = {'Content-Type': 'application/json'}
    h.update(headers)
    d = json.dumps(data).encode() if data else None
    r = urllib.request.Request(url, data=d, headers=h, method=method)
    try:
        with urllib.request.urlopen(r, timeout=15) as resp:
            return resp.status, json.loads(resp.read().decode())
    except urllib.error.HTTPError as e:
        try: return e.code, json.loads(e.read().decode())
        except: return e.code, str(e)
    except Exception as e:
        return 500, str(e)

# 1. Login
print("[1] Logging into Dograh...")
st, res = req(f'{BASE}/auth/login', 'POST', CREDS)
if st != 200:
    print(f"Login failed: {res}")
    sys.exit(1)
TOKEN = res.get('token')
AUTH = {'Authorization': f'Bearer {TOKEN}'}

# 2. Setup Workflow
print("[2] Creating Sales AI Workflow...")
wf_payload = {
    "name": "Hivericks Sales Bot",
    "description": "Enterprise voice assistant",
    "is_active": True,
    "workflow_definition": {
        "nodes": [
            {"id": "trigger_1", "type": "trigger", "config": {"type": "api"}},
            {"id": "ai_agent_1", "type": "ai_agent", "config": {
                "prompt": "You are a professional sales assistant for Hivericks.",
                "voice_id": "polly_matthew",
                "model": "gpt-4"
            }}
        ],
        "edges": [{"source": "trigger_1", "target": "ai_agent_1"}]
    }
}

st, wf = req(f'{BASE}/workflow/create/definition', 'POST', wf_payload, AUTH)

if st not in (200, 201):
    print(f"Workflow creation failed ({st}): {wf}")
    sys.exit(1)

wfid = wf.get('id')
# Re-fetch for trigger_uuid (Note: /api/v1/workflow/fetch/{id})
st2, det = req(f'{BASE}/workflow/fetch/{wfid}', headers=AUTH)
print(f"DEBUG: Full Workflow Details:\n{json.dumps(det, indent=2)}")
trigger_uuid = det.get('trigger_uuid')

print("\n" + "="*40)
print(f"✅ SERVER INITIALIZED!")
print(f"WORKFLOW ID  : {wfid}")
print(f"TRIGGER UUID : {trigger_uuid}")
print("="*40)

# Save to local file for easy reading
with open('/home/ubuntu/dograh_config.json', 'w') as f:
    json.dump({"trigger_uuid": trigger_uuid, "workflow_id": wfid}, f)
