# 🐝 Hivericks Sales Conversion System — Full Documentation

> **Version:** JavaScript (Node.js)  
> **Product:** XOptimus Smart Charger (₹1499)  
> **Agent Name:** Vijay (AI Sales Consultant)  
> **Last Updated:** March 2026

---

## Table of Contents

1. [System Overview](#1-system-overview)
2. [Architecture Diagram](#2-architecture-diagram)
3. [File-by-File Breakdown](#3-file-by-file-breakdown)
4. [Dependencies Explained](#4-dependencies-explained)
5. [Dograh AI Voice Integration](#5-dograh-ai-voice-integration)
6. [Data Flow & State Machine](#6-data-flow--state-machine)
7. [Environment Configuration](#7-environment-configuration)
8. [How to Run](#8-how-to-run)

---

## 1. System Overview

The **Hivericks Sales Conversion System** is a fully automated, multi-channel AI sales agent that reaches out to potential customers (leads) via **Voice Calls**, **SMS/WhatsApp**, and **Email** to sell the **XOptimus Smart Charger**.

The AI agent is named **Vijay** — a conversational, human-like product consultant who:
- Initiates sales outreach across all channels
- Handles objections, pricing questions, and interest detection
- Schedules callbacks for busy leads
- Automatically syncs every interaction to a CRM
- Escalates hot leads to a human handoff

### Core Channels

| Channel | Technology | Purpose |
|---------|------------|---------|
| **Voice** | Twilio + Dograh AI | Outbound & Inbound phone calls |
| **SMS/WhatsApp** | Twilio WhatsApp API | Text-based sales follow-up |
| **Email** | Nodemailer (Gmail) | Drip email campaigns & reply handling |

### Core Intelligence

| Layer | Technology | Purpose |
|-------|------------|---------|
| **LLM Brain** | Ollama (`llama3.2:1b`) | Generates all agent responses |
| **Scoring** | Custom algorithm | Rates lead quality 0–100 |
| **CRM** | EspoCRM REST API | Syncs all interactions & lead state |
| **Memory** | JSON file store | Persists per-lead conversation history |

---

## 2. Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│                         ORCHESTRATOR                                 │
│                    router/orchestrator.js                            │
│          (Master Loop: Plans & executes all actions)                 │
└──────────────┬──────────────────┬───────────────────┬───────────────┘
               │                  │                   │
     ┌─────────▼────────┐ ┌──────▼──────┐ ┌─────────▼────────┐
     │   SMS ENGINE     │ │ EMAIL ENGINE│ │  VOICE ENGINE    │
     │ sms/sms_engine   │ │ email/email │ │voice/call_server │
     │ WhatsApp via     │ │ _engine.js  │ │  + Dograh AI     │
     │ Twilio API       │ │ Nodemailer  │ │  (Twilio/Dograh) │
     └─────────┬────────┘ └──────┬──────┘ └─────────┬────────┘
               │                  │                   │
     ┌─────────▼──────────────────▼───────────────────▼────────┐
     │                      SALES BRAIN                         │
     │                  agent/salesBot.js                       │
     │     (Ollama LLM → Vijay responses, summaries, follow-up) │
     └───────────────────────────┬──────────────────────────────┘
                                 │
     ┌───────────────────────────▼──────────────────────────────┐
     │                       CRM LAYER                          │
     │                  agent/crm_connector.js                  │
     │   (EspoCRM: pull new leads, push calls/notes/meetings)   │
     └──────────────────────────────────────────────────────────┘

     ┌──────────────────────────────────────────────────────────┐
     │                    UNIFIED GATEWAY                       │
     │                  gateway/server.js                       │
     │   Port 8082: Receives all Twilio webhooks (SMS/Voice)    │
     │   Queues SMS → Forwards Voice to internal port 3000      │
     └──────────────────────────────────────────────────────────┘

     ┌──────────────────────────────────────────────────────────┐
     │                   DOGRAH AI CLIENT                       │
     │               voice/dograh_client.js                     │
     │   Manages call initiation, status polling, transcripts   │
     │   via Dograh REST API + MinIO artifact storage           │
     └──────────────────────────────────────────────────────────┘
```

---

## 3. File-by-File Breakdown

### 📁 `router/`

---

#### `router/orchestrator.js` — **Master Orchestrator**

**Purpose:** The "brain of brains" — a continuous loop (every 30 seconds) that decides what action to perform for each lead based on their current status and the engagement timeline.

**What it does:**
- Launches child processes: Voice Server (port 3000) and Gateway (port 8082)
- Starts Ngrok tunnel for public webhook access
- Pulls new leads from CRM each cycle
- Plans batches of actions: SMS, MAIL, or VOICE per lead
- Enforces the **10-attempt engagement timeline** (Day 1 SMS→Day 3 Voice→Day 5 SMS...)
- Calls Dograh AI or Twilio Voice depending on `USE_DOGRAH_AI=true`
- Executes post-call follow-up messages (SMS + Email)
- Pushes all activity to CRM

**Key Functions:**
| Function | Description |
|----------|-------------|
| `determineActions(lead)` | Returns `['SMS']`, `['VOICE']`, `['MAIL']` or `[]` based on lead state |
| `runOrchestrator()` | Full execution cycle — runs every 30 seconds |
| `processPostCallActions()` | Sends follow-up SMS/Email after a voice call completes |
| `processPrioritySmsActions()` | Handles urgent SMS requests from MCP tools |
| `checkGraduation(lead)` | Promotes leads with score ≥ 50 and ≥ 6 attempts to `HUMAN_HANDOFF` |
| `markActionComplete(lead)` | Sets daily lock, increments attempt count, and triggers CRM sync |
| `markActionInitiated(lead)` | Pre-call lock to prevent race conditions |

**Timeline Logic (`TIMELINE_ACTIONS`):**
```
Day 1:  SMS + EMAIL
Day 2:  SMS + EMAIL
Day 3:  VOICE CALL ONLY ← Dograh/Twilio
Day 5:  SMS + EMAIL
Day 7:  VOICE CALL ONLY
Day 10: SMS + EMAIL
Day 14: VOICE CALL ONLY
...
```

**Dograh Integration in orchestrator.js:**
When `USE_DOGRAH_AI=true`, the orchestrator:
1. Calls `dograhClient.initiateCall(triggerUuid, lead.phone, context)` to start a Dograh AI voice call
2. Waits for completion via `dograhClient.waitForCallCompletion(callId, workflowId)`
3. Saves transcript and call variables back to the lead record
4. Sets `post_call_action_pending = true` to trigger follow-up messaging

---

#### `router/router.js` — **Express Router**

A simple Express router that registers HTTP endpoints (supplementary to the main gateway).

---

### 📁 `agent/`

---

#### `agent/salesBot.js` — **AI Sales Brain**

**Purpose:** The core AI module that powers Vijay's personality and sales logic. Uses Ollama (`llama3.2:1b`) as its LLM backend.

**What it does:**
- Implements `SalesBrain` class — stateful per-call conversation engine
- Applies **hard template overrides** for bullet-proof exit handling (e.g., "busy", "later")
- Uses **intent keyword detection** before sending to LLM (price, safety, compatibility)
- Generates conversation summaries after each call
- Creates follow-up WhatsApp/Email messages after calls

**Key Exports:**
| Function | Description |
|----------|-------------|
| `SalesBrain.processTurn(userMessage)` | Core method — generates AI response given conversation context |
| `generateResponse(params)` | Convenience wrapper for quick single-turn responses |
| `generateStructuredSummary(history)` | Returns `{interest_level, key_topics, next_action}` |
| `generateTextSummary(history)` | Returns a single-sentence human-readable call summary |
| `generateFinalSummary(history)` | Returns `{lead_status, analysis}` — used to update CRM status |
| `generateFeedbackRequest(summary, mode, name)` | Generates post-call follow-up SMS or Email content |
| `generateOpening(lead)` | Returns the first greeting line for a new call |

**Sales Identity Prompt:**
Vijay is programmed to:
- Speak naturally on voice calls (max 2 sentences)
- Lead with battery health discussion before product pitch
- Handle objections with exactly one gentle probe
- Offer WhatsApp details on callback requests
- NEVER repeat persuasion after confirmed disinterest

**Hard Override Examples:**
- If user says "busy/later" → Offer WhatsApp details → Hang up
- If user says "not interested" twice → Thank and end call `[HANGUP]`
- Price question → Always answer with "₹1499" only

---

#### `agent/crm_connector.js` — **CRM Integration**

**Purpose:** Bidirectional sync with EspoCRM (EspoCRM REST API on the server).

**What it does:**
- Automatically finds or creates lead records in CRM by phone/email
- Pushes call logs, notes, opportunities, and meetings
- Pulls new leads from CRM into the local processing queue

**Key Exports:**
| Function | Description |
|----------|-------------|
| `checkConnection()` | Tests if CRM API is reachable |
| `pullNewLeads()` | Fetches all leads with status="New" from CRM and imports locally |
| `pushLeadUpdate(lead, data)` | Updates a lead's status/fields in CRM |
| `pushCallLog(lead, data)` | Creates a Task record (call log) in CRM |
| `pushOpportunity(lead)` | Creates an Opportunity record for interested leads |
| `pushMeeting(lead, dateStart)` | Creates a Meeting record for scheduled calls |
| `pushInteractionToStream(lead, channel, data)` | Creates a Note/Stream entry with full interaction transcript |

**`syncLead(lead)` Logic:**
1. If `lead_id` exists → verify against CRM
2. Search CRM by phone or email
3. If not found → create new Lead record in CRM
4. Return the server-side CRM ID

**CRM Entity Mapping:**
```
LEAD_UPDATE → PUT /v1/Lead/:id
TASK_LOG    → POST /v1/Task
OPPORTUNITY → POST /v1/Opportunity
MEETING     → POST /v1/Meeting
NOTE        → POST /v1/Note (used for stream/activity feed)
```

---

#### `agent/memory.js` — **Lead Memory Store**

**Purpose:** Persistent per-lead memory using JSON file storage.

**What it does:**
- Stores conversation history, last message, bot state per lead
- Used by SMS and Email engines to maintain context across sessions
- Referenced by SalesBrain when generating follow-up content

---

#### `agent/mcp_server.js` — **MCP Tools Server**

**Purpose:** Exposes sales agent tools via the Model Context Protocol.

Allows external AI/MCP clients to trigger actions like sending SMS, checking lead status, updating CRM notes, etc., from any MCP-compatible interface.

---

#### `agent/voice_utils.js` — **Voice Utilities**

**Purpose:** Text preprocessing for Twilio TTS (Polly Neural voice).

- `textToSSML(text)` — Converts plain text to SSML markup, adding pauses and emphasis for natural speech via Amazon Polly.

---

#### `agent/config.js` — **Configuration**

```javascript
OLLAMA_URL = 'http://localhost:11434/api/chat'
MODEL      = 'llama3.2:1b'
```

---

### 📁 `voice/`

---

#### `voice/call_server.js` — **Twilio Voice Call Server** (Port 3000)

**Purpose:** Full-featured Express server that handles all Twilio voice webhook events for outbound and inbound calls.

**What it does:**
- Handles `/voice` — call initiation, sends TTS greeting via Polly Neural
- Handles `/voice/input` — processes user speech, runs AI response with **Filler Text** latency masking
- Handles `/voice/deferred-response` — async-redirect pattern: filler plays first, AI result follows
- Handles `/voice/status` — processes call completion, generates summaries, updates lead state
- Uses `SalesBrain` to generate all real-time responses
- Calculates lead score using `scoring_engine.js`
- Pushes transcripts, summaries, and interaction notes to CRM

**Async Filler Architecture:**
```
User speaks → filler text plays ("Let me check that...") 
           → LLM runs in background 
           → redirect to /voice/deferred-response 
           → actual AI answer delivered
```
This reduces *perceived latency* to near zero.

**Key Routes:**
| Route | Method | Description |
|-------|--------|-------------|
| `/voice` | POST | Initial call webhook — plays greeting |
| `/voice/input` | POST | User speech → filler → async LLM |
| `/voice/deferred-response` | POST | Delivers LLM result after filler |
| `/voice/status` | POST | Call ended → summarize & update CRM |

---

#### `voice/dograh_client.js` — **Dograh AI API Client**

*See full dedicated section: [Section 5 — Dograh AI Integration](#5-dograh-ai-voice-integration)*

---

#### `voice/voice_engine.js` — **Twilio Voice Engine**

**Purpose:** Utility module for dialing leads via Twilio Programmable Voice (non-Dograh path).

- `dialLead(lead, twimlUrl, openingText)` — Initiates an outbound Twilio call to a lead's phone number

---

#### `voice/ai_agent_client.js` — **AI Agent Client**

Lightweight client library for communicating with the local AI agent API endpoint for voice pipeline integration.

---

#### `voice/voice_ai_handler.js` — **Voice AI Handler**

Bridges Twilio voice events with the AI pipeline, handling STT → LLM → TTS flow for interactive call sessions.

---

### 📁 `sms/`

---

#### `sms/sms_engine.js` — **WhatsApp/SMS Engine**

**Purpose:** Manages outbound WhatsApp messages via Twilio's WhatsApp API.

**What it does:**
- Validates lead phone numbers before sending
- Generates AI-personalized messages using `salesBot.generateResponse()`
- Loads per-lead memory for context-aware messaging
- Sends WhatsApp messages via Twilio (sandbox: `whatsapp:+14155238886`)
- Logs all sessions to `sms_history.json`
- Pushes outbound interaction to CRM stream

**Key Exports:**
| Function | Description |
|----------|-------------|
| `runSmartSmsBatch(leads)` | Batch sends AI-generated WhatsApp messages |
| `sendSms(to, body)` | Single direct send via Twilio |
| `logSmsSession(leadId, role, content)` | Session logging |

---

#### `sms/sms_queue_manager.js` — **SMS Queue Manager**

**Purpose:** Processes inbound WhatsApp replies from the SMS queue.

- Reads from `inbound_sms_queue.json` (filled by gateway)
- Generates AI reply using `salesBot.generateResponse()`
- Detects escalation intents (e.g., "call me") → updates lead status to `SMS_TO_CALL_REQUESTED`
- Finalizes stale SMS sessions by generating summaries
- Pushes all interactions to CRM

---

#### `sms/sms_server.js` — **SMS HTTP Server**

Standalone Express server for testing SMS webhooks independently.

---

#### `sms/templates.js` — **SMS Templates**

Pre-defined message templates used as fallback when AI generation fails.

---

### 📁 `email/`

---

#### `email/email_engine.js` — **Email Engine**

**Purpose:** Full email management — outbound drip campaigns and inbound reply processing.

**What it does:**
- Sends HTML emails via Nodemailer (Gmail SMTP)
- Embeds **tracking pixel** to detect email opens
- Processes inbound replies: strips quoted history, generates AI reply, sends response
- Detects call escalation from email replies ("call me", "phone number")
- Runs `finalizeMailEvents()` to close stale email threads with summaries
- Pushes all email interactions to CRM stream

**Key Exports:**
| Function | Description |
|----------|-------------|
| `sendEmail(lead, subject, body)` | Sends outbound email with tracking pixel |
| `processInboundEmail(payload)` | Handles inbound reply, generates AI response, replies |
| `processInboundQueue()` | Processes all queued inbound emails |
| `finalizeMailEvents()` | Summarizes stale email threads (24h timeout) |

---

#### `email/email_events.js` — **Email Event Tracker**

Manages open mail events — tracks when email threads start, log interactions, and get summarized.

- `openMailEvent(leadId, body)` — Opens a new email interaction event
- `logMailInteraction(eventId, role, content)` — Logs messages within an event
- `summarizeMailEvent(eventId)` — Generates LLM summary of the email thread

---

#### `email/reply_monitor.js` — **IMAP Reply Monitor**

**Purpose:** Monitors Gmail inbox via IMAP to detect and queue lead replies.

- Uses `imap-simple` to connect to Gmail
- Parses incoming emails with `mailparser`
- Only processes emails from known lead addresses
- Queues replies to `inbound_email_queue.json` for processing by `email_engine.js`

---

#### `email/tracking_server.js` — **Email Tracking Server**

Lightweight Express server that handles tracking pixel requests to detect email opens.

- `/track/open?email=...` — Marks the lead's email as opened in the leads JSON

---

### 📁 `scoring/`

---

#### `scoring/scoring_engine.js` — **Lead Scoring Engine**

**Purpose:** Calculates a 0–100 lead score after every interaction.

**Scoring Weights:**
| Component | Weight | Description |
|-----------|--------|-------------|
| **Intent** | 50% | HOT=50pts, WARM=30pts, COLD=10pts, NEGATIVE=0pts |
| **Status** | 30% | Engaged=30pts, Received=20pts, Delivered=10pts, Basic=5pts |
| **Efficiency** | 20% | Converted ≤3 attempts=20pts, ≤6=10pts, ≤9=5pts |

**Score → Category:**
- 70–100 = **HOT** (high purchase intent)
- 40–69 = **WARM** (engaged, nurturing)
- 0–39 = **COLD** (low engagement)

**`analyzeSentiment(transcript)`:**
Scans the last 3 user turns for negative keywords (e.g., "scam", "fake", "too expensive") and returns a penalty of -50 if found, which can push a lead's score to zero. This prevents hot-flagging hostile leads.

---

### 📁 `gateway/`

---

#### `gateway/server.js` — **Unified Gateway** (Port 8082)

**Purpose:** Single public entry point for all Twilio webhooks.

**What it does:**
- Receives inbound SMS → immediately queues to `inbound_sms_queue.json` → responds 200 to Twilio
- Receives inbound Emails → queues to `inbound_email_queue.json`
- Receives all `/voice/*` requests → proxies to internal Voice Server at port 3000

**Why this architecture?**
Twilio has strict timeout requirements (5s for SMS, 15s for Voice). By queueing SMS immediately and proxying voice, the gateway ensures Twilio always gets a fast acknowledgment while the heavy AI processing happens asynchronously.

---

### 📁 `ai/`

---

#### `ai/ollama_engine.js` — **Ollama LLM Engine**

**Purpose:** Direct interface to the local Ollama instance running `llama3.2:1b`.

- Handles raw HTTP calls to Ollama's `/api/generate` and `/api/chat` endpoints
- Used as the fallback engine for generic AI requests outside of `salesBot.js`

---

#### `ai/unified_server.js` — **Unified AI Server**

A unified Express server exposing a single `/generate` endpoint that routes to the appropriate AI backend based on request context.

---

### 📁 `utils/`

Contains utility functions such as `emailValidator.js` — validates email content before sending (checks for spam indicators, length limits, required fields).

---

### Root-level files

| File | Purpose |
|------|---------|
| `start_system.js` | Quick-start launcher for the full system |
| `dograh_call.py` | Python script to manually initiate a Dograh call (testing) |
| `fire_call.py` | Python script to manually fire a Twilio call (testing) |
| `test_dograh.js` | Node.js test script for Dograh API integration |
| `docker-compose.yml` | Docker setup for local development |
| `docker-compose.dograh.yml` | Docker setup including Dograh OSS services |
| `Dockerfile` | Container config for the conversion system |
| `.env.example` | Template for required environment variables |

---

## 4. Dependencies Explained

All dependencies defined in `package.json`:

| Package | Version | Role in System |
|---------|---------|----------------|
| **`axios`** | `^1.13.2` | HTTP client used by: SalesBrain (Ollama calls), DograhClient (REST API), CRM connector (EspoCRM), Email engine (tracking) |
| **`express`** | `^5.2.1` | Web framework for: Voice Server (port 3000), Gateway (port 8082), AI Server, tracking server, MCP server |
| **`twilio`** | `^5.10.7` | Powers all Twilio integration: outbound calls, inbound webhooks, WhatsApp SMS sending, TwiML generation |
| **`openai`** | `^6.10.0` | OpenAI SDK — available as a secondary LLM option; the system primarily uses Ollama but can be switched |
| **`nodemailer`** | `^7.0.10` | Sends all outbound emails (Gmail SMTP). Used in `email_engine.js` for drip campaigns and auto-replies |
| **`imap-simple`** | `^5.1.0` | Monitors Gmail inbox for inbound lead replies via IMAP. Used in `reply_monitor.js` |
| **`mailparser`** | `^3.9.0` | Parses raw email content received via IMAP. Extracts sender, subject, and body for `email_engine.js` |
| **`dotenv`** | `^17.2.3` | Loads environment variables from `.env` file. Used at the top of every module |
| **`better-sqlite3`** | `^12.5.0` | Fast SQLite3 driver — used for structured local data storage (lead events, session data) |
| **`minio`** | `^8.0.6` | S3-compatible object storage client. Used by `dograh_client.js` to download call transcripts and audio recordings from the Dograh MinIO bucket |
| **`@modelcontextprotocol/sdk`** | `^1.25.2` | MCP SDK — enables the `agent/mcp_server.js` to expose sales agent tools to any MCP-compatible AI client |
| **`body-parser`** | `^2.2.1` | Parses HTTP request bodies (JSON + URL-encoded). Used in all Express servers |
| **`inquirer`** | `^8.2.5` | Interactive CLI prompts. Used in `agent/cli_chat.js` for manual testing of the sales bot in terminal |
| **`libphonenumber-js`** | `^1.12.29` | International phone number validation and formatting. Ensures lead phone numbers are valid before calling |
| **`zod`** | `^4.3.5` | Schema validation library. Used for validating MCP tool inputs and API payload structures |
| **`simple-parser`** | `^0.0.0` | Lightweight parser utility used for simple text/data parsing tasks |

---

## 5. Dograh AI Voice Integration

Dograh is an AI voice platform that provides a managed, cloud-hosted AI agent pipeline for phone calls. Instead of running our own speech-to-text (STT) → LLM → text-to-speech (TTS) pipeline manually via Twilio, Dograh handles the entire voice conversation autonomously.

### How Dograh Works in This System

```
Orchestrator
    │
    ├─ Reads: USE_DOGRAH_AI=true
    │
    ├─ Calls: dograhClient.initiateCall(triggerUuid, phoneNumber, context)
    │           │
    │           ├─ Option A (Workflow ID available):
    │           │     POST /api/v1/telephony/initiate-call
    │           │     → phone_number, workflow_id
    │           │
    │           └─ Option B (Fallback - Public trigger):
    │                 POST /api/v1/public/agent/:triggerUuid
    │                 → phone_number, initial_context
    │
    ├─ Dograh calls the lead autonomously
    │   (STT → LLM → TTS all handled by Dograh)
    │
    ├─ Polls: dograhClient.waitForCallCompletion(callId, workflowId)
    │           Every 5 seconds polls:
    │           GET /api/v1/workflow/:workflowId/runs/:runId
    │
    ├─ On completion:
    │   ├─ getCallTranscript() → from run.logs or MinIO
    │   ├─ getCallVariables() → AI-gathered context (e.g., callback date)
    │   └─ Saves to lead.last_call_summary
    │
    └─ Triggers: processPostCallActions()
                 → SMS follow-up
                 → Email follow-up
                 → CRM sync
```

### Dograh vs Twilio Comparison

| Feature | Twilio Mode | Dograh Mode |
|---------|-------------|-------------|
| STT | Twilio Speech Recognition | Dograh built-in STT |
| LLM | Local Ollama (llama3.2:1b) | Dograh's AI pipeline |
| TTS | Amazon Polly (Polly.Matthew-Neural) | Dograh built-in TTS |
| Transcripts | `voice_conversations/*.json` | Dograh API + MinIO |
| Latency masking | Filler text trick | Dograh native |
| Real-time control | Full (`/voice/input` route) | Managed by Dograh |

### `voice/dograh_client.js` Deep Dive

The `DograhClient` class extends Node.js `EventEmitter` and wraps all Dograh REST API calls.

**Constructor Setup:**
```javascript
new DograhClient(
  apiUrl = process.env.DOGRAH_API_URL,    // e.g., http://localhost:8000
  apiKey = process.env.DOGRAH_API_KEY     // OSS service key (oss_sk_...)
)
```
Also initializes a **MinIO client** for artifact downloads using:
- `MINIO_ENDPOINT`, `MINIO_PORT`, `MINIO_ACCESS_KEY`, `MINIO_SECRET_KEY`
- Default bucket: `voice-audio`

**Authentication:**
Every request headers include `X-API-Key: <apiKey>` via `_getHeaders()`.

**Key Methods:**

| Method | Purpose |
|--------|---------|
| `healthCheck()` | GET /api/v1/health — validates Dograh is running |
| `createWorkflow(config)` | POST /api/v1/workflows — creates a new AI voice workflow |
| `getWorkflow(id)` | GET /api/v1/workflows/:id — retrieves workflow details |
| `listWorkflows()` | GET /api/v1/workflows — lists all available workflows |
| `initiateCall(triggerUuid, phoneNumber, context)` | Starts an outbound call using workflow ID or public trigger |
| `getCallStatus(runId, workflowId)` | GET run details — returns status, duration, completion flag |
| `getCallTranscript(runId, workflowId)` | Returns transcript from run logs or MinIO download |
| `getCallVariables(runId, workflowId)` | Returns AI-gathered context variables (e.g., reschedule_date) |
| `downloadArtifact(runId, type)` | Downloads transcript (.txt) or recording (.wav) from MinIO |
| `waitForCallCompletion(callId, workflowId, maxWaitMs)` | Polls every 5s until call is complete (max 10 min) |

**Mini MinIO Role:**  
When Dograh completes a call, audio recordings and text transcripts are stored in a MinIO S3-compatible bucket (`voice-audio`). The `downloadArtifact()` method retrieves these and saves them locally under `voice/transcripts/` and `voice/recordings/`.

### Dograh's Role Per File

| File | How Dograh Is Used |
|------|---------------------|
| `router/orchestrator.js` | Checks `USE_DOGRAH_AI=true`, calls `dograhClient.initiateCall()`, waits for completion, processes post-call actions |
| `voice/dograh_client.js` | Full API wrapper — all HTTP calls to Dograh REST API, MinIO artifact retrieval |
| `dograh_call.py` | Python test script — manually initiates calls, reads API status |
| `docker-compose.dograh.yml` | Spins up Dograh OSS stack (PostgreSQL, Redis, Pipecat, telephony services) |
| `.env` | Stores `DOGRAH_API_URL`, `DOGRAH_API_KEY`, `DOGRAH_WORKFLOW_ID`, `DOGRAH_TRIGGER_UUID` |
| `DOGRAH_INTEGRATION.md` | Setup guide for Dograh with this system |
| `DOGRAH_QUICKSTART.md` | Quick-start guide for Dograh OSS |

---

## 6. Data Flow & State Machine

### Lead State Machine

```
NEW LEAD (from CRM or manual JSON)
    │
    ▼
SMS_IDLE
    │
    ├─ SMS sent → SMS_SENT → (reply comes in) → SMS_ENGAGED
    │                                │
    │                                └─ "call me" → SMS_TO_CALL_REQUESTED
    │
    ├─ Email sent → MAIL_SENT → MAIL_OPENED → MAIL_ENGAGED
    │                                         │
    │                                         └─ "call me" → MAIL_TO_CALL_REQUESTED
    │
    ├─ Voice call initiated → CALL_INITIATED → CALL_CONNECTED
    │                                              │
    │                           ┌──────────────────┼─────────────────┐
    │                           ▼                  ▼                 ▼
    │                     CALL_INTERESTED  CALL_NOT_INTERESTED  CALL_COMPLETED
    │                           │
    │                           └─ score ≥ 50 + 6 attempts → HUMAN_HANDOFF
    │
    └─ DO_NOT_CONTACT / OPTED_OUT → ⛔ Halted
```

### Per-Cycle Orchestrator Flow

```
Every 30 seconds:
1. Call crm.pullNewLeads()         → Import any new CRM leads
2. Call finalizeSmsSessions()      → Close stale SMS threads
3. Call processPostCallActions()   → Send follow-up SMS/Email for completed calls
4. Call finalizeMailEvents()       → Summarize stale email threads
5. Plan batches: SMS[], MAIL[], VOICE[]
6. Run SMS batch  (5 at a time, interleaved with inbound queue)
7. Run MAIL batch (generate + validate + send)
8. Run VOICE batch:
   - If Dograh: initiateCall() → waitForCompletion() → post-call actions
   - If Twilio: dialLead() → waitForCallCompletion() → post-call actions
9. CRM sync at every completed action
```

---

## 7. Environment Configuration

Copy `.env.example` to `.env` and fill in the values:

```env
# LLM
OLLAMA_URL=http://localhost:11434/api/generate

# Twilio (Voice + SMS)
TWILIO_SID=ACxxxxxxxxxxxxxxxx
TWILIO_AUTH=xxxxxxxxxxxxxxxx
TWILIO_NUMBER=+1xxxxxxxxxx

# Email
EMAIL_USER=your@gmail.com
EMAIL_PASS=your-app-password
TRACKING_DOMAIN=https://your-domain.ngrok.io

# Dograh
DOGRAH_API_URL=http://localhost:8000
DOGRAH_API_KEY=oss_sk_xxxxxxx
DOGRAH_WORKFLOW_ID=123
DOGRAH_TRIGGER_UUID=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
USE_DOGRAH_AI=true

# MinIO (for Dograh artifacts)
MINIO_ENDPOINT=localhost
MINIO_PORT=9000
MINIO_ACCESS_KEY=minioadmin
MINIO_SECRET_KEY=minioadmin
MINIO_BUCKET=voice-audio

# CRM (EspoCRM)
CRM_PUBLIC_URL=https://your-crm.ngrok.io
```

---

## 8. How to Run

### Prerequisites
- Node.js >= 18
- Ollama running locally with `llama3.2:1b` pulled
- Twilio account + WhatsApp sandbox enabled
- (Optional) Dograh OSS stack running via Docker
- (Optional) EspoCRM instance running

### Install Dependencies
```bash
cd conversion-system
npm install
```

### Start (Twilio Mode)
```bash
node router/orchestrator.js
```

### Start (Dograh Mode)
```bash
# 1. Start Dograh OSS
docker-compose -f docker-compose.dograh.yml up -d

# 2. Set in .env:
#    USE_DOGRAH_AI=true

# 3. Start orchestrator
node router/orchestrator.js
```

### Test Sales Bot (CLI)
```bash
node agent/cli_chat.js
```

### Test Dograh Connection
```bash
node test_dograh.js
```


---

## 9. MCP — Model Context Protocol Integration

### What is MCP?

**MCP (Model Context Protocol)** is an open standard that lets AI assistants (like Claude, Cursor AI, or any MCP-compatible client) connect to external tools and data sources through a common interface.

Think of it like a **USB standard for AI tools** — instead of every AI needing custom integrations, MCP provides one universal plug-in system.

In this system, MCP does two things:
1. **Exposes the sales agent as a chatbot tool** → any MCP client can talk to Vijay
2. **Exposes system actions as callable tools** → an AI can trigger calls, escalations, and SMS directly

---

### How MCP Fits Into This System

```
┌─────────────────────────────────────────────────────────┐
│              External AI Client                          │
│         (Claude, Cursor, custom MCP app, etc.)           │
└──────────┬──────────────────────────────┬───────────────┘
           │                              │
           ▼                              ▼
┌──────────────────────┐    ┌─────────────────────────────┐
│  agent/mcp_server.js │    │    mcp-server/index.js       │
│  "Sales Agent MCP"   │    │  "Hivericks Action MCP"      │
│                      │    │                              │
│  Tools:              │    │  Tools:                      │
│  • consultative_chat │    │  • trigger_voice_call        │
│                      │    │  • escalate_to_human         │
│  Resources:          │    │  • schedule_call             │
│  • product_facts     │    │  • send_sms_message          │
│                      │    │                              │
│  Prompts:            │    │  Mechanism:                  │
│  • sales_persona     │    │  Writes to clean_leads.json  │
│                      │    │  → Orchestrator picks it up  │
└──────────────────────┘    └─────────────────────────────┘
           ▲
           │ managed by
┌──────────┴───────────┐
│  agent/mcp_manager.js │
│  Connects to both     │
│  MCP servers at once  │
└───────────────────────┘
```

---

### MCP Server 1 — Sales Agent (`agent/mcp_server.js`)

This server exposes Vijay (the AI sales agent) as an MCP tool that any external AI can use.

**Transport:** `stdio` (runs as a subprocess, communicates via stdin/stdout)

#### Tools

| Tool | Input | What It Does |
|------|-------|--------------|
| `consultative_chat` | `message` (required), `sessionId` (optional) | Sends a message to Vijay and gets a sales-focused AI reply. Uses conversation memory per `sessionId`. |

#### Resources

| Resource URI | What It Returns |
|-------------|-----------------|
| `xoptimus://data/product_facts` | Full XOptimus charger spec sheet (read from `agent/data/sample_product_facts.txt`) |

#### Prompts

| Prompt | What It Returns |
|--------|-----------------|
| `sales_persona` | A system prompt that makes any AI act as Vijay using the XOptimus Sales Protocol |

#### Example Use Case
An external team member opens Claude Desktop, connects to this MCP server, and can:
- Ask "What are the specs of the charger?" → gets product facts instantly
- Ask "How do I respond to a price objection?" → gets Vijay's AI response
- Run bulk WhatsApp message drafts by sending leads through `consultative_chat`

---

### MCP Server 2 — Action Server (`mcp-server/index.js`)

This is the **action execution server** — it exposes tools that directly modify lead state in `clean_leads.json`, which the Orchestrator reads on its next 30-second pulse.

**Transport:** `stdio`

#### Tools

| Tool | Inputs | What It Does | Lead State Change |
|------|--------|--------------|-------------------|
| `trigger_voice_call` | `phone`, `reason` | Schedules an immediate call to the lead | `status → SMS_TO_CALL_REQUESTED` |
| `escalate_to_human` | `phone`, `reason` | Hands lead off to a human sales rep | `status → HUMAN_HANDOFF` |
| `schedule_call` | `phone`, `when` | Books a call for a specific time | `status → SMS_CALL_SCHEDULED`, `next_action_due → <when>` |
| `send_sms_message` | `phone`, `message` | Requests a specific WhatsApp message to be sent | `status → SMS_SEND_REQUESTED`, `pending_sms_content → <message>` |

#### How the Action → Execution Flow Works

```
MCP Client calls trigger_voice_call(phone="+917xxxxxxxxx")
            │
            ▼
mcp-server/index.js updates clean_leads.json:
  lead.status = "SMS_TO_CALL_REQUESTED"
            │
            ▼ (next 30-second pulse)
orchestrator.js reads clean_leads.json
  → sees SMS_TO_CALL_REQUESTED
  → calls processPrioritySmsActions()
  → initiates voice call via Dograh or Twilio
            │
            ▼
Lead gets a call within 30 seconds ✅
```

#### Example Use Case
A sales manager using Claude Desktop can say:
> "Call this lead immediately — they just emailed asking about pricing"

Claude calls `trigger_voice_call` → Vijay calls the lead within 30 seconds. No manual work needed.

---

### MCP Manager (`agent/mcp_manager.js`)

The manager is the **client-side connector** — it runs inside the main system and connects to both MCP servers simultaneously.

**What it does:**
- Launches both MCP servers as subprocesses on startup
- Discovers all available tools from both servers (`listTools()`)
- Exposes a unified `getMCPTools()` function — returns all tools in OpenAI function-calling format
- Routes tool execution to the correct server via `executeMCPTool(toolName, args)`

**Configured Servers:**

| Server ID | Location | Purpose |
|-----------|----------|---------|
| `hivericks-action` | `mcp-server/index.js` | Action tools (call, escalate, schedule, SMS) |
| `context7` | `context7-server/packages/mcp/dist/index.js` | Library/documentation lookup via Context7 API |

**Key Functions:**

| Function | What It Does |
|----------|-------------|
| `initializeMCP()` | Connects to all configured servers, loads their tools |
| `getMCPTools(allowedServers?)` | Returns tools in OpenAI format (optionally filtered by server) |
| `executeMCPTool(toolName, args)` | Finds the right server for the tool and calls it |

---

### Context7 MCP Server

The system also connects to **Context7** — a documentation intelligence service. Via MCP, the AI can look up official library docs (e.g., Twilio, Express, Nodemailer) at runtime before answering questions or generating code suggestions.

Requires: `CONTEXT7_API_KEY` in `.env`

---

### Summary — Why MCP Matters Here

| Without MCP | With MCP |
|-------------|----------|
| System only runs autonomously | External AIs can interact with and control it |
| Actions require code changes | Actions happen via natural language through AI clients |
| Agent only talks to Twilio/Gmail | Agent is accessible from Claude, Cursor, any MCP app |
| No real-time human override | Sales manager can trigger calls instantly via AI chat |

MCP turns the system from a **scheduled automation** into a **live, controllable AI platform**.

---

*Documentation generated for the Hivericks Sales Conversion System — JavaScript version.*  
*Build commit: "javascript version"*
