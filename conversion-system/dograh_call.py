#!/usr/bin/env python3
"""Get full API key from Dograh and fire the call."""
import urllib.request, urllib.error, json, sys

BASE = "http://localhost:8000/api/v1"
TRIGGER_UUID = "ba47abe6-b676-483e-9740-67ab881b9e2c"
PHONE = "+917604896187"
EMAIL = "admin@hivericks.com"
PASSWORD = "Hivericks@2025"

def req(method, url, payload=None, headers={}):
    data = json.dumps(payload).encode() if payload else None
    h = {"Content-Type": "application/json"}
    h.update(headers)
    r = urllib.request.Request(url, data=data, headers=h, method=method)
    try:
        with urllib.request.urlopen(r, timeout=30) as resp:
            return resp.status, json.loads(resp.read().decode())
    except urllib.error.HTTPError as e:
        return e.code, json.loads(e.read().decode())

# Login
print("[1] Login...")
code, resp = req("POST", f"{BASE}/auth/login", {"email": EMAIL, "password": PASSWORD})
TOKEN = resp.get("token")
if not TOKEN:
    print(f"Login failed: {resp}"); sys.exit(1)
print(f"    ✅ Logged in")
AUTH = {"Authorization": f"Bearer {TOKEN}"}

# Get full API keys
print("\n[2] Getting API keys...")
code, keys = req("GET", f"{BASE}/user/api-keys", headers=AUTH)
print(f"    HTTP {code}")
print(f"    Full response: {json.dumps(keys, indent=2)}")

api_key = None
if code == 200 and isinstance(keys, list) and keys:
    # Find full key value
    for k in keys:
        key_val = k.get("key") or k.get("api_key") or k.get("value") or k.get("token")
        if key_val:
            api_key = key_val
            print(f"    ✅ API Key found: {api_key[:30]}...")
            break

# If no full key in list, create one
if not api_key:
    print("\n[3] Creating new API key...")
    code, resp = req("POST", f"{BASE}/user/api-keys", {"name": "hivericks-live"}, AUTH)
    print(f"    HTTP {code}: {json.dumps(resp, indent=2)}")
    api_key = resp.get("key") or resp.get("api_key") or resp.get("value") or resp.get("token")

print(f"\n[4] Firing call to {PHONE}...")
print(f"    Using API key: {str(api_key)[:30] if api_key else 'None - using Bearer'}")

call_headers = AUTH.copy()
if api_key:
    call_headers["X-API-Key"] = api_key

call_payload = {
    "phone_number": PHONE,
    "initial_context": {"lead_name": "Vijay", "lead_email": "rsvijaypargavan@gmail.com"}
}

# Try with X-API-Key
if api_key:
    code, resp = req("POST", f"{BASE}/public/agent/{TRIGGER_UUID}", call_payload, {"X-API-Key": api_key, "Content-Type": "application/json"})
    print(f"    X-API-Key attempt → HTTP {code}: {json.dumps(resp)[:300]}")
    if code in (200, 201):
        print(f"\n✅ CALL FIRED! Run ID: {resp.get('workflow_run_id','N/A')}")
        print(f"📱 Phone {PHONE} should ring shortly!")
        sys.exit(0)

# Try with Bearer token
code, resp = req("POST", f"{BASE}/public/agent/{TRIGGER_UUID}", call_payload, AUTH)
print(f"    Bearer attempt → HTTP {code}: {json.dumps(resp)[:300]}")
if code in (200, 201):
    print(f"\n✅ CALL FIRED with Bearer token!")
    print(f"📱 Phone {PHONE} should ring shortly!")
    sys.exit(0)

# Save token to env for future use
print(f"\n[5] Saving credentials for hivericks..")
env_file = "/home/ubuntu/conversion-system/.env"
try:
    with open(env_file) as f:
        content = f.read()
    if api_key:
        import re
        content = re.sub(r"DOGRAH_API_KEY=.*", f"DOGRAH_API_KEY={api_key}", content)
        with open(env_file, "w") as f:
            f.write(content)
        print(f"    ✅ Updated .env DOGRAH_API_KEY={api_key[:20]}...")
except Exception as e:
    print(f"    Could not update .env: {e}")

print("\n❌ Call could not be fired. Check output above.")
