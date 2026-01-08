"use strict";

/*
require('dotenv').config({ path: '../.env' });
const express = require('express');
const bodyParser = require('body-parser');
const fs = require('fs');
const path = require('path');
const twilio = require('twilio');

// INTERNAL ENGINES
const { generateResponse } = require('../agent/salesBot');
const { getMemory, upsertMemory } = require('../agent/memory');

// CONFIG
const app = express();
app.use(bodyParser.urlencoded({ extended: false }));
const PORT = 3000;

// FILE PATHS
const EVENTS_FILE = path.resolve(__dirname, '../processed_leads/lead-events.json');
const LEADS_FILE = path.resolve(__dirname, '../processed_leads/clean_leads.json');

// TWILIO CLIENT (For SMS Handoff)
const client = twilio(process.env.TWILIO_SID, process.env.TWILIO_AUTH);

// ---------------------------------------------------------
// 1. EVENT LOGGING SYSTEM (APPEND-ONLY)
// ---------------------------------------------------------
function emitEvent(leadId, type, details = {}) {
    const event = {
        event_id: `evt_${Date.now()}`,
        lead_id: leadId,
        channel: 'VOICE',
        type,
        timestamp: new Date().toISOString(),
        details
    };

    let events = [];
    if (fs.existsSync(EVENTS_FILE)) {
        try {
            events = JSON.parse(fs.readFileSync(EVENTS_FILE, 'utf8'));
        } catch (e) { events = []; }
    }
    events.push(event);
    fs.writeFileSync(EVENTS_FILE, JSON.stringify(events, null, 2));

    console.log(`📡 EVENT → ${type}`, details);
}

// ---------------------------------------------------------
// 2. HUMAN FILLERS (INSTANT, NO AI)
// ---------------------------------------------------------
function getHumanFiller(text = "") {
    const t = text.toLowerCase();
    if (t.includes('price') || t.includes('cost')) return "Let me quickly check that for you…";
    if (t.includes('whatsapp') || t.includes('send')) return "Sure, one moment…";
    if (t.length > 60) return "I see, that makes sense…";

    const generic = ["Okay…", "Right…", "Got it…", "Hmm…", "Sure…"];
    return generic[Math.floor(Math.random() * generic.length)];
}

// ---------------------------------------------------------
// 3. SMS HANDOFF FUNCTION (The Bridge)
// ---------------------------------------------------------
async function triggerSmsAction(leadId, intent) {
    console.log(`📨 TRIGGERING SMS ENGINE for ${leadId} (Intent: ${intent})`);
    let messageBody = "";

    // Define Templates based on Intent
    if (intent === 'SEND_DETAILS') {
        messageBody = "Hi! As discussed, here are the XOptimus details: https://hivericks.com. Let me know if you have questions! - Vijay";
    } else {
        messageBody = "Thanks for speaking with us. Here is the info you requested.";
    }

    try {
        // EXECUTE SMS SENDING
        await client.messages.create({
            body: messageBody,
            from: process.env.TWILIO_PHONE,
            to: leadId
        });
        
        emitEvent(leadId, 'SMS_SENT', { intent: intent, body: messageBody });
        return true;
    } catch (error) {
        console.error("❌ SMS ENGINE FAILED:", error.message);
        return false;
    }
}

// ---------------------------------------------------------
// 4. POST-CALL PROCESSOR (Summary & Scoring)
// ---------------------------------------------------------
async function processCallSummary(leadId) {
    console.log(`🧠 PROCESSING POST-CALL SUMMARY FOR: ${leadId}`);

    // A. Get Conversation History
    const memory = await getMemory(leadId);
    if (!memory.history || memory.history.length === 0) return;

    // Filter to last 10 turns to avoid token limits
    const transcript = memory.history.slice(-10).map(m => `${m.type}: ${m.content}`).join('\n');

    // B. AI Summarization Task
    const summarySystemPrompt = `
    You are a Sales Analyst. Analyze this call transcript.
    OUTPUT FORMAT (JSON):
    {
        "summary": "One sentence summary of user intent.",
        "sentiment": "POSITIVE" or "NEGATIVE",
        "interest_score": (0-100)
    }
    `;

    // We use the existing generateResponse but force it into "Analyst Mode"
    const analysisJson = await generateResponse({
        userMessage: `TRANSCRIPT:\n${transcript}\n\nAnalyze this now.`,
        memory: { history: [{ role: 'system', content: summarySystemPrompt }] },
        mode: 'SMS_CHAT' // Use SMS mode for higher intelligence
    });

    // C. Update Lead Database (Score & Events)
    if (fs.existsSync(LEADS_FILE)) {
        const leads = JSON.parse(fs.readFileSync(LEADS_FILE, 'utf8'));
        const leadIndex = leads.findIndex(l => l.phone === leadId);

        if (leadIndex !== -1) {
            let lead = leads[leadIndex];

            // Update Score based on keyword analysis
            if (analysisJson.toLowerCase().includes("positive")) {
                lead.score = (lead.score || 0) + 20;
            } else if (analysisJson.toLowerCase().includes("negative")) {
                lead.score = (lead.score || 0) - 20;
            }
            if (lead.score > 100) lead.score = 100;

            // Log Summary
            lead.last_call_summary = analysisJson;
            lead.last_interaction = new Date().toISOString();

            leads[leadIndex] = lead;
            fs.writeFileSync(LEADS_FILE, JSON.stringify(leads, null, 2));
            console.log(`✅ LEAD UPDATED: Score ${lead.score}`);
        }
    }

    // D. Save Summary to Memory (For next call context)
    await upsertMemory(leadId, { last_summary: analysisJson });
    emitEvent(leadId, 'CALL_ANALYZED', { summary: analysisJson });
}

// ---------------------------------------------------------
// ROUTE 1: CALL CONNECTED (START SPEAKING IMMEDIATELY)
// ---------------------------------------------------------
app.post('/voice', async (req, res) => {
    const callSid = req.body.CallSid;
    const leadId = req.body.To;

    console.log(`📞 CALL CONNECTED: ${callSid}`);
    emitEvent(leadId, 'CALL_STARTED', { callSid });

    // Dynamic Opening Check
    const memory = await getMemory(leadId);
    let opening = `
Hi, this is Vijay calling from Hivericks.
I noticed you checked out our chargers recently, just wanted to see if you had any questions?
    `;
    
    // If we have spoken before, use a shorter opening
    if (memory.last_summary) {
        opening = "Hi, this is Vijay again from Hivericks. Is now a good time to chat?";
    }

    const twiml = `
<Response>
    <Say voice="Polly.Matthew">${opening}</Say>
    <Gather input="speech" action="/gather" method="POST" timeout="6" speechTimeout="auto" actionOnEmptyResult="true" language="en-IN"/>
</Response>
    `;
    res.type('text/xml').send(twiml);
});

// ---------------------------------------------------------
// ROUTE 2: CONVERSATION LOOP
// ---------------------------------------------------------
app.post('/gather', async (req, res) => {
    const leadId = req.body.To;
    const userSpeech = req.body.SpeechResult;

    // ---- HANDLE SILENCE ----
    if (!userSpeech) {
        emitEvent(leadId, 'NO_SPEECH_RETRY');
        const retryTwiml = `
<Response>
    <Say voice="Polly.Matthew">Sorry, I didn't catch that. Can you hear me?</Say>
    <Gather input="speech" action="/gather" method="POST" timeout="6" speechTimeout="auto" actionOnEmptyResult="true"/>
</Response>`;
        return res.type('text/xml').send(retryTwiml);
    }

    console.log(`🗣 USER: ${userSpeech}`);
    emitEvent(leadId, 'USER_SPOKE', { text: userSpeech });

    // ---- ROLLBACK REQUEST (WHATSAPP / TEXT) ----
    // This now TRIGGERS the SMS Engine
    if (/whatsapp|send details|text|message/i.test(userSpeech)) {
        
        console.log("🔀 INTENT DETECTED: SMS_HANDOFF");
        
        // A. Send the SMS
        await triggerSmsAction(leadId, 'SEND_DETAILS');
        
        // B. Update Lead Score (High Interest)
        if (fs.existsSync(LEADS_FILE)) {
             const leads = JSON.parse(fs.readFileSync(LEADS_FILE));
             const idx = leads.findIndex(l => l.phone === leadId);
             if (idx !== -1) {
                 leads[idx].score = (leads[idx].score || 0) + 15; 
                 fs.writeFileSync(LEADS_FILE, JSON.stringify(leads, null, 2));
             }
        }

        const twiml = `
<Response>
    <Say voice="Polly.Matthew">
        Done. I've sent the details to your WhatsApp just now. 
        Is there anything else I can help you with?
    </Say>
    <Gather input="speech" action="/gather" timeout="6" speechTimeout="auto" actionOnEmptyResult="true"/>
</Response>`;
        return res.type('text/xml').send(twiml);
    }

    // ---- LATENCY HIDING ----
    const filler = getHumanFiller(userSpeech);

    // Start LLM (Parallel)
    const aiPromise = (async () => {
        const memory = await getMemory(leadId);
        return generateResponse({
            userMessage: userSpeech,
            memory,
            mode: 'VOICE_CALL'
        });
    })();

    const aiText = await aiPromise;
    console.log(`🤖 AI: ${aiText}`);
    emitEvent(leadId, 'AI_RESPONDED', { text: aiText });

    const twiml = `
<Response>
    <Say voice="Polly.Matthew">${filler}</Say>
    <Say voice="Polly.Matthew">${aiText}</Say>
    <Gather input="speech" action="/gather" method="POST" timeout="6" speechTimeout="auto" actionOnEmptyResult="true"/>
</Response>`;

    res.type('text/xml').send(twiml);
});

// ---------------------------------------------------------
// ROUTE 3: CALL STATUS (TRIGGER POST-PROCESS)
// ---------------------------------------------------------
app.post('/status', (req, res) => {
    const status = req.body.CallStatus;
    const leadId = req.body.To;
    
    emitEvent(leadId, 'CALL_ENDED', { status });
    console.log(`🏁 CALL ENDED: ${status}`);

    if (status === 'completed') {
        // Trigger Summary Analysis (Don't await, let connection close)
        processCallSummary(leadId).catch(err => console.error("Summary Error:", err));
    }
    
    res.sendStatus(200);
});

// ---------------------------------------------------------
// PRE-WARM LLM
// ---------------------------------------------------------
(async () => {
    try {
        console.log("🔥 Pre-warming Sales Brain...");
        await generateResponse({ userMessage: "Hello", mode: 'VOICE_CALL' });
        console.log("✅ Sales Brain READY");
    } catch {
        console.log("⚠️ Pre-warm skipped");
    }
})();

app.listen(PORT, () =>
    console.log(`🗣 VOICE SERVER RUNNING ON PORT ${PORT}`)
);
*/
// conversion-system/voice/call_server.js
// ---------------------------------------------------------
// VOICE SERVER: LOGIC, ANONYMOUS HANDLING, & AI CONVERSATION
// ---------------------------------------------------------
// conversion-system/voice/call_server.js
// ---------------------------------------------------------
// MASTER CALL SERVER: MERGED LOGIC
// Combines: Anonymous Handling + Lead Scoring + SMS Handoff
// ---------------------------------------------------------
// conversion-system/voice/call_server.js
// ---------------------------------------------------------
// MASTER CALL SERVER
// Features: Aggressive "Mean" Sales Persona + Latency Optimization
// ---------------------------------------------------------
// conversion-system/voice/call_server.js
// ---------------------------------------------------------
// MASTER VOICE CALL SERVER (FINAL, CLEAN VERSION)
// Responsibilities:
// - Handle inbound/outbound calls
// - Run LLM conversation
// - Handle anonymous callers
// - Emit call lifecycle events
// - Generate call summary + intent
// ---------------------------------------------------------
// ---------------------------------------------------------
// VOICE CALL SERVER — AI-FIRST, SUMMARY-ONLY EVENT LOGGER
// ---------------------------------------------------------
require('dotenv').config({
  path: '../.env'
});

var express = require('express');

var bodyParser = require('body-parser');

var twilio = require('twilio');

var fs = require('fs');

var path = require('path'); // LLM


var _require = require('../agent/salesBot'),
    generateResponse = _require.generateResponse; // ---------------------------------------------------------
// APP SETUP
// ---------------------------------------------------------


var app = express();
app.use(bodyParser.urlencoded({
  extended: false
}));
app.use(bodyParser.json());
var PORT = 3000; // ---------------------------------------------------------
// FILES CONFIGURATION
// ---------------------------------------------------------
// 1. Voice Recordings Folder

var CONVO_DIR = path.join(__dirname, 'voice'); // 2. Lead Events File (The summary will be appended here)

var EVENTS_FILE = path.resolve(__dirname, '../processed_leads/lead-events.json'); // 3. Master Call Logs (Optional: Keeps a backup of full transcripts)

var MASTER_LOG_FILE = path.resolve(__dirname, 'call_logs.json'); // Ensure directories and files exist

if (!fs.existsSync(CONVO_DIR)) fs.mkdirSync(CONVO_DIR, {
  recursive: true
});
if (!fs.existsSync(EVENTS_FILE)) fs.writeFileSync(EVENTS_FILE, '[]');
if (!fs.existsSync(MASTER_LOG_FILE)) fs.writeFileSync(MASTER_LOG_FILE, '[]'); // ---------------------------------------------------------
// VOICE CONFIGURATION (Human-Like)
// ---------------------------------------------------------

var VOICE_CONFIG = {
  voice: 'Polly.Matthew-Neural',
  // High-quality AI voice
  language: 'en-US'
}; // ---------------------------------------------------------
// HELPERS
// ---------------------------------------------------------

var readJSON = function readJSON(file, fallback) {
  if (!fs.existsSync(file)) return fallback;

  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (_unused) {
    return fallback;
  }
};

var writeJSON = function writeJSON(file, data) {
  fs.writeFileSync(file, JSON.stringify(data, null, 2));
};

var convoFile = function convoFile(sid) {
  return path.join(CONVO_DIR, "".concat(sid, ".json"));
};

var logTurn = function logTurn(sid, role, text) {
  var convo = readJSON(convoFile(sid), []);
  convo.push({
    role: role,
    text: text,
    timestamp: new Date().toISOString()
  });
  writeJSON(convoFile(sid), convo);
}; // ---------------------------------------------------------
// GENERAL OPENING PROMPT
// ---------------------------------------------------------


var OPENING_PROMPT = "\nHi, this is Vijay calling from Hivericks.\n\nI noticed that you recently visited our product, Xoptimus.\nI just wanted to check if now is a good time to have a quick conversation about it.\nYou can speak naturally.\n".trim(); // ---------------------------------------------------------
// 1. PRE-WARM ENDPOINT
// ---------------------------------------------------------

app.post('/voice', function _callee(req, res) {
  var callSid, twiml;
  return regeneratorRuntime.async(function _callee$(_context) {
    while (1) {
      switch (_context.prev = _context.next) {
        case 0:
          callSid = req.body.CallSid || 'prewarm'; // 🔥 Activate model immediately

          generateResponse({
            userMessage: 'SYSTEM_PREWARM',
            memory: {
              history: []
            },
            mode: 'VOICE_CHAT'
          })["catch"](function () {});
          twiml = new twilio.twiml.VoiceResponse();

          if (!(callSid === 'prewarm')) {
            _context.next = 5;
            break;
          }

          return _context.abrupt("return", res.type('text/xml').send(twiml.toString()));

        case 5:
          // Log assistant opening
          logTurn(callSid, 'assistant', OPENING_PROMPT.trim()); // Speak opening using Neural Voice

          twiml.say(VOICE_CONFIG, OPENING_PROMPT);
          twiml.gather({
            input: 'speech',
            speechTimeout: 'auto',
            action: '/voice/input',
            method: 'POST'
          });
          res.type('text/xml').send(twiml.toString());

        case 9:
        case "end":
          return _context.stop();
      }
    }
  });
}); // ---------------------------------------------------------
// 2. USER SPEECH HANDLER
// ---------------------------------------------------------

app.post('/voice/input', function _callee2(req, res) {
  var callSid, userSpeech, twiml, history, reply;
  return regeneratorRuntime.async(function _callee2$(_context2) {
    while (1) {
      switch (_context2.prev = _context2.next) {
        case 0:
          callSid = req.body.CallSid;
          userSpeech = (req.body.SpeechResult || '').trim();
          twiml = new twilio.twiml.VoiceResponse();

          if (userSpeech) {
            _context2.next = 7;
            break;
          }

          twiml.say(VOICE_CONFIG, "Sorry, I didn't catch that.");
          twiml.redirect('/voice');
          return _context2.abrupt("return", res.type('text/xml').send(twiml.toString()));

        case 7:
          logTurn(callSid, 'user', userSpeech); // Generate AI reply

          history = readJSON(convoFile(callSid), []);
          _context2.next = 11;
          return regeneratorRuntime.awrap(generateResponse({
            userMessage: userSpeech,
            memory: {
              history: history
            },
            mode: 'VOICE_CHAT'
          }));

        case 11:
          reply = _context2.sent;
          logTurn(callSid, 'assistant', reply);
          twiml.say(VOICE_CONFIG, reply);
          twiml.gather({
            input: 'speech',
            speechTimeout: 'auto',
            action: '/voice/input',
            method: 'POST'
          });
          res.type('text/xml').send(twiml.toString());

        case 16:
        case "end":
          return _context2.stop();
      }
    }
  });
}); // ---------------------------------------------------------
// 3. CALL STATUS (SUMMARY & LEAD EVENT GENERATION)
// ---------------------------------------------------------

app.post('/voice/status', function _callee3(req, res) {
  var _req$body, CallSid, CallStatus, convo, transcript, summaryPrompt, summary, events, masterLogs;

  return regeneratorRuntime.async(function _callee3$(_context3) {
    while (1) {
      switch (_context3.prev = _context3.next) {
        case 0:
          _req$body = req.body, CallSid = _req$body.CallSid, CallStatus = _req$body.CallStatus; // Only process if the call is actually finished

          if (!(CallStatus !== 'completed')) {
            _context3.next = 3;
            break;
          }

          return _context3.abrupt("return", res.sendStatus(200));

        case 3:
          convo = readJSON(convoFile(CallSid), []);

          if (convo.length) {
            _context3.next = 6;
            break;
          }

          return _context3.abrupt("return", res.sendStatus(200));

        case 6:
          // Format transcript for the LLM
          transcript = convo.map(function (m) {
            return "".concat(m.role.toUpperCase(), ": ").concat(m.text);
          }).join('\n');
          summaryPrompt = "\nSummarize this phone conversation in 2\u20133 lines.\nExtract:\n- Interest level\n- Objections (if any)\n- Suggested next step\n\nCONVERSATION:\n".concat(transcript, "\n");
          _context3.prev = 8;
          _context3.next = 11;
          return regeneratorRuntime.awrap(generateResponse({
            userMessage: 'SUMMARIZE_CALL',
            memory: {
              history: [{
                type: 'system',
                content: summaryPrompt
              }]
            },
            mode: 'VOICE_SUMMARY'
          }));

        case 11:
          summary = _context3.sent;
          // -----------------------------------------------------
          // CRITICAL STEP: APPEND TO LEAD-EVENTS.JSON
          // -----------------------------------------------------
          events = readJSON(EVENTS_FILE, []);
          events.push({
            event_id: "evt_".concat(Date.now()),
            channel: 'VOICE',
            call_sid: CallSid,
            type: 'CALL_SUMMARY',
            timestamp: new Date().toISOString(),
            payload: {
              summary: summary // You can add more data here if needed

            }
          });
          writeJSON(EVENTS_FILE, events);
          console.log("\u2705 LEAD EVENT UPDATED WITH SUMMARY \u2192 ".concat(CallSid)); // Optional: Update Master Log as well

          masterLogs = readJSON(MASTER_LOG_FILE, []);
          masterLogs.push({
            call_sid: CallSid,
            timestamp: new Date().toISOString(),
            summary: summary,
            full_transcript: convo
          });
          writeJSON(MASTER_LOG_FILE, masterLogs);
          _context3.next = 24;
          break;

        case 21:
          _context3.prev = 21;
          _context3.t0 = _context3["catch"](8);
          console.error('❌ Failed to generate summary or update lead events:', _context3.t0);

        case 24:
          res.sendStatus(200);

        case 25:
        case "end":
          return _context3.stop();
      }
    }
  }, null, null, [[8, 21]]);
}); // ---------------------------------------------------------
// START SERVER
// ---------------------------------------------------------

app.listen(PORT, function () {
  console.log("\uD83D\uDFE2 VOICE CALL SERVER RUNNING ON PORT ".concat(PORT));
  console.log("   - Lead Events File: ".concat(EVENTS_FILE));
});