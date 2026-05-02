"""
Dograh Local Setup Script - FINAL v6
Full Integration: User, Org, API Key, Workflow, Definition, Trigger, and Telephony
"""

import asyncio
import asyncpg
import hashlib
import secrets
import json
from datetime import datetime

# Database connection settings (from docker-compose.dograh.yml)
DB_CONFIG = {
    'host': '127.0.0.1',
    'port': 5432,
    'database': 'postgres',
    'user': 'postgres',
    'password': 'postgres'
}

# Your configuration
USER_EMAIL = 'admin@local.dev'
ORG_NAME = 'Conversion System'
WORKFLOW_NAME = 'Sales Bot'
API_KEY_NAME = 'Conversion System Integration'

# Telephony settings from .env
TWILIO_SID = "YOUR_TWILIO_SID"
TWILIO_AUTH = "YOUR_TWILIO_AUTH"
TWILIO_PHONE = "YOUR_TWILIO_PHONE"


def generate_api_key():
    """Generate a Dograh-style API key"""
    key = f"dgr_{secrets.token_urlsafe(40)}"
    key_hash = hashlib.sha256(key.encode()).hexdigest()
    prefix = key[:11]
    return key, key_hash, prefix


async def setup_dograh():
    """Set up Dograh with the full requirements for a working voice call"""
    
    print("Starting Dograh Local Setup...")
    
    try:
        conn = await asyncpg.connect(**DB_CONFIG)
    except Exception as e:
        print(f"Failed to connect to database: {e}")
        return

    try:
        # 1. User
        user_id = await conn.fetchval("SELECT id FROM users WHERE email = $1", USER_EMAIL)
        if not user_id:
            user_id = await conn.fetchval("""
                INSERT INTO users (provider_id, email, is_superuser, created_at)
                VALUES ($1, $2, $3, $4) RETURNING id
            """, USER_EMAIL, USER_EMAIL, True, datetime.utcnow())
            print(f"   User created: {user_id}")
        else: print(f"   User exists: {user_id}")

        # 2. Organization
        org_id = await conn.fetchval("SELECT id FROM organizations WHERE provider_id = $1", ORG_NAME)
        if not org_id:
            org_id = await conn.fetchval("""
                INSERT INTO organizations (provider_id, created_at)
                VALUES ($1, $2) RETURNING id
            """, ORG_NAME, datetime.utcnow())
            print(f"   Org created: {org_id}")
        else: print(f"   Org exists: {org_id}")

        # 3. Link
        await conn.execute("""
            INSERT INTO organization_users (user_id, organization_id)
            VALUES ($1, $2) ON CONFLICT DO NOTHING
        """, user_id, org_id)
        await conn.execute("UPDATE users SET selected_organization_id = $1 WHERE id = $2", org_id, user_id)

        # 4. API Key
        await conn.execute("DELETE FROM api_keys WHERE organization_id = $1 AND name = $2", org_id, API_KEY_NAME)
        api_key, key_hash, prefix = generate_api_key()
        await conn.execute("""
            INSERT INTO api_keys (organization_id, name, key_hash, key_prefix, is_active, created_by, created_at)
            VALUES ($1, $2, $3, $4, $5, $6, $7)
        """, org_id, API_KEY_NAME, key_hash, prefix, True, user_id, datetime.utcnow())
        with open("key.txt", "w") as f: f.write(api_key)

        # 5. User Config
        await conn.execute("""
            INSERT INTO user_configurations (user_id, configuration)
            VALUES ($1, $2) ON CONFLICT DO NOTHING
        """, user_id, json.dumps({}))

        # 6. Telephony Config
        print(f"6. Configuring telephony...")
        telephony_config = {
            "provider": "twilio",
            "account_sid": TWILIO_SID,
            "auth_token": TWILIO_AUTH,
            "from_numbers": [TWILIO_PHONE]
        }
        await conn.execute("DELETE FROM organization_configurations WHERE organization_id = $1 AND key = $2", 
                         org_id, 'TELEPHONY_CONFIGURATION')
        await conn.execute("""
            INSERT INTO organization_configurations (organization_id, key, value, created_at)
            VALUES ($1, $2, $3, $4)
        """, org_id, 'TELEPHONY_CONFIGURATION', json.dumps(telephony_config), datetime.utcnow())

        # 7. Workflow, Definition & Trigger
        trigger_uuid = secrets.token_urlsafe(16)
        
        workflow_def_json = {
            "nodes": [
                {
                    "id": "1", 
                    "type": "trigger",
                    "position": {"x": 100, "y": 100}, 
                    "data": {
                        "label": "Start",
                        "trigger_path": trigger_uuid
                    }
                },
                {"id": "2", "type": "voice_llm", "position": {"x": 300, "y": 100}, "data": {
                    "label": "AI Agent", "prompt": "You are Vijay, a helpful sales agent. Qualify the lead for XOptimus."
                }}
            ],
            "edges": [{"id": "e1-2", "source": "1", "target": "2"}]
        }

        # Clear existing
        existing_workflows = await conn.fetch("SELECT id FROM workflows WHERE organization_id = $1 AND name = $2", org_id, WORKFLOW_NAME)
        for w in existing_workflows:
            await conn.execute("UPDATE workflows SET released_definition_id = NULL WHERE id = $1", w['id'])
            await conn.execute("DELETE FROM agent_triggers WHERE workflow_id = $1", w['id'])
            await conn.execute("DELETE FROM workflow_definitions WHERE workflow_id = $1", w['id'])
            await conn.execute("DELETE FROM workflows WHERE id = $1", w['id'])

        workflow_id = await conn.fetchval("""
            INSERT INTO workflows (
                name, organization_id, status, user_id, created_at, 
                workflow_definition, template_context_variables, 
                call_disposition_codes, workflow_configurations
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
            RETURNING id
        """, WORKFLOW_NAME, org_id, 'active', user_id, datetime.utcnow(), 
            json.dumps(workflow_def_json), json.dumps({}), json.dumps([]), json.dumps({}))

        definition_id = await conn.fetchval("""
            INSERT INTO workflow_definitions (
                workflow_id, workflow_json, is_current, status, 
                workflow_configurations, template_context_variables, 
                call_disposition_codes, created_at
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
            RETURNING id
        """, workflow_id, json.dumps(workflow_def_json), True, 'active', 
            json.dumps({}), json.dumps({}), json.dumps([]), datetime.utcnow())
        
        await conn.execute("UPDATE workflows SET released_definition_id = $1 WHERE id = $2", definition_id, workflow_id)

        await conn.execute("""
            INSERT INTO agent_triggers (workflow_id, organization_id, trigger_path, state, created_at)
            VALUES ($1, $2, $3, $4, $5)
        """, workflow_id, org_id, trigger_uuid, 'active', datetime.utcnow())

        print(f"\nSETUP COMPLETE")
        print(f"DOGRAH_API_KEY={api_key}")
        print(f"DOGRAH_WORKFLOW_ID={workflow_id}")
        print(f"DOGRAH_TRIGGER_UUID={trigger_uuid}")
        
        with open("config.json", "w") as f:
            json.dump({
                "DOGRAH_API_KEY": api_key,
                "DOGRAH_WORKFLOW_ID": str(workflow_id),
                "DOGRAH_TRIGGER_UUID": trigger_uuid,
                "DOGRAH_API_URL": "http://localhost:8000"
            }, f)
        
    except Exception as e:
        print(f"Error: {e}")
        import traceback; traceback.print_exc()
    finally:
        await conn.close()

if __name__ == '__main__':
    asyncio.run(setup_dograh())
