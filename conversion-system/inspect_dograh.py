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
    except urllib.error.HTTPError as e:
        try:
            return e.code, json.loads(e.read().decode())
        except:
            return e.code, str(e)
    except Exception as e:
        return 500, str(e)

print("--- DOGRAH SERVER INSPECTION ---")

# 1. Login
st, res = req(f'{BASE}/auth/login', 'POST', CREDS)
if st != 200:
    print(f'Login failed ({st}): {res}')
    sys.exit(1)
TOKEN = res.get('token')
AUTH = {'Authorization': f'Bearer {TOKEN}'}
print(f'✅ Logged in as admin.')

# 2. List Workflows & Triggers
st, workflows = req(f'{BASE}/workflows', headers=AUTH)
print(f'\nWorkflows (found {len(workflows) if isinstance(workflows, list) else 0}):')
if isinstance(workflows, list):
    for wf in workflows:
        wfid = wf.get('id')
        print(f'  - [{wfid}] {wf.get("name")}')
        # Get details
        stdet, det = req(f'{BASE}/workflows/{wfid}', headers=AUTH)
        if stdet == 200:
            print(f'    Trigger UUID: {det.get("trigger_uuid")}')
            print(f'    Active: {det.get("is_active")}')
        else:
            print(f'    Could not get details ({stdet})')

# 3. Handle API Keys
print('\nAPI Keys:')
st, keys = req(f'{BASE}/user/api-keys', headers=AUTH)
if st == 200 and isinstance(keys, list):
    for k in keys:
        print(f'  - {k.get("name")} (Prefix: {k.get("key_prefix")})')

print('\nCreating fresh API Key to get full value...')
st, key_res = req(f'{BASE}/user/api-keys', 'POST', {'name': 'sync_key_' + str(int(sys.version_info[0]))}, headers=AUTH)
if st in (200, 201):
    full_key = key_res.get('key') or key_res.get('api_key')
    print(f'✅ FULL KEY CREATED: {full_key}')
else:
    print(f'❌ Key creation failed ({st}): {key_res}')

# 4. Final Trigger Check
print("\n--- END INSPECTION ---")
