#!/usr/bin/env python3
import asyncio
import httpx
import json

MPS_API_URL = "https://services.dograh.com"
USER_PROVIDER_ID = "oss_1771917854_00485a6b-9e73-411e-b86c-66f0ececdddd"

async def get_key():
    async with httpx.AsyncClient(timeout=30.0) as client:
        try:
            payload = {
                "name": "Default Dograh Model Service Key",
                "description": "Auto-generated key for OSS user",
                "expires_in_days": 90,
                "created_by": USER_PROVIDER_ID,
            }
            response = await client.post(
                f"{MPS_API_URL}/api/v1/service-keys/",
                json=payload
            )
            if response.status_code == 200:
                print(response.json().get("service_key"))
            else:
                print(f"ERROR: {response.status_code} - {response.text}")
        except Exception as e:
            print(f"ERROR: {e}")

if __name__ == "__main__":
    asyncio.run(get_key())
