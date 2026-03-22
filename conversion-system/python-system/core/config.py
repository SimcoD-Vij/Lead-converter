# ---------------------------------------------------------
# core/config.py
# Centralised configuration - replaces agent/config.js
# ---------------------------------------------------------
import os
from pathlib import Path
from dotenv import load_dotenv

# Load .env from conversion-system directory (one level up from python-system)
_ENV_PATH = Path(__file__).resolve().parents[2] / ".env"
load_dotenv(dotenv_path=_ENV_PATH)

# Ollama / AI
OLLAMA_URL: str = os.environ.get("OLLAMA_URL", "http://127.0.0.1:11434/api/chat")
OLLAMA_GENERATE_URL: str = OLLAMA_URL.replace("/chat", "/generate")
MODEL: str = "llama3.2:3b"
TIMEOUT_MS: int = 20_000  # milliseconds (used as seconds in httpx)
PORT: int = int(os.environ.get("PORT", "8082"))
MAX_PROMPT_TOKENS: int = 3500

# Paths (relative to conversion-system root)
_CS_ROOT = Path(__file__).resolve().parents[2]  # conversion-system/
PROCESSED_LEADS_DIR = _CS_ROOT / "processed_leads"
LEADS_FILE = PROCESSED_LEADS_DIR / "clean_leads.json"
EVENTS_FILE = PROCESSED_LEADS_DIR / "lead-events.json"
SMS_HISTORY_FILE = _CS_ROOT / "sms" / "sms_history.json"
SMS_QUEUE_FILE = _CS_ROOT / "sms" / "inbound_sms_queue.json"
ACTIVE_WINDOWS_FILE = _CS_ROOT / "sms" / "active_conversations.json"
EMAIL_QUEUE_FILE = _CS_ROOT / "email" / "inbound_email_queue.json"
MEMORY_FILE = _CS_ROOT / "agent" / "data" / "memory.json"
VOICE_CONVO_DIR = _CS_ROOT / "voice" / "voice_conversations"
CALL_LOGS_FILE = _CS_ROOT / "voice" / "call_logs.json"
SUMMARY_CALLS_FILE = _CS_ROOT / "voice" / "summary_calls.json"

# Twilio
TWILIO_SID: str = os.environ.get("TWILIO_SID", "")
TWILIO_AUTH: str = os.environ.get("TWILIO_AUTH", "")
TWILIO_PHONE: str = os.environ.get("TWILIO_PHONE", "+14155238886")
TWILIO_WHATSAPP_FROM: str = "whatsapp:+14155238886"

# Email
EMAIL_USER: str = os.environ.get("EMAIL_USER", "")
EMAIL_PASS: str = os.environ.get("EMAIL_PASS", "")
TRACKING_DOMAIN: str = os.environ.get("TRACKING_DOMAIN", "http://localhost:5000")

# CRM
_crm_pub = os.environ.get("CRM_PUBLIC_URL", "")
CRM_BASE_URL: str = (
    _crm_pub.rstrip("/") + "/api" if _crm_pub else "https://e32376a97ce7.ngrok-free.app/api"
)

# Voice / Server
SERVER_URL: str = os.environ.get("SERVER_URL", "")
USE_DOGRAH_AI: bool = os.environ.get("USE_DOGRAH_AI", "false").lower() == "true"
DOGRAH_API_URL: str = os.environ.get("DOGRAH_API_URL", "http://localhost:8000")
DOGRAH_API_KEY: str = os.environ.get("DOGRAH_API_KEY", "")
DOGRAH_TRIGGER_UUID: str = os.environ.get("DOGRAH_TRIGGER_UUID", "")
DOGRAH_WORKFLOW_ID: str = os.environ.get("DOGRAH_WORKFLOW_ID", "")

# MinIO (Dograh artifacts)
MINIO_ENDPOINT: str = os.environ.get("MINIO_ENDPOINT", "localhost")
MINIO_PORT: int = int(os.environ.get("MINIO_PORT", "9000"))
MINIO_USE_SSL: bool = os.environ.get("MINIO_USE_SSL", "false").lower() == "true"
MINIO_ACCESS_KEY: str = os.environ.get("MINIO_ACCESS_KEY", "minioadmin")
MINIO_SECRET_KEY: str = os.environ.get("MINIO_SECRET_KEY", "minioadmin")
MINIO_BUCKET: str = os.environ.get("MINIO_BUCKET", "voice-audio")

# Misc
ABSTRACT_API_KEY: str = os.environ.get("ABSTRACT_API_KEY", "")
NGROK_DOMAIN: str = os.environ.get(
    "NGROK_DOMAIN", "oretha-geniculate-addictedly.ngrok-free.dev"
)
NGROK_AUTHTOKEN: str = os.environ.get("NGROK_AUTHTOKEN", "")
