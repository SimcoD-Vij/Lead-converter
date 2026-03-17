# Hivericks Sales Conversion System

> AI-powered multi-channel sales agent that automatically calls, texts, and emails leads to sell the **XOptimus Smart Charger (₹1499)**.
> The agent's name is **Vijay** — a conversational AI product consultant.

---

## Quick Overview

| What | How |
|------|-----|
| Voice Calls | Twilio + Dograh AI |
| WhatsApp/SMS | Twilio WhatsApp API |
| Email | Nodemailer (Gmail) |
| AI Brain | Ollama `llama3.2:1b` (local) |
| CRM Sync | EspoCRM REST API |
| Lead Scoring | Custom 0–100 algorithm |

---

## How the System Works

```
Every 30 seconds, the Orchestrator runs a pulse:

1. Pull new leads from CRM
2. Decide what to do for each lead (SMS / Email / Voice)
3. Execute actions — AI generates all messages & responses
4. Sync every interaction back to CRM
```

**Engagement Timeline (per lead):**

| Attempt | Day | Action |
|---------|-----|--------|
| 0 | Day 1 | SMS + Email |
| 1 | Day 2 | SMS + Email |
| 2 | Day 3 | **Voice Call** |
| 3 | Day 5 | SMS + Email |
| 4 | Day 7 | **Voice Call** |
| 5 | Day 10 | SMS + Email |
| 6 | Day 14 | **Voice Call** |

After 6+ attempts with score ≥ 50 → promoted to **Human Handoff**.

---

## System Architecture

```
┌──────────────────────────────────────────────────────┐
│              router/orchestrator.js                   │
│         Master Loop (runs every 30 seconds)          │
└───────────┬─────────────────┬────────────┬───────────┘
            │                 │            │
    ┌───────▼──────┐  ┌───────▼──────┐  ┌─▼────────────┐
    │  sms_engine  │  │ email_engine │  │  call_server  │
    │  WhatsApp    │  │   Gmail      │  │  Twilio Voice │
    └───────┬──────┘  └───────┬──────┘  └─┬────────────┘
            │                 │            │
            └────────┬────────┘            │
                     ▼                     ▼
            ┌────────────────┐    ┌────────────────┐
            │  agent/        │    │  dograh_client │
            │  salesBot.js   │    │  (Dograh AI)   │
            │  (Ollama LLM)  │    └────────────────┘
            └───────┬────────┘
                    ▼
            ┌────────────────┐
            │ crm_connector  │
            │  (EspoCRM API) │
            └────────────────┘

External webhook entry point → gateway/server.js (Port 8082)
```

---

## Files — What Each One Does

### `router/`

#### `orchestrator.js` — The Master Brain
- Runs every 30 seconds
- Decides what action to take for every lead
- Launches voice server, gateway, and ngrok tunnel as child processes
- Handles post-call follow-up (sends SMS + Email after every voice call)
- Pushes all actions to CRM

---

### `agent/`

#### `salesBot.js` — Vijay's Personality & Responses
- Powered by Ollama (`llama3.2:1b`)
- Uses **hard template overrides** for exits ("busy", "later" → offers WhatsApp, hangs up)
- Uses **keyword detection** before hitting the LLM (price, safety, compatibility)
- Generates call summaries, follow-up WhatsApp messages, and follow-up emails

Key behaviours:
- 1st "not interested" → one gentle probe
- 2nd "not interested" → thank and end call `[HANGUP]`
- "busy / call later" → offer WhatsApp details → hang up
- Price question → always answers "₹1499" directly

#### `crm_connector.js` — CRM Sync
- Finds or creates leads in EspoCRM by phone/email
- Pushes: call logs, notes, opportunities, meetings, status updates
- Pulls new leads from CRM into local queue each cycle

| CRM Action | API Call |
|------------|----------|
| Update lead | `PUT /v1/Lead/:id` |
| Log a call | `POST /v1/Task` |
| Log interest | `POST /v1/Opportunity` |
| Schedule meeting | `POST /v1/Meeting` |
| Add note/transcript | `POST /v1/Note` |

#### `memory.js` — Conversation Memory
- Stores per-lead history in JSON files
- Used by SMS & Email to maintain context across sessions

#### `config.js` — Ollama Settings
```
OLLAMA_URL = http://localhost:11434/api/generate
MODEL      = llama3.2:1b
```

#### `voice_utils.js` — SSML helper
- Converts plain text to SSML markup for Amazon Polly (natural speech)

---

### `voice/`

#### `call_server.js` — Twilio Voice Server (Port 3000)
- Handles all incoming Twilio voice webhooks
- Uses a **filler text trick** to mask AI latency:
  ```
  User speaks → filler plays ("Let me check that...") 
             → AI generates response in background 
             → redirect to deliver actual answer
  ```
- On call end: generates summary, scores lead, pushes to CRM

#### `dograh_client.js` — Dograh AI Client
- Full API wrapper for the Dograh voice platform
- Initiates calls, polls for completion, downloads transcripts from MinIO

#### `voice_engine.js` — Twilio Dialer
- `dialLead(lead)` — dials a lead via Twilio Programmable Voice (when not using Dograh)

---

### `sms/`

#### `sms_engine.js` — WhatsApp Sender
- Generates AI-personalised messages using `salesBot.js`
- Sends via Twilio WhatsApp sandbox
- Logs sessions to `sms_history.json`

#### `sms_queue_manager.js` — Inbound Reply Handler
- Reads inbound WhatsApp replies from the queue
- Generates AI replies and sends them back
- Detects "call me" intent → updates lead to `SMS_TO_CALL_REQUESTED`

---

### `email/`

#### `email_engine.js` — Email Engine
- Sends drip emails via Gmail (Nodemailer)
- Embeds a **tracking pixel** to detect opens
- Processes inbound replies: strips quoted history, generates AI reply, sends it
- Detects "call me" in replies → escalates lead to voice

#### `email_events.js` — Email Thread Tracker
- Opens, logs, and closes email interaction threads
- Stale threads (>24h with no reply) get summarised by AI and closed

#### `reply_monitor.js` — Gmail IMAP Watcher
- Monitors Gmail inbox for inbound replies
- Queues them for `email_engine.js` to process

---

### `scoring/`

#### `scoring_engine.js` — Lead Scoring (0–100)

| Component | Weight | Details |
|-----------|--------|---------|
| **Intent** | 50% | HOT=50, WARM=30, COLD=10, NEGATIVE=0 |
| **Status** | 30% | Engaged=30, Received=20, Delivered=10 |
| **Efficiency** | 20% | Converted early = more points |

Score categories:
- **70–100** = 🔴 HOT
- **40–69** = 🟡 WARM
- **0–39** = 🔵 COLD

Negative keyword detection (e.g. "scam", "fake", "too expensive") applies a **–50 penalty**.

---

### `gateway/`

#### `gateway/server.js` — Unified Webhook Entry (Port 8082)
- Single public URL for all Twilio webhooks
- Inbound SMS → queued to `inbound_sms_queue.json` (instant 200 response to Twilio)
- Inbound Email → queued to `inbound_email_queue.json`
- Voice requests → proxied to internal voice server on port 3000

---

### `ai/`

#### `ollama_engine.js` — Ollama Interface
- Direct HTTP interface to local Ollama (`/api/generate`, `/api/chat`)

#### `unified_server.js` — AI API Server
- Single `/generate` endpoint that routes to the right AI backend

---

## Dograh AI — Voice Call Integration

Dograh handles the full voice AI pipeline: **STT → LLM → TTS**, so no manual speech processing is needed.

### When Dograh is Active (`USE_DOGRAH_AI=true`)

```
Orchestrator
  │
  ├─ dograhClient.initiateCall(triggerUuid, phone, context)
  │       → POST /api/v1/telephony/initiate-call
  │
  ├─ Dograh calls the lead autonomously
  │       (uses its own STT, LLM, and TTS)
  │
  ├─ dograhClient.waitForCallCompletion(callId, workflowId)
  │       → polls GET /api/v1/workflow/:id/runs/:runId every 5s
  │
  ├─ On completion:
  │       → getCallTranscript()  → from logs or MinIO download
  │       → getCallVariables()   → e.g. callback_date, interest_level
  │
  └─ Triggers post-call follow-up (SMS + Email + CRM)
```

### Dograh vs Twilio — Side by Side

| | Twilio Mode | Dograh Mode |
|---|---|---|
| Speech-to-Text | Twilio STT | Dograh built-in |
| AI Brain | Ollama (local) | Dograh's LLM |
| Text-to-Speech | Amazon Polly | Dograh built-in |
| Transcripts | Local JSON files | Dograh API + MinIO |
| Latency trick | Filler text (`call_server.js`) | Dograh native |

### `dograh_client.js` — Key Methods

| Method | What It Does |
|--------|-------------|
| `initiateCall(uuid, phone, ctx)` | Starts an outbound call |
| `waitForCallCompletion(callId, wfId)` | Polls every 5s, returns when done |
| `getCallTranscript(runId, wfId)` | Gets transcript (API or MinIO) |
| `getCallVariables(runId, wfId)` | Gets AI-extracted context from the call |
| `downloadArtifact(runId, type)` | Downloads `.txt` or `.wav` from MinIO |
| `healthCheck()` | Checks Dograh is running |

---

## Dependencies

| Package | Used For |
|---------|----------|
| `axios` | HTTP calls to Ollama, Dograh API, CRM, and tracking |
| `express` | Runs voice server, gateway, AI server, MCP server |
| `twilio` | Outbound calls, WhatsApp messages, TwiML generation |
| `openai` | Alternative LLM backend (optional) |
| `nodemailer` | Sends all outbound emails via Gmail |
| `imap-simple` | Monitors Gmail inbox for inbound replies |
| `mailparser` | Parses raw emails from IMAP |
| `dotenv` | Loads `.env` credentials at startup |
| `better-sqlite3` | Local SQLite for structured data storage |
| `minio` | Downloads call recordings/transcripts from Dograh's MinIO |
| `@modelcontextprotocol/sdk` | Exposes agent tools via MCP protocol |
| `body-parser` | Parses HTTP request bodies in Express |
| `inquirer` | CLI prompts for manual agent testing |
| `libphonenumber-js` | Validates & formats phone numbers before dialling |
| `zod` | Schema validation for MCP tool inputs |

---

## Lead State Machine

```
NEW → SMS_IDLE
        │
        ├─ SMS sent ──────────────► SMS_SENT → SMS_ENGAGED
        │                                           │
        │                                    "call me" → SMS_TO_CALL_REQUESTED
        │
        ├─ Email sent ────────────► MAIL_SENT → MAIL_ENGAGED
        │                                           │
        │                                    "call me" → MAIL_TO_CALL_REQUESTED
        │
        └─ Voice call ────────────► CALL_INITIATED → CALL_CONNECTED
                                                          │
                                      ┌───────────────────┼──────────────────┐
                                      ▼                   ▼                  ▼
                               CALL_INTERESTED   CALL_NOT_INTERESTED   CALL_COMPLETED
                                      │
                               score≥50 + 6 attempts
                                      │
                                      ▼
                               HUMAN_HANDOFF ✋

Special halts: DO_NOT_CONTACT, OPTED_OUT → ⛔
```

---

## Environment Variables

Copy `.env.example` → `.env` and fill in:

```env
# Ollama
OLLAMA_URL=http://localhost:11434/api/generate

# Twilio
TWILIO_SID=YOUR_ACCOUNT_SID
TWILIO_AUTH=YOUR_AUTH_TOKEN
TWILIO_PHONE=+1xxxxxxxxxx

# Email
EMAIL_USER=your@gmail.com
EMAIL_PASS=your-app-password

# Dograh
USE_DOGRAH_AI=true
DOGRAH_API_URL=http://localhost:8000
DOGRAH_API_KEY=YOUR_DOGRAH_KEY
DOGRAH_WORKFLOW_ID=10
DOGRAH_TRIGGER_UUID=YOUR_UUID

# MinIO (Dograh artifact storage)
MINIO_ENDPOINT=localhost
MINIO_PORT=9000
MINIO_ACCESS_KEY=minioadmin
MINIO_SECRET_KEY=minioadmin
MINIO_BUCKET=voice-audio

# CRM
CRM_PUBLIC_URL=https://your-crm-url
```

---

## How to Run

```bash
# 1. Install dependencies
cd conversion-system
npm install

# 2. Start (Twilio mode)
node router/orchestrator.js

# 3. OR start with Dograh (set USE_DOGRAH_AI=true in .env first)
docker-compose -f docker-compose.dograh.yml up -d
node router/orchestrator.js

# 4. Test bot in terminal
node agent/cli_chat.js

# 5. Test Dograh connection
node test_dograh.js
```

---

*Hivericks Conversion System — JavaScript/Node.js*
