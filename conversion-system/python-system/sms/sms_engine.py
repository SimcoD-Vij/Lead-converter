# ---------------------------------------------------------
# sms/sms_engine.py
# WhatsApp/SMS sending via Twilio - replaces sms/sms_engine.js
# ---------------------------------------------------------
from __future__ import annotations

import json
from datetime import datetime, timezone
from pathlib import Path

from twilio.rest import Client as TwilioClient

from ai.memory import get_memory, upsert_memory
from ai.sales_bot import generate_response
from core.config import (
    LEADS_FILE,
    SMS_HISTORY_FILE,
    TWILIO_AUTH,
    TWILIO_SID,
    TWILIO_WHATSAPP_FROM,
)
from core.file_io import read_json, write_json

_twilio_client: TwilioClient | None = None


def _get_client() -> TwilioClient:
    global _twilio_client
    if _twilio_client is None:
        _twilio_client = TwilioClient(TWILIO_SID, TWILIO_AUTH)
    return _twilio_client


def get_leads() -> list[dict]:
    if not LEADS_FILE.exists():
        return []
    return read_json(LEADS_FILE, fallback=[])


def save_leads(leads: list[dict]) -> None:
    write_json(LEADS_FILE, leads)


def is_valid_mobile(lead: dict) -> bool:
    phone = lead.get("phone") or ""
    cleaned = "".join(c for c in phone if c.isdigit())
    return len(cleaned) >= 10


def log_sms_session(lead_id: str, role: str, content: str) -> None:
    """
    Appends a message turn to sms_history.json.
    Equivalent to logSmsSession() in sms_engine.js
    """
    history: dict = {}
    if SMS_HISTORY_FILE.exists():
        try:
            history = json.loads(SMS_HISTORY_FILE.read_text(encoding="utf-8"))
        except Exception:
            pass

    normalized_id = lead_id.replace("whatsapp:", "")
    ts = datetime.now(timezone.utc).isoformat()

    if normalized_id not in history:
        history[normalized_id] = {"session_start": ts, "messages": []}
    elif "messages" not in history[normalized_id]:
        history[normalized_id]["messages"] = []

    history[normalized_id]["messages"].append({"role": role, "content": content, "timestamp": ts})
    history[normalized_id]["last_interaction"] = ts

    SMS_HISTORY_FILE.parent.mkdir(parents=True, exist_ok=True)
    SMS_HISTORY_FILE.write_text(json.dumps(history, indent=2), encoding="utf-8")


def is_sms_due(lead: dict) -> dict[str, bool | str]:
    """
    Checks whether this lead is due for an outbound SMS today.
    Equivalent to isSmsDue() in sms_engine.js
    """
    today = datetime.now().date().isoformat()

    if not is_valid_mobile(lead):
        return {"due": False, "reason": "Invalid Phone Number"}

    skip_statuses = {"DO_NOT_CONTACT", "COLD_LEAD", "SMS_TO_CALL_REQUESTED", "SMS_CALL_SCHEDULED"}
    if lead.get("status") in skip_statuses:
        return {"due": False, "reason": f"Status is {lead.get('status')}"}

    next_due = lead.get("next_action_due")
    if not next_due or next_due > today:
        return {"due": False, "reason": f"Not due until {next_due}"}

    attempt = lead.get("attempt_count", 0) or 0
    if attempt % 2 != 0:
        return {"due": True, "reason": "Timeline matches Messaging"}
    return {"due": False, "reason": f"Attempt {attempt} is reserved for VOICE"}


async def send_sms(to: str, body: str, log: bool = True) -> object:
    """
    Sends a WhatsApp message via Twilio.
    Equivalent to sendSms() in sms_engine.js
    """
    from_num = TWILIO_WHATSAPP_FROM
    to_num = to if to.startswith("whatsapp:") else f"whatsapp:{to}"

    client = _get_client()
    result = client.messages.create(body=body, from_=from_num, to=to_num)

    if log:
        log_sms_session(to, "assistant", body)
    return result


async def run_smart_sms_batch(forced_leads: list[dict] | None = None) -> None:
    """
    Processes outbound SMS for all eligible leads.
    Equivalent to runSmartSmsBatch() in sms_engine.js
    """
    print("\n🚀 STARTING SMART WHATSAPP BATCH...")
    print("-------------------------------------------------")

    leads = forced_leads if forced_leads is not None else get_leads()
    print(f"📂 Loaded {len(leads)} leads (Source: {'Orchestrator' if forced_leads else 'Database'}).")

    processed_count = 0

    for lead in leads:
        if not is_valid_mobile(lead):
            continue

        check = {"due": True, "reason": "Orchestrator Override"} if forced_leads is not None else is_sms_due(lead)
        lead_id = lead["phone"]
        name = (lead.get("name") or "Friend").split()[0]

        if check["due"]:
            print(f"\n👉 PROCESSING: {lead.get('name')} ({lead_id})")
            print(f"   ✅ Check Passed: {check['reason']}")

            try:
                memory = await get_memory(lead_id)

                prompt = f"INITIATE_CONVERSATION: Hi {name}."
                if (lead.get("attempt_count") or 0) > 1:
                    prompt = f"FOLLOW_UP_CONVERSATION: Hi {name}, checking in again."

                ai_response = await generate_response({
                    "userMessage": prompt,
                    "memory": memory,
                    "mode": "SMS_CHAT",
                })
                ai_body: str = ai_response.get("response", "") if isinstance(ai_response, dict) else str(ai_response)

                print(f'   🤖 AI Generated: "{ai_body}"')
                print("   📤 Sending via WhatsApp...")
                await send_sms(lead_id, ai_body)
                print("   ✅ Message Sent to Twilio API")

                log_sms_session(lead_id, "assistant", ai_body)
                await upsert_memory(lead_id, {"last_bot_message": ai_body})

                # CRM sync
                try:
                    from crm.crm_connector import push_interaction_to_stream
                    await push_interaction_to_stream(lead, "sms", {
                        "summary": "Outbound WhatsApp Message",
                        "intent": "follow_up",
                        "content": ai_body,
                    })
                except Exception:
                    pass

                lead["status"] = "SMS_SENT"
                lead["last_sms_time"] = datetime.now(timezone.utc).isoformat()
                print("   💾 Lead Status Updated: SMS_SENT")
                processed_count += 1

            except Exception as error:
                print(f"   ❌ Failed: {error}")

    save_leads(leads)
    print("-------------------------------------------------")
    print(f"🏁 BATCH COMPLETE. Sent WhatsApp to {processed_count} leads.\n")
