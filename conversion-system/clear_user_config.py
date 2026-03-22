import asyncio
import json
from api.db import db_client

async def clear():
    # Reset user configuration so Dograh auto-generates fresh service keys
    import asyncpg
    conn = await asyncpg.connect("postgresql://postgres:postgres@localhost:5432/dograh")
    
    # Remove llm/stt/tts from configuration so they get regenerated
    result = await conn.execute("""
        UPDATE user_configurations 
        SET configuration = configuration 
            - 'llm' 
            - 'stt' 
            - 'tts'
        WHERE user_id = 1
    """)
    print(f"Updated: {result}")
    
    # Show current config
    row = await conn.fetchrow("SELECT configuration FROM user_configurations WHERE user_id = 1")
    print(f"Config now: {row['configuration']}")
    
    await conn.close()

asyncio.run(clear())
