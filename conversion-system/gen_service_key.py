#!/usr/bin/env python3
"""
Script to generate fresh Dograh OSS service keys via the cloudflared tunnel.
Run this inside the dograh_api container.
"""
import asyncio
import json
import httpx
from api.constants import MPS_API_URL, DEPLOYMENT_MODE

async def generate_keys():
    print(f"MPS_API_URL: {MPS_API_URL}")
    print(f"DEPLOYMENT_MODE: {DEPLOYMENT_MODE}")
    
    user_provider_id = "oss_1771917854_00485a6b-9e73-411e-b86c-66f0ececdddd"
    
    async with httpx.AsyncClient(timeout=30.0) as client:
        print(f"\nRequesting service key from {MPS_API_URL}/api/v1/service-keys/...")
        response = await client.post(
            f"{MPS_API_URL}/api/v1/service-keys/",
            json={
                "name": "Default Dograh Model Service Key",
                "description": "Auto-generated key for OSS user",
                "expires_in_days": 90,
                "created_by": user_provider_id,
            },
            timeout=30.0,
        )
        print(f"Status: {response.status_code}")
        data = response.json()
        print(f"Response: {json.dumps(data, indent=2)}")
        
        if response.status_code == 200 and data.get("service_key"):
            service_key = data["service_key"]
            print(f"\n✅ Got service key: {service_key[:20]}...")
            
            # Now update the database with these keys
            import asyncpg
            conn = await asyncpg.connect("postgresql://postgres:postgres@postgres:5432/dograh")
            config = {
                "llm": {"provider": "dograh", "api_key": service_key, "model": "default"},
                "tts": {"provider": "dograh", "api_key": service_key, "model": "default", "voice": "default", "speed": 1.0},
                "stt": {"provider": "dograh", "api_key": service_key, "model": "default", "language": "multi"},
            }
            await conn.execute(
                "UPDATE user_configurations SET configuration = $1::jsonb WHERE user_id = 1",
                json.dumps(config)
            )
            print("✅ DB updated with fresh keys!")
            row = await conn.fetchrow("SELECT configuration FROM user_configurations WHERE user_id = 1")
            print(f"Config now has providers: {list(json.loads(row['configuration']).keys())}")
            await conn.close()
        else:
            print(f"\n❌ Failed to get service key: {data}")

asyncio.run(generate_keys())
