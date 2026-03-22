import asyncio
import json
from api.db import db_client

async def check():
    try:
        # Check user 1 configurations
        config = await db_client.get_user_configurations(1)
        print("--- USER CONFIGURATION ---")
        config_dict = {
            "llm": config.llm.model_dump() if config.llm else None,
            "stt": config.stt.model_dump() if config.stt else None,
            "tts": config.tts.model_dump() if config.tts else None,
        }
        print(json.dumps(config_dict, indent=2))
        
        # Check workflow 3 configurations
        workflow = await db_client.get_workflow(3)
        if workflow:
            print("\n--- WORKFLOW CONFIGURATION ---")
            print(json.dumps(workflow.workflow_configurations, indent=2))
            print("\n--- WORKFLOW DEFINITION PROVIDERS ---")
            # Look at the first node's services if any
            wd = workflow.workflow_definition_with_fallback
            print(json.dumps(wd.get("services", {}), indent=2))
        else:
            print("\nWorkflow 3 not found")
    except Exception as e:
        import traceback
        print(f"Error: {e}")
        traceback.print_exc()

asyncio.run(check())
