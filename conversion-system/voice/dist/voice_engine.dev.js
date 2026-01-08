"use strict";

// ---------------------------------------------------------

/*
require('dotenv').config({ path: '../.env' });
const client = require('twilio')(process.env.TWILIO_SID, process.env.TWILIO_AUTH);
const fs = require('fs');
const path = require('path');

const LEADS_FILE = path.resolve(__dirname, '../processed_leads/clean_leads.json');
const SERVER_URL = process.env.SERVER_URL; // Ngrok URL

const runBatch = async () => {
    console.log("🚀 Starting Voice Engine...");

    // 1. Safety Checks
    if (!SERVER_URL) return console.log("❌ Missing SERVER_URL in .env");
    if (!fs.existsSync(LEADS_FILE)) return console.log("❌ Missing DB file");

    // 2. Load Leads
    let leads = JSON.parse(fs.readFileSync(LEADS_FILE, 'utf-8'));

    // 3. Filter: Find VERIFIED or CONTACTED leads
    const targets = leads.filter(l => 
        (l.status === "VERIFIED" || l.status === "CONTACTED") && 
        l.phone.length > 5
    );

    console.log(`📞 Found ${targets.length} leads to call.`);

    // 4. Call Loop
    for (const lead of targets) {
        try {
            console.log(`   ☎️ Dialing ${lead.name} (${lead.phone})...`);

            const call = await client.calls.create({
                url: `${SERVER_URL}/voice`,
                to: lead.phone,
                from: process.env.TWILIO_PHONE
            });

            console.log(`      ✅ Call Started! SID: ${call.sid}`);

            // --- CRITICAL: SAVE SID IMMEDIATELY ---
            // This links the Lead to the Call
            lead.status = "CALLED";
            lead.last_call_sid = call.sid; 
            lead.last_called = new Date().toISOString();

            // Write to disk NOW so the Brain can read it in 5 seconds
            fs.writeFileSync(LEADS_FILE, JSON.stringify(leads, null, 2));
            console.log("      💾 Database Updated (SID Saved).");

        } catch (error) {
            console.log(`      ❌ Error: ${error.message}`);
        }
    }
};

runBatch();
*/
// conversion-system/voice/voice_engine.js
// ---------------------------------------------------------
// VOICE ENGINE: UNRESTRICTED DIALER
// ---------------------------------------------------------
// ---------------------------------------------------------
// VOICE ENGINE: BATCH DIALER (NO TIME RESTRICTIONS)
// ---------------------------------------------------------
// conversion-system/voice/voice_engine.js
// ---------------------------------------------------------
// VOICE ENGINE: BATCH DIALER
// ---------------------------------------------------------
// ---------------------------------------------------------
// VOICE ENGINE: STABLE BATCH DIALER
// ---------------------------------------------------------

/*
require('dotenv').config({ path: '../.env' });

const client = require('twilio')(
    process.env.TWILIO_SID,
    process.env.TWILIO_AUTH
);

const fs = require('fs');
const path = require('path');

const LEADS_FILE = path.resolve(__dirname, '../processed_leads/clean_leads.json');
const SERVER_URL = process.env.SERVER_URL;

async function runBatch() {
    console.log("🚀 Starting Voice Engine...");

    if (!SERVER_URL) return console.log("❌ SERVER_URL missing");
    if (!fs.existsSync(LEADS_FILE)) return console.log("❌ clean_leads.json missing");

    const leads = JSON.parse(fs.readFileSync(LEADS_FILE, 'utf8'));

    const targets = leads.filter(l =>
        l.allowed_channels?.includes('VOICE') &&
        l.status !== 'DO_NOT_CONTACT' &&
        l.status !== 'COLD_LEAD'
    );

    console.log(`📞 Dialing ${targets.length} leads`);

    for (const lead of targets) {
        try {
            console.log(`☎️ Calling ${lead.name} (${lead.phone})`);

            const call = await client.calls.create({
                to: lead.phone,
                from: process.env.TWILIO_PHONE,
                url: `${SERVER_URL}/voice`,
                statusCallback: `${SERVER_URL}/status`,
                statusCallbackEvent: ['completed', 'busy', 'no-answer'],
                machineDetection: 'Enable'
            });

            lead.last_call_sid = call.sid;
            lead.last_called = new Date().toISOString();

            fs.writeFileSync(LEADS_FILE, JSON.stringify(leads, null, 2));

            console.log(`✅ Call started → SID: ${call.sid}`);
        } catch (err) {
            console.log(`❌ Failed to call ${lead.phone}: ${err.message}`);
        }
    }
}

runBatch();
*/
// ---------------------------------------------------------
// SMS ENGINE — EVENT-DRIVEN, ORCHESTRATION-SAFE
// PORT: 3000
// ---------------------------------------------------------

/*
require('dotenv').config({ path: '../.env' });

const express = require('express');
const bodyParser = require('body-parser');
const fs = require('fs');
const path = require('path');
const twilio = require('twilio');

const client = twilio(process.env.TWILIO_SID, process.env.TWILIO_AUTH);

// LLM (shared sales persona)
const { generateResponse } = require('../agent/salesBot');
const { getMemory, upsertMemory } = require('../agent/memory');

const app = express();
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

const PORT = 3000;

// ---------------------------------------------------------
// FILES
// ---------------------------------------------------------
const EVENTS_FILE = path.resolve(__dirname, '../processed_leads/lead-events.json');
const SMS_HISTORY_FILE = path.resolve(__dirname, 'sms_history.json');

// ---------------------------------------------------------
// HELPERS
// ---------------------------------------------------------
function readJSON(file, fallback) {
    if (!fs.existsSync(file)) return fallback;
    try { return JSON.parse(fs.readFileSync(file, 'utf8')); }
    catch { return fallback; }
}

function writeJSON(file, data) {
    fs.writeFileSync(file, JSON.stringify(data, null, 2));
}

function emitEvent(leadId, type, payload = {}) {
    const events = readJSON(EVENTS_FILE, []);
    events.push({
        event_id: `evt_${Date.now()}`,
        lead_id: leadId,
        channel: 'SMS',
        type,
        timestamp: new Date().toISOString(),
        payload
    });
    writeJSON(EVENTS_FILE, events);
    console.log(`📡 EVENT → ${type}`);
}

function logSms(leadId, role, text) {
    const history = readJSON(SMS_HISTORY_FILE, {});
    if (!history[leadId]) history[leadId] = [];
    history[leadId].push({
        role,
        text,
        timestamp: new Date().toISOString()
    });
    writeJSON(SMS_HISTORY_FILE, history);
}

function getSmsHistory(leadId) {
    const history = readJSON(SMS_HISTORY_FILE, {});
    return history[leadId] || [];
}

// ---------------------------------------------------------
// INTENT CLASSIFICATION (STRICT, NON-DECISIONAL)
// ---------------------------------------------------------
function classifySmsIntent(text) {
    const t = text.toLowerCase();

    if (t.match(/stop|don’t message|do not contact|unsubscribe/))
        return 'SMS_USER_STOP';

    if (t.match(/not interested|no thanks|never/))
        return 'SMS_USER_NEGATIVE';

    if (t.match(/call me|let’s talk|phone call/))
        return 'SMS_USER_REQUEST_CALL';

    if (t.match(/email|mail me/))
        return 'SMS_USER_REQUEST_MAIL';

    if (t.match(/send details|whatsapp|info/))
        return 'SMS_USER_REQUEST_DETAILS';

    if (t.match(/later|busy|tomorrow|next week/))
        return 'SMS_USER_DELAYED';

    if (t.match(/yes|interested|sure|ok send/))
        return 'SMS_USER_INTERESTED';

    return 'SMS_USER_UNCLEAR';
}

// ---------------------------------------------------------
// SUMMARY GENERATION (END OF WINDOW)
// ---------------------------------------------------------
async function summarizeSms(leadId) {
    const history = getSmsHistory(leadId);
    if (!history.length) return;

    const transcript = history
        .slice(-10)
        .map(m => `${m.role.toUpperCase()}: ${m.text}`)
        .join('\n');

    const summaryPrompt = `
Summarize the following SMS conversation in 1–2 sentences.
Extract:
- intent
- objections (if any)
- requested next step

TRANSCRIPT:
${transcript}
`;

    try {
        const summary = await generateResponse({
            userMessage: 'SUMMARIZE',
            memory: { history: [{ type: 'system', content: summaryPrompt }] },
            mode: 'SMS_CHAT'
        });

        await upsertMemory(leadId, { last_sms_summary: summary });

        emitEvent(leadId, 'SMS_SUMMARY', { summary });
        console.log(`📝 SMS SUMMARY → ${summary}`);
    } catch (e) {
        console.error('❌ SMS summary failed');
    }
}

// ---------------------------------------------------------
// INBOUND SMS / WHATSAPP WEBHOOK
// ---------------------------------------------------------
app.post('/sms', async (req, res) => {
    const leadId = req.body.From;
    const incoming = (req.body.Body || '').trim();

    console.log(`📩 SMS INBOUND (${leadId}): "${incoming}"`);

    logSms(leadId, 'user', incoming);
    emitEvent(leadId, 'SMS_RECEIVED', { text: incoming });

    // Explicit intent outcome
    const intent = classifySmsIntent(incoming);
    emitEvent(leadId, intent, { text: incoming });

    // Hard stop
    if (intent === 'SMS_USER_STOP' || intent === 'SMS_USER_NEGATIVE') {
        await summarizeSms(leadId);
        return res.status(200).send('');
    }

    // LLM reply (human sales tone)
    const memory = await getMemory(leadId);
    const reply = await generateResponse({
        userMessage: incoming,
        memory,
        mode: 'SMS_CHAT'
    });

    console.log(`🤖 SMS AGENT: "${reply}"`);

    logSms(leadId, 'assistant', reply);
    emitEvent(leadId, 'SMS_SENT', { text: reply });

    // Respond via Twilio
    res.type('text/xml').send(
        new twilio.twiml.MessagingResponse()
            .message(reply)
            .toString()
    );
});

// ---------------------------------------------------------
// SILENCE TIMEOUT (CALLED BY ORCHESTRATOR ONLY)
// ---------------------------------------------------------
app.post('/sms/timeout', async (req, res) => {
    const leadId = req.body.lead_id;

    emitEvent(leadId, 'SMS_NO_RESPONSE_TIMEOUT');
    await summarizeSms(leadId);

    res.sendStatus(200);
});

// ---------------------------------------------------------
// START SERVER
// ---------------------------------------------------------
app.listen(PORT, () => {
    console.log(`🟢 SMS ENGINE RUNNING ON PORT ${PORT}`);
    console.log(`   Endpoint: POST /sms`);
});


// conversion-system/voice/voice_engine.js
// ---------------------------------------------------------
// VOICE ENGINE: OUTBOUND DIALER & STATUS MANAGER
// ---------------------------------------------------------

// conversion-system/voice/voice_engine.js
// ---------------------------------------------------------
// VOICE ENGINE: MASTER BATCH DIALER
// Combined Logic: Aggressive Filtering + Robust Status Management
// ---------------------------------------------------------

// conversion-system/voice/voice_engine.js
// ---------------------------------------------------------
// VOICE ENGINE: MASTER BATCH DIALER
// Features: Pre-Warming (Latency Fix) + Daytime Only + Aggressive Filtering
// ---------------------------------------------------------

/*
require('dotenv').config({ path: '../.env' });
const client = require('twilio')(process.env.TWILIO_SID, process.env.TWILIO_AUTH);
const axios = require('axios'); 
const fs = require('fs');
const path = require('path');

// ---------------------------------------------------------
// CONFIGURATION
// ---------------------------------------------------------
const LEADS_FILE = path.resolve(__dirname, '../processed_leads/clean_leads.json');
const SERVER_URL = process.env.SERVER_URL; 

// TIME SETTINGS (24-Hour Format)
const START_HOUR = 1;  // 9:00 AM
const END_HOUR = 20;   // 8:00 PM
const MAX_ATTEMPTS = 5; // Stop calling after 5 tries

// ---------------------------------------------------------
// HELPERS
// ---------------------------------------------------------
const getLeads = () => {
    if (!fs.existsSync(LEADS_FILE)) return [];
    try {
        const raw = fs.readFileSync(LEADS_FILE, 'utf8');
        const data = JSON.parse(raw);
        
        // CRITICAL FIX: Ensure we always return an Array
        if (Array.isArray(data)) return data;
        if (typeof data === 'object' && data !== null) return [data]; // Handle single object
        return [];
    } catch (e) {
        console.error("❌ Error reading leads file:", e.message);
        return [];
    }
};

const saveLeads = (data) => {
    try {
        fs.writeFileSync(LEADS_FILE, JSON.stringify(data, null, 2));
    } catch (e) {
        console.error("❌ Error saving leads file:", e.message);
    }
};

const isDaytime = () => {
    const currentHour = new Date().getHours();
    return currentHour >= START_HOUR && currentHour < END_HOUR;
};

const preWarmSystem = async () => {
    console.log("🔥 Pre-warming AI Brain...");
    try {
        await axios.post(`${SERVER_URL}/voice`, { CallSid: 'prewarm' }, { timeout: 5000 }).catch(() => {});
        console.log("✅ AI System Ready.");
    } catch (error) {
        console.log("⚠️  Warning: Pre-warm failed. Proceeding.");
    }
};

// ---------------------------------------------------------
// MAIN ENGINE
// ---------------------------------------------------------
const runVoiceBatch = async (targetLeads = null) => {
    console.log("\n🚀 Starting Smart Voice Engine...");

    if (!isDaytime()) {
        console.log(`🌙 Night Mode. Aborting. (Allowed: ${START_HOUR}-${END_HOUR})`);
        return;
    }

    if (!SERVER_URL || !fs.existsSync(LEADS_FILE)) return console.log("❌ Configuration Error.");

    await preWarmSystem();

    let leads = getLeads(); // Now guaranteed to be an array
    let leadsToCall = targetLeads;

    // ---------------------------------------------------------
    // SMART FILTERING LOGIC
    // ---------------------------------------------------------
    if (!leadsToCall) {
        const today = new Date().toISOString().split('T')[0];

        leadsToCall = leads.filter(l => {
            // 1. STATUS CHECK
            const validStatus = [
                "VERIFIED", 
                "CONTACTED", 
                "LEAD_FOLLOW_UP", 
                "LEAD_NEW",
                "PENDING"
            ].includes(l.status);

            // 2. TIMELINE CHECK (Is it due today?)
            const isDue = !l.next_action_due || l.next_action_due <= today;

            // 3. ATTEMPT CHECK (Safety limit)
            const isUnderLimit = (l.attempt_count || 0) < MAX_ATTEMPTS;

            // 4. DATA CHECK
            const hasPhone = l.phone && l.phone.length > 5;
            const isExcluded = l.status === "DO_NOT_CONTACT" || l.status === "INVALID_NUMBER" || l.status === "CALLED";

            return validStatus && isDue && isUnderLimit && hasPhone && !isExcluded;
        });
    }

    if (leadsToCall.length === 0) {
        console.log("⚠️  No actionable leads found (Checked Status, Date, & Attempts).");
        return;
    }

    console.log(`📞 Found ${leadsToCall.length} leads due for a call.`);

    // ---------------------------------------------------------
    // DIALING LOOP
    // ---------------------------------------------------------
    for (const lead of leadsToCall) {
        if (!isDaytime()) {
            console.log("🌙 Night Mode Triggered. Pausing.");
            break;
        }

        try {
            console.log(`\n☎️  Dialing: ${lead.name} (${lead.phone}) [Attempt ${lead.attempt_count || 0}]...`);

            const call = await client.calls.create({
                url: `${SERVER_URL}/voice`,
                to: lead.phone,
                from: process.env.TWILIO_PHONE,
                statusCallback: `${SERVER_URL}/voice/status`,
                statusCallbackEvent: ['initiated', 'ringing', 'answered', 'completed'],
                machineDetection: 'Enable'
            });

            console.log(`   ✅ Call Started! SID: ${call.sid}`);

            // IMMEDIATE DB UPDATE
            const freshLeads = getLeads();
            const idx = freshLeads.findIndex(l => l.phone === lead.phone);
            if (idx !== -1) {
                freshLeads[idx].status = "CALLED";
                freshLeads[idx].last_call_sid = call.sid; 
                freshLeads[idx].last_called = new Date().toISOString();
                freshLeads[idx].attempt_count = (freshLeads[idx].attempt_count || 0) + 1;
                
                // Bump next action to tomorrow
                const tomorrow = new Date();
                tomorrow.setDate(tomorrow.getDate() + 1);
                freshLeads[idx].next_action_due = tomorrow.toISOString().split('T')[0];

                saveLeads(freshLeads);
                console.log("   💾 DB Updated: Status=CALLED, Attempts+1, NextDue=Tomorrow");
            }

        } catch (error) {
            console.error(`   ❌ Failed: ${error.message}`);
            if (error.code === 21211) { 
                const freshLeads = getLeads();
                const idx = freshLeads.findIndex(l => l.phone === lead.phone);
                if (idx !== -1) {
                    freshLeads[idx].status = "INVALID_NUMBER";
                    saveLeads(freshLeads);
                }
            }
        }

        await new Promise(resolve => setTimeout(resolve, 5000));
    }

    console.log("\n🏁 Voice Batch Complete.");
};

module.exports = { runVoiceBatch };

if (require.main === module) {
    runVoiceBatch();
}
    */
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
// FILES
// ---------------------------------------------------------

var CONVO_DIR = path.resolve(__dirname, '../processed_calls');
var EVENTS_FILE = path.resolve(__dirname, '../processed_leads/lead-events.json');
if (!fs.existsSync(CONVO_DIR)) fs.mkdirSync(CONVO_DIR, {
  recursive: true
});
if (!fs.existsSync(EVENTS_FILE)) fs.writeFileSync(EVENTS_FILE, '[]'); // ---------------------------------------------------------
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
// GENERAL OPENING PROMPT (SPOKEN FIRST)
// ---------------------------------------------------------


var OPENING_PROMPT = "\nHi, this is Vijay calling from Hivericks.\n\nI noticed that you recently visited our product, Xoptimus.\nI just wanted to check if now is a good time to have a quick conversation about it.\nYou can speak naturally.\n".trim(); // ---------------------------------------------------------
// PRE-WARM ENDPOINT (CALLED BY DIALER)
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
          logTurn(callSid, 'assistant', OPENING_PROMPT.trim()); // Speak opening + start gather

          twiml.say({
            voice: 'alice'
          }, OPENING_PROMPT);
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
// USER SPEECH HANDLER
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

          twiml.say("Sorry, I didn't catch that.");
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
          twiml.say({
            voice: 'alice'
          }, reply);
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
// CALL STATUS CALLBACK — SUMMARY ONLY
// ---------------------------------------------------------

app.post('/voice/status', function _callee3(req, res) {
  var _req$body, CallSid, CallStatus, convo, transcript, summaryPrompt, summary, events;

  return regeneratorRuntime.async(function _callee3$(_context3) {
    while (1) {
      switch (_context3.prev = _context3.next) {
        case 0:
          _req$body = req.body, CallSid = _req$body.CallSid, CallStatus = _req$body.CallStatus;

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
          events = readJSON(EVENTS_FILE, []);
          events.push({
            event_id: "evt_".concat(Date.now()),
            channel: 'VOICE',
            call_sid: CallSid,
            type: 'CALL_SUMMARY',
            timestamp: new Date().toISOString(),
            payload: {
              summary: summary
            }
          });
          writeJSON(EVENTS_FILE, events);
          console.log("\uD83D\uDCDD CALL SUMMARY SAVED \u2192 ".concat(CallSid));
          _context3.next = 21;
          break;

        case 18:
          _context3.prev = 18;
          _context3.t0 = _context3["catch"](8);
          console.error('❌ Call summary failed');

        case 21:
          res.sendStatus(200);

        case 22:
        case "end":
          return _context3.stop();
      }
    }
  }, null, null, [[8, 18]]);
}); // ---------------------------------------------------------
// START SERVER
// ---------------------------------------------------------

app.listen(PORT, function () {
  console.log("\uD83D\uDFE2 VOICE CALL SERVER RUNNING ON PORT ".concat(PORT));
});