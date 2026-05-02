#!/usr/bin/env python3
import asyncio
import httpx
import json
import asyncpg
import os

MPS_API_URL = "https://services.dograh.com"
DB_URL = "postgresql://postgres:postgres@postgres:5432/dograh"
USER_PROVIDER_ID = "oss_1771917854_00485a6b-9e73-411e-b86c-66f0ececdddd"

async def generate_keys():
    print(f"MPS_API_URL: {MPS_API_URL}")
    
    async with httpx.AsyncClient(timeout=30.0) as client:
        try:
            payload = {
                "name": "Default Dograh Model Service Key",
                "description": "Auto-generated key for OSS user",
                "expires_in_days": 90,
                "created_by": USER_PROVIDER_ID,
            }
            print(f"Requesting service key from {MPS_API_URL}/api/v1/service-keys/...")
            response = await client.post(
                f"{MPS_API_URL}/api/v1/service-keys/",
                json=payload
            )
            
            if response.status_code != 200:
                print(f"❌ Failed to get service key: {response.status_code} - {response.text}")
                return

            data = response.json()
            # The field is actually 'service_key'
            service_key = data.get("service_key")
            if not service_key:
                print(f"❌ No service_key in response: {data}")
                return
            
            print(f"✅ Successfully obtained service key!")

            # Now update the local database
            print(f"Connecting to database at {DB_URL}...")
            conn = await asyncpg.connect(DB_URL)
            
            row = await conn.fetchrow("SELECT configuration FROM user_configurations WHERE user_id = 1")
            if row is None:
                print("❌ No configuration found for user_id = 1")
                await conn.close()
                return

            config = json.loads(row['configuration'])
            
            if "providers" not in config:
                config["providers"] = {}
            if "dograh" not in config["providers"]:
                config["providers"]["dograh"] = {}
            
            config["providers"]["dograh"]["api_key"] = service_key
            config["providers"]["dograh"]["model"] = "multi"
            config["providers"]["dograh"]["speed"] = 1.0
            
            new_config_js = json.dumps(config)
            await conn.execute(
                "UPDATE user_configurations SET configuration = $1::jsonb WHERE user_id = 1",
                new_config_js
            )
            
            print("✅ Database updated successfully!")
            await conn.close()
            
            # Print the full key for the .env update
            print(f"\nYour new DOGRAH_API_KEY is: {service_key}")

        except Exception as e:
            print(f"❌ An error occurred: {e}")
            import traceback
            traceback.print_exc()

if __name__ == "__main__":
    asyncio.run(generate_keys())
