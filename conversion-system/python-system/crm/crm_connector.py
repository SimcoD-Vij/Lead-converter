# ---------------------------------------------------------
# crm/crm_connector.py
# EspoCRM integration - replaces agent/crm_connector.js
# ---------------------------------------------------------
from __future__ import annotations

import base64
import json
from datetime import datetime, timezone
from typing import Any

import httpx

from core.config import CRM_BASE_URL, LEADS_FILE
from core.file_io import read_json, write_json


def _auth_header() -> dict[str, str]:
    """Basic Auth header for EspoCRM admin user."""
    token = base64.b64encode(b"admin:admin").decode()
    return {"Authorization": f"Basic {token}"}


def _map_lead_status(status: str | None) -> str:
    if not status:
        return "New"
    mappings = {
        "CALL_IDLE": "New",
        "CALL_CONNECTED": "In Process",
        "CALL_INTERESTED": "In Process",
        "CALL_NOT_INTERESTED": "Recycled",
        "CALL_COMPLETED": "In Process",
        "SMS_IDLE": "New",
        "SMS_SENT": "In Process",
        "NEW_INBOUND": "New",
    }
    return mappings.get(status, "Assigned")


async def sync_lead(lead: dict) -> str | None:
    """
    Ensures the lead exists on the CRM server and returns its server ID.
    Equivalent to syncLead() in crm_connector.js
    """
    if not CRM_BASE_URL:
        return None
    headers = _auth_header()

    # 1. Verify by existing lead_id
    if lead.get("lead_id"):
        try:
            async with httpx.AsyncClient(timeout=5) as client:
                r = await client.get(f"{CRM_BASE_URL}/v1/Lead/{lead['lead_id']}", headers=headers)
            if r.status_code == 200:
                return lead["lead_id"]
        except Exception:
            pass

    # 2. Search by phone / email
    try:
        params: dict[str, Any] = {"select": "id", "limit": 1}
        if lead.get("phone"):
            raw_phone = lead["phone"].replace("+", "")
            params["where[0][type]"] = "in"
            params["where[0][attribute]"] = "phoneNumber"
            params["where[0][value][]"] = [lead["phone"], raw_phone]
        elif lead.get("email"):
            params["where[0][type]"] = "equals"
            params["where[0][attribute]"] = "emailAddress"
            params["where[0][value]"] = lead["email"]

        async with httpx.AsyncClient(timeout=5) as client:
            r = await client.get(f"{CRM_BASE_URL}/v1/Lead", headers=headers, params=params)
        data = r.json()
        if data.get("list"):
            new_id = data["list"][0]["id"]
            print(f"   🔄 CRM Sync: Found lead {lead.get('name', lead.get('phone'))} with ID: {new_id}")
            lead["lead_id"] = new_id
            return new_id
    except Exception as e:
        print(f"   ⚠️ CRM Sync Search Failed: {e}")

    # 3. Create if not found
    try:
        payload: dict[str, Any] = {
            "lastName": lead.get("name") or lead.get("phone") or "Unknown Lead",
            "phoneNumber": lead.get("phone"),
            "source": "Other",
        }
        if lead.get("email"):
            payload["emailAddress"] = lead["email"]
        name = lead.get("name", "")
        if name and " " in name:
            parts = name.split(" ", 1)
            payload["firstName"] = parts[0]
            payload["lastName"] = parts[1]

        async with httpx.AsyncClient(timeout=5) as client:
            r = await client.post(f"{CRM_BASE_URL}/v1/Lead", json=payload, headers=headers)
        new_id = r.json().get("id")
        print(f"   📥 CRM Sync: Created lead {lead.get('name', lead.get('phone'))}. ID: {new_id}")
        lead["lead_id"] = new_id
        return new_id
    except Exception as e:
        print(f"   ❌ CRM Sync Create Failed: {e}")
        return None


async def push_unified_event(lead: dict, event_type: str, data: dict) -> None:
    """
    Pushes any CRM event.
    Equivalent to pushUnifiedEvent() in crm_connector.js
    """
    if not CRM_BASE_URL:
        return

    server_id = await sync_lead(lead)
    if not server_id:
        print(f"   ⚠️ CRM Push Skipped: Could not sync lead {lead.get('name')}")
        return

    if "parentId" in data:
        data["parentId"] = server_id
    if "leadId" in data:
        data["leadId"] = server_id

    ENTITY_CONFIG = {
        "LEAD_UPDATE": {"endpoint": f"/v1/Lead/{server_id}", "method": "PUT", "entity": "Lead"},
        "TASK_LOG": {"endpoint": "/v1/Task", "method": "POST", "entity": "Task"},
        "OPPORTUNITY": {"endpoint": "/v1/Opportunity", "method": "POST", "entity": "Opportunity"},
        "CASE": {"endpoint": "/v1/Case", "method": "POST", "entity": "Case"},
        "MEETING": {"endpoint": "/v1/Meeting", "method": "POST", "entity": "Meeting"},
        "NOTE": {"endpoint": "/v1/Note", "method": "POST", "entity": "Note"},
    }

    config = ENTITY_CONFIG.get(event_type)
    if not config:
        print(f"   ❌ CRM Error: Unsupported event type: {event_type}")
        return

    endpoint = config["endpoint"].rstrip("/")
    url = f"{CRM_BASE_URL}{endpoint}"
    headers = {**_auth_header(), "Content-Type": "application/json", "X-Event-Type": event_type}

    # Sanitise payload
    if data.get("status") and config["entity"] == "Lead":
        data["status"] = _map_lead_status(data["status"])
    if data.get("status") and config["entity"] == "Task" and data["status"] == "Held":
        data["status"] = "Completed"
    if data.get("description") and isinstance(data["description"], str):
        try:
            parsed = json.loads(data["description"])
            if parsed.get("text_summary"):
                data["description"] = parsed["text_summary"]
        except (json.JSONDecodeError, TypeError):
            pass

    try:
        async with httpx.AsyncClient(timeout=10) as client:
            await client.request(config["method"], url, json=data, headers=headers)
    except Exception as error:
        print(f"   ❌ CRM Push Failed [{event_type}]: {error}")


async def push_lead_update(lead: dict, data: dict) -> None:
    await push_unified_event(lead, "LEAD_UPDATE", data)


async def _get_admin_user_id() -> str | None:
    try:
        headers = _auth_header()
        params = {
            "select": "id",
            "where[0][type]": "equals",
            "where[0][attribute]": "userName",
            "where[0][value]": "admin",
        }
        async with httpx.AsyncClient(timeout=5) as client:
            r = await client.get(f"{CRM_BASE_URL}/v1/User", headers=headers, params=params)
        items = r.json().get("list", [])
        return items[0]["id"] if items else None
    except Exception:
        return None


async def push_call_log(lead: dict, data: dict) -> None:
    admin_id = await _get_admin_user_id()
    payload = {
        "name": f"Call with {lead.get('name') or lead.get('phone')}",
        "parentType": "Lead",
        "parentId": lead.get("lead_id") or lead.get("id"),
        "status": "Held",
        "direction": "Outbound",
        "dateStart": datetime.now(timezone.utc).isoformat()[:19].replace("T", " "),
        "duration": data.get("duration", 60),
        "description": data.get("summary", "No summary provided."),
        "assignedUserId": admin_id,
    }
    await push_unified_event(lead, "TASK_LOG", payload)


async def push_opportunity(lead: dict) -> None:
    payload = {
        "name": f"Opportunity for {lead.get('name') or lead.get('phone')}",
        "leadId": lead.get("lead_id") or lead.get("id"),
        "stage": "Prospecting",
        "amount": 1499,
        "probability": 50,
    }
    await push_unified_event(lead, "OPPORTUNITY", payload)


async def push_case(lead: dict, description: str = "") -> None:
    payload = {
        "name": f"Support Case: {lead.get('name') or lead.get('phone')}",
        "parentId": lead.get("lead_id") or lead.get("id"),
        "parentType": "Lead",
        "description": description or "User requested assistance.",
    }
    await push_unified_event(lead, "CASE", payload)


async def push_meeting(lead: dict, date_start: str | None = None) -> None:
    payload = {
        "name": f"Meeting with {lead.get('name') or lead.get('phone')}",
        "parentId": lead.get("lead_id") or lead.get("id"),
        "parentType": "Lead",
        "dateStart": date_start or datetime.now(timezone.utc).isoformat(),
        "duration": 1800,
    }
    await push_unified_event(lead, "MEETING", payload)


async def pull_new_leads() -> int:
    """
    Pulls new leads from CRM and appends to clean_leads.json.
    Equivalent to pullNewLeads() in crm_connector.js
    """
    if not CRM_BASE_URL:
        return 0
    try:
        headers = _auth_header()
        params = {
            "where[0][type]": "equals",
            "where[0][attribute]": "status",
            "where[0][value]": "New",
            "select": "id,firstName,lastName,phoneNumber,emailAddress,description",
        }
        async with httpx.AsyncClient(timeout=10) as client:
            r = await client.get(f"{CRM_BASE_URL}/v1/Lead", headers=headers, params=params)
        crm_leads = r.json().get("list", [])
        if not crm_leads:
            return 0

        local_leads = read_json(LEADS_FILE, fallback=[])
        added = 0

        for cl in crm_leads:
            phone = cl.get("phoneNumber")
            if phone and not any(l.get("phone") == phone for l in local_leads):
                local_leads.append({
                    "lead_id": cl["id"],
                    "name": f"{cl.get('firstName', '')} {cl.get('lastName', '')}".strip(),
                    "phone": phone,
                    "email": cl.get("emailAddress"),
                    "status": "SMS_IDLE",
                    "source": "CRM_IMPORT",
                    "score": 50,
                    "imported_at": datetime.now(timezone.utc).isoformat(),
                })
                added += 1

        if added:
            write_json(LEADS_FILE, local_leads)
            print(f"   📥 CRM: Imported {added} new leads.")
        return added
    except Exception as e:
        print(f"   ❌ CRM Pull Failed: {e}")
        return 0


async def push_interaction_to_stream(lead: dict, channel: str, data: dict) -> None:
    """
    Posts a stream note on the lead's CRM timeline.
    Equivalent to pushInteractionToStream() in crm_connector.js
    """
    if not CRM_BASE_URL:
        return

    timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    conversation = data.get("conversation", [])
    convo_text = "\n".join(
        f"{m.get('role', '').upper()}: {m.get('message', '')}" for m in conversation
    ) or "No transcript available."

    content = (
        f"[{channel.upper()} INTERACTION - {timestamp}]\n"
        f"--------------------------------------------------\n"
        f"SUMMARY: {data.get('summary', 'N/A')}\n"
        f"INTENT: {data.get('intent', 'N/A')}\n"
        f"--------------------------------------------------\n"
        f"CONTENT / TRANSCRIPT:\n"
        f"{data.get('transcription') or data.get('content') or convo_text}\n"
        f"--------------------------------------------------\n"
        f"NEXT STEP / REPLY: {data.get('nextPrompt') or data.get('next_action', 'N/A')}\n"
        f"--------------------------------------------------"
    ).strip()

    payload: dict[str, Any] = {
        "post": content,
        "parentId": lead.get("lead_id") or lead.get("id"),
        "parentType": "Lead",
        "type": "Post",
    }

    if not payload.get("parentId") and lead.get("email"):
        try:
            headers = _auth_header()
            params = {
                "select": "id",
                "where[0][type]": "equals",
                "where[0][attribute]": "emailAddress",
                "where[0][value]": lead["email"],
            }
            async with httpx.AsyncClient(timeout=5) as client:
                r = await client.get(f"{CRM_BASE_URL}/v1/Lead", headers=headers, params=params)
            items = r.json().get("list", [])
            if items:
                payload["parentId"] = items[0]["id"]
        except Exception:
            pass

    if not payload.get("parentId"):
        return

    try:
        await push_unified_event(lead, "NOTE", payload)
        print(f"   📝 CRM: Logged {channel.upper()} interaction for {lead.get('email') or lead.get('phone')}")
    except Exception as error:
        print(f"   ❌ CRM: Stream Logging Failed: {error}")


async def check_connection() -> bool:
    """Pings CRM metadata endpoint to verify connectivity."""
    print(f"🔌 CRM: Checking Connectivity to {CRM_BASE_URL}... ", end="", flush=True)
    try:
        headers = _auth_header()
        async with httpx.AsyncClient(timeout=3) as client:
            await client.get(f"{CRM_BASE_URL}/v1/Metadata", headers=headers, params={"select": "scopes"})
        print("✅ ONLINE")
        return True
    except Exception:
        print("⚠️ OFFLINE")
        return False
