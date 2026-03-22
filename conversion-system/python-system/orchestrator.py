# ---------------------------------------------------------
# orchestrator.py
# Main loop orchestrating voice, SMS, email, and CRM
# Replaces router/orchestrator.js
# ---------------------------------------------------------
from __future__ import annotations

import asyncio
import json
import os
import signal
import subprocess
import sys
import time
from datetime import datetime, timezone
from pathlib import Path

from ai.sales_bot import generate_response
from core.config import (
    LEADS_FILE,
    NGROK_DOMAIN,
    NGROK_AUTHTOKEN,
    USE_DOGRAH_AI,
    TWILIO_WHATSAPP_FROM,
)
from core.file_io import read_json, write_json
from crm.crm_connector import check_connection, pull_new_leads
from email_module.email_engine import finalize_mail_events, process_inbound_queue as process_email_queue, send_email
from email_module.reply_monitor import monitor_inbox
from scoring.scoring_engine import calculate_score
from sms.sms_engine import run_smart_sms_batch
from sms.sms_queue_manager import finalize_sms_sessions, process_inbound_queue as process_sms_queue
from voice.voice_engine import dial_lead

# ---------------------------------------------------------
# SETUP & LOCKS
# ---------------------------------------------------------

LOCK_FILE = Path(__file__).resolve().parent / "orchestrator.lock"
VOICE_SERVER_PATH = Path(__file__).resolve().parent / "voice" / "call_server.py"
GATEWAY_SERVER_PATH = Path(__file__).resolve().parent / "gateway" / "server.py"
TRACKING_SERVER_PATH = Path(__file__).resolve().parent / "email_module" / "tracking_server.py"
MCP_SERVER_PATH = Path(__file__).resolve().parent / "ai" / "mcp_server.py"

subprocesses: list[subprocess.Popen] = []


def _cleanup() -> None:
    print("\n   🛑 ORCHESTRATOR SHUTDOWN INITIATED...")
    if LOCK_FILE.exists():
        try:
            LOCK_FILE.unlink()
            print("   🔒 Lock file removed.")
        except Exception as e:
            print(f"      ❌ Warning: failed to remove lock file: {e}")

    for p in subprocesses:
        try:
            print(f"   🔪 Killing process PID {p.pid}...")
            p.terminate()
            p.wait(timeout=3)
        except Exception:
            p.kill()

    print("   👋 All processes terminated. Goodbye.")
    sys.exit(0)


signal.signal(signal.SIGINT, lambda s, f: _cleanup())
signal.signal(signal.SIGTERM, lambda s, f: _cleanup())

if LOCK_FILE.exists():
    try:
        pid = int(LOCK_FILE.read_text(encoding="utf-8").strip())
        import psutil
        if psutil.pid_exists(pid):
            print(f"❌ Orchestrator already running (PID: {pid}). Exiting.")
            sys.exit(1)
        else:
            print("⚠️ Stale lock file found. Overwriting...")
    except Exception:
        pass

LOCK_FILE.write_text(str(os.getpid()), encoding="utf-8")


# ---------------------------------------------------------
# TIMELINE ENGINE
# ---------------------------------------------------------

TIMELINE_ACTIONS = [
    {"attempt": 1, "channel": "VOICE"},
    {"attempt": 2, "channel": "SMS"},
    {"attempt": 3, "channel": "VOICE"},
    {"attempt": 4, "channel": "EMAIL"},
    {"attempt": 5, "channel": "VOICE"},
    {"attempt": 6, "channel": "SMS"},
    {"attempt": 7, "channel": "VOICE"},
    {"attempt": 8, "channel": "EMAIL"},
    {"attempt": 9, "channel": "VOICE"},
    {"attempt": 10, "channel": "SMS"},
]


def _determine_action(attempt_count: int) -> str | None:
    for act in TIMELINE_ACTIONS:
        if act["attempt"] == attempt_count:
            return act["channel"]
    return None


def _check_graduation(lead: dict) -> bool:
    s = lead.get("status", "")
    return s in ("HUMAN_HANDOFF", "DO_NOT_CONTACT", "CALL_INTERESTED", "COLD_LEAD", "MAIL_COMPLETED")


# ---------------------------------------------------------
# WORKFLOW LOGIC
# ---------------------------------------------------------

async def _mark_action_complete(lead: dict) -> None:
    next_due = datetime.now().date().isoformat()
    # Add buffer days logic based on attempt
    attempt = lead.get("attempt_count", 0) + 1
    lead["attempt_count"] = attempt

    try:
        from datetime import timedelta
        buffer_days = 1 if attempt <= 3 else 2 if attempt <= 7 else 3
        lead["next_action_due"] = (datetime.now() + timedelta(days=buffer_days)).date().isoformat()
    except Exception:
        pass

    try:
        sc = calculate_score(lead, "WARM", lead.get("status", ""))
        lead["score"] = sc["score"]
        lead["category"] = sc["category"]
    except Exception:
        pass

    try:
        from crm.crm_connector import push_lead_update
        await push_lead_update(lead, {"status": lead["status"], "description": lead.get("last_call_summary", "")})
    except Exception:
        pass


async def process_post_call_actions() -> None:
    print("   🔄 Checking Post-Call Actions...")
    leads = read_json(LEADS_FILE, fallback=[])
    updated = False

    for lead in leads:
        if _check_graduation(lead):
            continue

        s = lead.get("status", "")
        if s == "CALL_NO_ANSWER":
            print(f"      📞 Hitting Voicemail/No-Answer Flow for {lead.get('name')}")
            lead["status"] = "SMS_IDLE"
            await _mark_action_complete(lead)
            updated = True
        elif s == "CALL_COMPLETED":
            print(f"      📞 Hitting Normal Follow-Up Flow for {lead.get('name')}")
            lead["status"] = "MAIL_IDLE"
            await _mark_action_complete(lead)
            updated = True

    if updated:
        write_json(LEADS_FILE, leads)


async def process_priority_sms_actions() -> None:
    print("   🚨 Checking Priority SMS Actions (Requested Calls/Callbacks)...")
    leads = read_json(LEADS_FILE, fallback=[])
    updated = False
    now = datetime.now(timezone.utc)

    for lead in leads:
        if _check_graduation(lead):
            continue

        s = lead.get("status", "")
        # Immediate Call Request
        if s == "SMS_TO_CALL_REQUESTED" or s == "MAIL_TO_CALL_REQUESTED":
            print(f"      🚨 Priority Override: Calling {lead.get('name')} immediately!")
            try:
                if USE_DOGRAH_AI:
                    from voice.dograh_client import DograhClient
                    from core.config import DOGRAH_TRIGGER_UUID
                    dc = DograhClient()
                    await dc.initiate_call(DOGRAH_TRIGGER_UUID, lead["phone"])
                    lead["status"] = "CALL_INITIATED"
                else:
                    sid = await dial_lead(lead)
                    if sid:
                        lead["status"] = "CALL_CONNECTED"
                await _mark_action_complete(lead)
            except Exception as e:
                print(f"         ❌ Call Failed: {e}")
                lead["status"] = "CALL_FAILED"
            updated = True

        # Scheduled Call
        elif s == "SMS_CALL_SCHEDULED" or s == "CALL_CALLBACK":
            # Just call if it's the next day
            diff = (now - datetime.fromisoformat(lead.get("last_interaction", now.isoformat()).replace("Z", "+00:00"))).total_seconds() / 3600
            if diff >= 24:
                print(f"      📅 Callback Due: Calling {lead.get('name')}!")
                try:
                    if USE_DOGRAH_AI:
                        from voice.dograh_client import DograhClient
                        from core.config import DOGRAH_TRIGGER_UUID
                        dc = DograhClient()
                        await dc.initiate_call(DOGRAH_TRIGGER_UUID, lead["phone"])
                        lead["status"] = "CALL_INITIATED"
                    else:
                        sid = await dial_lead(lead)
                        if sid:
                            lead["status"] = "CALL_CONNECTED"
                    await _mark_action_complete(lead)
                except Exception as e:
                    print(f"         ❌ Call Failed: {e}")
                    lead["status"] = "CALL_FAILED"
                updated = True

    if updated:
        write_json(LEADS_FILE, leads)


async def run_orchestrator() -> None:
    print("\n=======================================================")
    print("🤖 HIVERICKS AGENTIC ORCHESTRATOR STARTED (PYTHON_V2)")
    print("=======================================================")

    # 1. Start Servers
    print("\n[1] Starting Sub-Services...")
    python_exe = sys.executable
    
    # Ensure subprocesses can find 'core', 'ai', etc. by setting PYTHONPATH
    env = os.environ.copy()
    project_root = str(Path(__file__).resolve().parent)
    env["PYTHONPATH"] = project_root + os.pathsep + env.get("PYTHONPATH", "")

    voice_proc = subprocess.Popen([python_exe, "-m", "voice.call_server"], env=env, cwd=project_root)
    subprocesses.append(voice_proc)

    gateway_proc = subprocess.Popen([python_exe, "-m", "gateway.server"], env=env, cwd=project_root)
    subprocesses.append(gateway_proc)

    tracking_proc = subprocess.Popen([python_exe, "-m", "email_module.tracking_server"], env=env, cwd=project_root)
    subprocesses.append(tracking_proc)

    mcp_proc = subprocess.Popen([python_exe, "-m", "ai.mcp_server"], env=env, cwd=project_root)
    subprocesses.append(mcp_proc)

    # 2. Start Ngrok
    print("\n[2] Starting Ngrok Tunnel (Port 8082)...")
    
    try:
        from pyngrok import ngrok, process
        import traceback
        
        # Kill any dangling ngrok processes
        try:
            process.kill_process(ngrok.get_ngrok_path())
        except Exception:
            pass
        
        if NGROK_AUTHTOKEN:
            print(f"   🔑 Using provided Authtoken from .env")
            ngrok.set_auth_token(NGROK_AUTHTOKEN)
        else:
             print(f"   ⚠️ No NGROK_AUTHTOKEN found in .env. Random domains may fail if not authenticated.")
            
        conf = {}
        if NGROK_DOMAIN:
            print(f"   🌐 Attempting custom domain: {NGROK_DOMAIN}")
            conf["domain"] = NGROK_DOMAIN
            
        try:
            public_url = ngrok.connect(8082, **conf).public_url
        except Exception as e:
            print(f"   ⚠️ Ngrok custom domain failed: {e}")
            print(f"   🔄 Retrying with a random domain...")
            try:
                public_url = ngrok.connect(8082).public_url
            except Exception as e2:
                print(f"   ❌ Ngrok random domain also failed: {e2}")
                traceback.print_exc()
                raise e2
            
        os.environ["SERVER_URL"] = public_url
        print(f"   ✅ Webhooks online at {public_url}")
    except Exception as e:
        print(f"\n   🛑 CRITICAL NGROK ERROR: {e}")
        print("   👉 Twilio calls will FAIL because they cannot reach http://localhost:8082")
        print("   👉 PLEASE ADD 'NGROK_AUTHTOKEN=your_token' to your .env file!")
        os.environ["SERVER_URL"] = "http://localhost:8082"

    # 3. CRM Sync
    print("\n[3] Connecting to CRM Hub...")
    online = await check_connection()
    if online:
        await pull_new_leads()
    else:
        print("   ⚠️ CRM offline. Using local cache.")

    print("\n[4] Commencing Infinite Pulse Loop...")
    pulse_count = 0

    while True:
        pulse_count += 1
        print(f"\n────────────────── PULSE {pulse_count} ──────────────────")
        now_str = datetime.now(timezone.utc).isoformat()
        today = datetime.now().date().isoformat()

        # A. MAINTENANCE & PRIORITY
        await process_priority_sms_actions()
        await process_post_call_actions()
        await finalize_sms_sessions()
        await finalize_mail_events()
        await monitor_inbox()

        # B. QUEUE DRAINING
        sms_q = await process_sms_queue()
        mail_q = await process_email_queue()
        if sms_q > 0 or mail_q > 0:
            print(f"   ✅ REAL-TIME: Processed {sms_q} SMS, {mail_q} Emails")

        # C. BATCH PROCESSING (Every 5th pulse = ~2.5 mins)
        if pulse_count % 5 == 0:
            print(f"\n   [{now_str}] 🕰️ Running Major Batch Window...")
            was_online = await check_connection()
            if was_online:
                await pull_new_leads()

            leads = read_json(LEADS_FILE, fallback=[])
            updated = False

            for lead in leads:
                if _check_graduation(lead):
                    continue

                if lead.get("next_action_due", "2099-01-01") > today:
                    continue

                next_attempt = (lead.get("attempt_count", 0) or 0) + 1
                if next_attempt > 10:
                    print(f"   🏁 MAX ATTEMPTS REACHED: Graduating {lead.get('name')} to COLD_LEAD.")
                    lead["status"] = "COLD_LEAD"
                    updated = True
                    try:
                        from crm.crm_connector import push_lead_update
                        await push_lead_update(lead, {"status": "COLD_LEAD"})
                    except Exception:
                        pass
                    continue

                action = _determine_action(next_attempt)

                if action == "VOICE":
                    print(f"   📞 BATCH EXECUTING: VOICE on {lead.get('name')} (Attempt {next_attempt})")
                    try:
                        if USE_DOGRAH_AI:
                            from voice.dograh_client import DograhClient
                            from core.config import DOGRAH_TRIGGER_UUID
                            dc = DograhClient()
                            call_res = await dc.initiate_call(DOGRAH_TRIGGER_UUID, lead["phone"])
                            lead["status"] = "CALL_INITIATED"
                            # We don't wait block the loop. Status webhook/polling will handle it.
                        else:
                            sid = await dial_lead(lead)
                            if sid:
                                lead["status"] = "CALL_CONNECTED"
                        await _mark_action_complete(lead)
                        updated = True
                    except Exception as e:
                        print(f"      ❌ Batch Voice Failed: {e}")

                elif action == "SMS":
                    print(f"   💬 BATCH TRIGGERING: SMART SMS")
                    await run_smart_sms_batch([lead])
                    await _mark_action_complete(lead)
                    updated = True

                elif action == "EMAIL":
                    print(f"   📧 BATCH EXECUTING: EMAIL on {lead.get('name')} (Attempt {next_attempt})")
                    try:
                        from ai.memory import get_memory
                        mem = await get_memory(lead.get("phone") or lead.get("email"))
                        ai_res = await generate_response({
                            "userMessage": f"Write a follow up email to {lead.get('name')}.",
                            "mode": "EMAIL",
                            "memory": mem,
                        })
                        body = ai_res.get("response", "") if isinstance(ai_res, dict) else str(ai_res)
                        subj = "Follow up from Hivericks"
                        if "Subject:" in body:
                            parts = body.split("\n", 1)
                            subj = parts[0].replace("Subject:", "").strip()
                            body = parts[1].strip()

                        success = await send_email(lead, subj, body)
                        if success:
                            lead["status"] = "MAIL_SENT"
                            await _mark_action_complete(lead)
                            updated = True
                    except Exception as e:
                        print(f"      ❌ Batch Email Failed: {e}")

            if updated:
                write_json(LEADS_FILE, leads)
            print("   🕰️ Batch Window complete.")

        print("   💤 Resting for 10 seconds...")
        await asyncio.sleep(10)


if __name__ == "__main__":
    try:
        asyncio.run(run_orchestrator())
    except KeyboardInterrupt:
        _cleanup()
