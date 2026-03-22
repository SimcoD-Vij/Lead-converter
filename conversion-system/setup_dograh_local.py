"""
Dograh Local Setup Script
Automatically creates user, organization, API key, and workflow in local Dograh instance
"""

import asyncio
import asyncpg
import hashlib
import secrets
from datetime import datetime

# Database connection settings (from docker-compose.yaml)
DB_CONFIG = {
    'host': 'localhost',
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


def generate_api_key():
    """Generate a Dograh-style API key"""
    random_bytes = secrets.token_bytes(32)
    key = f"dgr_{secrets.token_urlsafe(40)}"
    key_hash = hashlib.sha256(key.encode()).hexdigest()
    prefix = key[:11]  # dgr_xxxxxxx
    return key, key_hash, prefix


async def setup_dograh():
    """Set up Dograh with user, org, and workflow"""
    
    print("🚀 Starting Dograh Local Setup...")
    
    # Connect to database
    conn = await asyncpg.connect(**DB_CONFIG)
    
    try:
        # 1. Create or get user
        print(f"\n1️⃣ Creating user: {USER_EMAIL}")
        user = await conn.fetchrow("""
            INSERT INTO users (provider_id, email, is_superuser, created_at)
            VALUES ($1, $2, $3, $4)
            ON CONFLICT (provider_id) DO UPDATE SET email = EXCLUDED.email
            RETURNING id, provider_id, email
        """, USER_EMAIL, USER_EMAIL, True, datetime.utcnow())
        
        user_id = user['id']
        print(f"   ✅ User created: ID={user_id}, Email={user['email']}")
        
        # 2. Create organization
        print(f"\n2️⃣ Creating organization: {ORG_NAME}")
        org = await conn.fetchrow("""
            INSERT INTO organizations (name, created_by, created_at)
            VALUES ($1, $2, $3)
            ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name
            RETURNING id, name
        """, ORG_NAME, user_id, datetime.utcnow())
        
        org_id = org['id']
        print(f"   ✅ Organization created: ID={org_id}, Name={org['name']}")
        
        # 3. Link user to organization
        print(f"\n3️⃣ Linking user to organization...")
        await conn.execute("""
            INSERT INTO user_organizations (user_id, organization_id, role, created_at)
            VALUES ($1, $2, $3, $4)
            ON CONFLICT (user_id, organization_id) DO NOTHING
        """, user_id, org_id, 'admin', datetime.utcnow())
        
        # Update user's selected organization
        await conn.execute("""
            UPDATE users SET selected_organization_id = $1 WHERE id = $2
        """, org_id, user_id)
        
        print(f"   ✅ User linked to organization")
        
        # 4. Create API key
        print(f"\n4️⃣ Creating API key: {API_KEY_NAME}")
        api_key, key_hash, prefix = generate_api_key()
        
        api_key_record = await conn.fetchrow("""
            INSERT INTO api_keys (
                organization_id, name, key_hash, key_prefix, 
                is_active, created_by, created_at
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7)
            ON CONFLICT (key_hash) DO UPDATE SET name = EXCLUDED.name
            RETURNING id, name, key_prefix
        """, org_id, API_KEY_NAME, key_hash, prefix, True, user_id, datetime.utcnow())
        
        print(f"   ✅ API Key created: {api_key}")
        print(f"   📋 Save this key - you won't see it again!")
        
        # 5. Create user configuration (for free services)
        print(f"\n5️⃣ Creating user configuration...")
        await conn.execute("""
            INSERT INTO user_configurations (user_id, created_at, updated_at)
            VALUES ($1, $2, $3)
            ON CONFLICT (user_id) DO NOTHING
        """, user_id, datetime.utcnow(), datetime.utcnow())
        
        print(f"   ✅ User configuration created")
        
        # 6. Create workflow
        print(f"\n6️⃣ Creating workflow: {WORKFLOW_NAME}")
        
        # Simple outbound workflow definition
        workflow_def = {
            "nodes": [
                {
                    "id": "1",
                    "type": "start",
                    "position": {"x": 100, "y": 100},
                    "data": {"label": "Start"}
                },
                {
                    "id": "2",
                    "type": "llm",
                    "position": {"x": 300, "y": 100},
                    "data": {
                        "label": "AI Agent",
                        "prompt": "You are a professional sales agent. Your goal is to qualify leads and schedule appointments."
                    }
                }
            ],
            "edges": [
                {
                    "id": "e1-2",
                    "source": "1",
                    "target": "2"
                }
            ]
        }
        
        workflow = await conn.fetchrow("""
            INSERT INTO workflows (
                name, organization_id, status, created_by, created_at
            )
            VALUES ($1, $2, $3, $4, $5)
            RETURNING id, name
        """, WORKFLOW_NAME, org_id, 'active', user_id, datetime.utcnow())
        
        workflow_id = workflow['id']
        print(f"   ✅ Workflow created: ID={workflow_id}, Name={workflow['name']}")
        
        # 7. Summary
        print(f"\n{'='*60}")
        print(f"✅ DOGRAH SETUP COMPLETE!")
        print(f"{'='*60}")
        print(f"\n📝 Configuration for your .env file:")
        print(f"\nUSE_DOGRAH_AI=true")
        print(f"DOGRAH_API_URL=http://localhost:8000")
        print(f"DOGRAH_AGENT_ID={workflow_id}")
        print(f"DOGRAH_API_KEY={api_key}")
        print(f"\n{'='*60}")
        print(f"\n🌐 Access Dograh UI:")
        print(f"   URL: http://localhost:3010")
        print(f"   Email: {USER_EMAIL}")
        print(f"   (No password needed for local setup)")
        print(f"\n{'='*60}")
        
        return {
            'user_id': user_id,
            'org_id': org_id,
            'workflow_id': workflow_id,
            'api_key': api_key
        }
        
    except Exception as e:
        print(f"\n❌ Error: {e}")
        raise
    finally:
        await conn.close()


if __name__ == '__main__':
    asyncio.run(setup_dograh())
