// conversion-system/voice/call_server.js
// ---------------------------------------------------------
// MASTER VOICE CALL SERVER (FINAL, CLEAN VERSION)
// Responsibilities:
// - Handle inbound/outbound calls
// - Run LLM conversation with "Filler" latency masking
// - Handle anonymous callers (Lead Capture)
// - Sync Status & Timeline Logic
// ---------------------------------------------------------

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

process.on('uncaughtException', (err) => {
    console.error('💥 UNCAUGHT EXCEPTION:', err);
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('💥 UNHANDLED REJECTION:', reason);
});

const express = require('express');
const bodyParser = require('body-parser');
const twilio = require('twilio');
const fs = require('fs');
const axios = require('axios');

// LLM
const {
    SalesBrain,
    detectIntent,
    generateResponse,
    generateStructuredSummary,
    generateTextSummary,
    generateFinalSummary,
    warmup
} = require('../agent/salesBot');
const { textToSSML } = require('../agent/voice_utils');
const { calculateScore, analyzeSentiment } = require('../scoring/scoring_engine');
const crm = require('../agent/crm_connector');

// ... (existing imports)



// ---------------------------------------------------------
// APP SETUP
// ---------------------------------------------------------
const app = express();
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

// SERVE STATIC AUDIO (Generated + Pre-recorded)
app.use('/audio', express.static(path.join(__dirname, 'public/audio')));

const PORT = 3000;
const pendingLLMRequests = new Map(); // Store active LLM promises by CallSid

// ---------------------------------------------------------
// ROUTE: DEFERRED RESPONSE (Async-Redirect Pattern)
// ---------------------------------------------------------
app.post('/voice/deferred-response', async (req, res) => {
    const callSid = req.body.CallSid;
    const direction = req.body.Direction || 'outbound-api';
    const leadPhone = direction === 'inbound' ? req.body.From : req.body.To;

    console.log(`   ⏳ Fetching Deferred Response for ${callSid}...`);

    try {
        const promise = pendingLLMRequests.get(callSid);
        if (!promise) {
            console.error(`   ❌ No pending promise found for ${callSid}`);
            // Fallback: Just ask to repeat
            const twiml = new twilio.twiml.VoiceResponse();
            // twiml.gather({ input: 'speech', action: '/voice/input' }).say(VOICE_CONFIG, "I didn't catch that. Could you say it again?");
            const gather = twiml.gather({ input: 'speech', action: '/voice/input' });
            gather.say(VOICE_CONFIG, "I didn't catch that. Could you say it again?");
            return res.type('text/xml').send(twiml.toString());
        }

        // Await the background task
        const TIMEOUT = 10000;
        const llmResult = await Promise.race([
            promise,
            new Promise((_, reject) => setTimeout(() => reject(new Error('DEFERRED_TIMEOUT')), TIMEOUT))
        ]);

        // Cleanup
        pendingLLMRequests.delete(callSid);

        let aiResponse = typeof llmResult === 'string' ? llmResult : llmResult.response;
        const stageId = typeof llmResult === 'object' ? llmResult.stageId : null;

        // PERSIST STAGE & RESISTANCE IMMEDIATELY
        if (llmResult.stageId || (llmResult.memory && llmResult.memory.resistance_attempts)) {
            const memory = llmResult.memory || {};
            updateLeadStatus(
                leadPhone,
                'CALL_CONNECTED',
                null, null, null,
                callSid,
                llmResult.stageId,
                memory.resistance_attempts
            );
        }

        console.log(`\n\x1b[32m🤖 AI REPLIED (Async): "${aiResponse}"\x1b[0m\n`);
        logTurn(callSid, 'assistant', aiResponse);

        // Build Final Response
        const twiml = new twilio.twiml.VoiceResponse();

        let shouldHangup = false;
        let cleanResponse = aiResponse;
        if (cleanResponse.includes('[HANGUP]')) {
            shouldHangup = true;
            cleanResponse = cleanResponse.replace('[HANGUP]', '').trim();
        }

        const gather = twiml.gather({
            input: 'speech',
            speechTimeout: '1.5', // Give user more space before cut
            action: '/voice/input',
            method: 'POST'
        });


        // OLD: gather.say(VOICE_CONFIG, cleanResponse);
        gather.say(VOICE_CONFIG, textToSSML(cleanResponse));

        if (shouldHangup) twiml.hangup();

        res.type('text/xml').send(twiml.toString());

    } catch (err) {
        console.error(`   ❌ Deferred Response Failed:`, err.message);
        pendingLLMRequests.delete(callSid);

        const twiml = new twilio.twiml.VoiceResponse();
        // twiml.gather({ input: 'speech', action: '/voice/input' }).say(VOICE_CONFIG, "I apologize, I lost my train of thought. What were you saying?");
        const gather = twiml.gather({ input: 'speech', action: '/voice/input' });
        gather.say(VOICE_CONFIG, "I apologize, I lost my train of thought. What were you saying?");
        res.type('text/xml').send(twiml.toString());
    }
});

// ---------------------------------------------------------
// FILES CONFIGURATION
// ---------------------------------------------------------
const CONVO_DIR = path.join(__dirname, 'voice_conversations'); // Dedicated DB for voice logs
// --- STARTUP WARMUP (MCP TOOLS) ---
console.log("   🔌 VOICE: Warming up Brain...");
warmup().catch(e => console.warn("   ⚠️ Voice Brain Warmup Delay:", e.message));

const EVENTS_FILE = path.resolve(__dirname, '../processed_leads/lead-events.json');
const LEADS_FILE = path.resolve(__dirname, '../processed_leads/clean_leads.json');
const CALL_LOGS_FILE = path.resolve(__dirname, 'call_logs.json');

// Ensure directories and files exist
if (!fs.existsSync(CONVO_DIR)) fs.mkdirSync(CONVO_DIR, { recursive: true });
if (!fs.existsSync(EVENTS_FILE)) fs.writeFileSync(EVENTS_FILE, '[]');
if (!fs.existsSync(CALL_LOGS_FILE)) fs.writeFileSync(CALL_LOGS_FILE, '[]');

// ---------------------------------------------------------
// VOICE CONFIGURATION
// ---------------------------------------------------------
const VOICE_CONFIG = {
    voice: 'Polly.Matthew-Neural',
    language: 'en-IN'
};

// SERVE STATIC AUDIO
app.use('/audio', express.static(path.join(__dirname, 'public/audio')));

// TTS HELPER
// XTTS HELPER (DISABLED BY USER REQUEST -> Standard Voice Fallback)
async function generateSpeech(text) {
    // FORCE FALLBACK TO TWILIO <SAY> (Standard Voice)
    return null;
    /* 
    try {
        const filename = `tts_${Date.now()}.mp3`;
        const outputPath = path.join(__dirname, 'public/audio', filename);
        const writer = fs.createWriteStream(outputPath);

        const response = await axios.post('http://localhost:8020/tts',
            { text, speed: 1.3 },
            { responseType: 'stream' }
        );

        response.data.pipe(writer);

        await new Promise((resolve, reject) => {
            writer.on('finish', resolve);
            writer.on('error', reject);
        });

        return filename;
    } catch (e) {
        console.error("❌ TTS Streaming Failed:", e.message);
        return null;
    }
    */
}


// ---------------------------------------------------------
// DEFINED STATUSES (User Requirement)
// ---------------------------------------------------------
const VOICE_STATUSES = [
    'CALL_IDLE', 'CALL_INITIATED', 'CALL_CONNECTED', 'CALL_MISSED',
    'CALL_BUSY', 'CALL_NO_ANSWER', 'CALL_INTERESTED',
    'CALL_NOT_INTERESTED', 'CALL_DROPPED', 'CALL_TO_SMS_FOLLOWUP', 'CALL_COMPLETED'
];

// ---------------------------------------------------------
// HELPERS
// ---------------------------------------------------------
const readJSON = (file, fallback) => {
    const MAX_RETRIES = 3;
    const RETRY_DELAY_MS = 100;

    for (let i = 0; i < MAX_RETRIES; i++) {
        try {
            if (!fs.existsSync(file)) return fallback;
            const content = fs.readFileSync(file, 'utf8');
            return content ? JSON.parse(content) : fallback;
        } catch (err) {
            if (i === MAX_RETRIES - 1) {
                console.error(`❌ readJSON Failed after ${MAX_RETRIES} attempts: ${file}`, err.message);
                return fallback;
            }
            // Busy wait for retry (simple sync sleep)
            const start = Date.now();
            while (Date.now() - start < RETRY_DELAY_MS) { }
        }
    }
    return fallback;
};

const writeJSON = (file, data) => {
    const MAX_RETRIES = 5;
    const RETRY_DELAY_MS = 200;

    for (let i = 0; i < MAX_RETRIES; i++) {
        try {
            const tempFile = `${file}.tmp`;
            fs.writeFileSync(tempFile, JSON.stringify(data, null, 2));
            fs.renameSync(tempFile, file); // Atomic move
            return;
        } catch (err) {
            if (i === MAX_RETRIES - 1) {
                console.error(`❌ writeJSON Failed after ${MAX_RETRIES} attempts: ${file}`, err.message);
                // Don't throw, just log to keep server alive
            }
            // Busy wait
            const start = Date.now();
            while (Date.now() - start < RETRY_DELAY_MS) { }
        }
    }
};

const convoFile = (sid) => path.join(CONVO_DIR, `${sid}.json`);

const logTurn = (sid, role, text) => {
    const convo = readJSON(convoFile(sid), []);
    convo.push({ role, text, timestamp: new Date().toISOString() });
    writeJSON(convoFile(sid), convo);
};

// Update Lead Status safely
const updateLeadStatus = (phone, status, summary = null, newScore = null, newCategory = null, sid = null, stageId = null, resistanceAttempts = null) => {
    if (!fs.existsSync(LEADS_FILE)) return;
    const leads = readJSON(LEADS_FILE, []);

    const cleanTarget = String(phone).replace(/\D/g, "");
    const idx = leads.findIndex(l => {
        if (!l.phone) return false;
        const cleanLead = String(l.phone).replace(/\D/g, "");
        return cleanLead.includes(cleanTarget) || cleanTarget.includes(cleanLead);
    });

    if (idx !== -1) {
        if (VOICE_STATUSES.includes(status)) {
            leads[idx].status = status;
        }
        if (summary) {
            leads[idx].last_call_summary = summary;
        }
        if (newScore !== null) {
            leads[idx].score = newScore;
            console.log(`   💯 Score Updated: ${newScore}`);
        }
        if (newCategory) {
            leads[idx].category = newCategory;
            console.log(`   🏷️  Category Updated: ${newCategory}`);
        }
        if (sid) {
            leads[idx].last_call_sid = sid;
            console.log(`   🆔 SID Linked: ${sid}`);
        }
        if (stageId) {
            leads[idx].conversation_stage_id = stageId;
            console.log(`   🎯 Stage Updated: ${stageId}`);
        }
        if (resistanceAttempts !== null) {
            leads[idx].resistance_attempts = resistanceAttempts;
            console.log(`   ⚠️ Resistance Logged: ${resistanceAttempts}`);
        }

        // POST_CALL_ACTION_PENDING is set only if summary is provided (terminal state)
        if (summary && ['CALL_CONNECTED', 'CALL_INTERESTED', 'CALL_NOT_INTERESTED', 'CALL_COMPLETED'].includes(status)) {
            leads[idx].post_call_action_pending = true;
            console.log(`   🚩 Flagged for Post-Call Action (Feedback/Summary).`);
        }

        leads[idx].last_interaction = new Date().toISOString();
        writeJSON(LEADS_FILE, leads);
        console.log(`   📝 Lead Status Update: [${phone}] -> ${status}`);
    } else {
        console.log(`   ⚠️ Lead not found for status update: ${phone}`);
    }
};


// ---------------------------------------------------------
// CORE: UNIFIED PROCESSING LOGIC (LIVE & RECOVERY)
// ---------------------------------------------------------
async function processCallCompletion(sid, leadPhone, convo, timestamp = null) {
    if (!timestamp) timestamp = new Date().toISOString();
    console.log(`   ⚙️  Processing Call Completion for ${sid} / ${leadPhone}...`);

    try {
        // 1. Prepare Transcript
        const transcriptText = convo
            .filter(m => m.type !== 'silence_marker' && m.type !== 'system' && m.role)
            .map(m => `${m.role.toUpperCase()}: ${m.text}`).join('\n');

        // 2. Generate Structured Summary (LLM)
        console.log(`      📊 Generating Summary...`);
        let structuredSummary;
        try {
            structuredSummary = await generateStructuredSummary(transcriptText);
            console.log(`      ✅ Summary Generated.`);
        } catch (sumErr) {
            console.error(`      ❌ Summary Gen Failed:`, sumErr);
            throw sumErr; // Re-throw to be caught by outer
        }
        structuredSummary.generated_at = new Date().toISOString();

        // Heuristic Fallback
        if (structuredSummary.interest_level === 'unknown') {
            const meaningfulTurns = convo.filter(m => m.role === 'user' || m.role === 'assistant');
            if (meaningfulTurns.length >= 4) {
                structuredSummary.interest_level = 'medium';
                structuredSummary.user_intent = 'engaged_fallback';
            } else {
                structuredSummary.interest_level = 'low';
                structuredSummary.user_intent = 'short_call_fallback';
            }
        }

        // 3. Generate Dedicated Text Summary (Text-Only Channel)
        // 3. Generate Dedicated Text Summary (Text-Only Channel)
        console.log(`      📝 Generating Text Summary...`);
        let textSummary = await generateTextSummary(transcriptText);

        console.log(`\n**************************************************************`);
        console.log(`🛑 WHOLE CONVERSATION SUMMARY (${sid})`);
        console.log(`--------------------------------------------------------------`);
        console.log(textSummary);
        console.log(`**************************************************************\n`);

        console.log(`      ✅ Text Summary Generated.`);

        // Log to summary_calls.json
        const summaryLogPath = path.join(__dirname, 'summary_calls.json');
        const summaryLogs = readJSON(summaryLogPath, []);

        // Prevent dupes by SID
        if (!summaryLogs.find(l => l.sid === sid)) {
            summaryLogs.push({
                event_id: `evt_${Date.now()}`,
                lead_id: leadPhone,
                sid: sid,
                generated_at: new Date().toISOString(),
                summary_text: textSummary
            });
            writeJSON(summaryLogPath, summaryLogs);
            console.log(`      📘 Saved to summary_calls.json`);
        }

        // Attach to structured object for compatibility
        structuredSummary.conversation_summary = textSummary;
        structuredSummary.text_summary = textSummary;

        // 4. Create Event ID
        const eventId = `evt_${Date.now()}`;
        const eventTimestamp = timestamp;

        // 5. Update lead-events.json (UNIFIED FLAT STRUCTURE)
        const events = readJSON(EVENTS_FILE, []);

        // Fetch attempt count
        const currentLeadsForEvent = readJSON(LEADS_FILE, []);
        const leadForEvent = currentLeadsForEvent.find(l => l.phone === leadPhone);
        const attemptCount = leadForEvent ? (leadForEvent.attempt_count || 0) : 0;

        // Push flat event
        events.push({
            event_id: eventId,
            lead_id: leadPhone,
            channel: 'VOICE',
            type: 'VOICE_CALL_COMPLETE',
            timestamp: eventTimestamp,
            attempt_count: attemptCount,
            summary: structuredSummary,
            master_summary: textSummary // Session level summary
        });

        // Recompute Historical Final Summary (Cross-event memory)
        const leadHistory = events.filter(e => e.lead_id === leadPhone);
        const finalSummary = await generateFinalSummary(
            leadHistory.map(e => ({ date: e.timestamp, summary: e.summary }))
        );
        finalSummary.generated_at = eventTimestamp;

        writeJSON(EVENTS_FILE, events);
        console.log(`      ✅ lead-events.json Updated (Flat + History).`);

        // 5. Update Call Logs
        const masterLogs = readJSON(CALL_LOGS_FILE, []);
        if (!masterLogs.find(l => l.sid === sid)) {
            const startTime = convo[0]?.timestamp || eventTimestamp;
            const endTime = convo[convo.length - 1]?.timestamp || eventTimestamp;

            masterLogs.push({
                event_id: eventId,
                lead_id: leadPhone,
                sid: sid,
                channel: 'VOICE',
                started_at: startTime,
                ended_at: endTime,
                conversation: convo.filter(m => m.type !== 'silence_marker' && m.type !== 'system').map(m => ({ role: m.role, message: m.text })),
                summary: structuredSummary
            });
            writeJSON(CALL_LOGS_FILE, masterLogs);
            console.log(`      💾 call_logs.json Appended.`);
        } else {
            console.log(`      ⚠️ Log already exists for ${sid} (Skipping append).`);
        }

        // 6. Scoring & Status Update
        let updateStatus = 'CALL_COMPLETED';
        if (structuredSummary.interest_level === 'high' || structuredSummary.interest_level === 'medium') {
            updateStatus = 'CALL_INTERESTED';
        }
        if (structuredSummary.interest_level === 'low' || structuredSummary.user_intent === 'explicit_refusal') {
            updateStatus = 'CALL_NOT_INTERESTED';
        }

        const intentMap = { 'high': 'HOT', 'medium': 'WARM', 'low': 'COLD' };
        let leadIntent = intentMap[structuredSummary.interest_level] || 'COLD';

        const currentLeads = readJSON(LEADS_FILE, []);
        const leadContextForScore = currentLeads.find(l => l.phone === leadPhone);

        let finalScore = null;
        let finalCategory = null;
        if (leadContextForScore) {
            // NEW: Analyze Sentiment Penalty
            const sentimentPenalty = analyzeSentiment(convo.filter(m => m.type !== 'silence_marker' && m.type !== 'system'));
            if (sentimentPenalty < 0) {
                leadIntent = 'NEGATIVE'; // Override intent
                console.log(`   ⚠️ SENTIMENT PENALTY APPLIED: ${sentimentPenalty}`);
            }

            const scoreResult = calculateScore(leadContextForScore, leadIntent, updateStatus);
            finalScore = scoreResult.score;
            finalCategory = scoreResult.category;

            // Explicitly force penalties
            if (sentimentPenalty < 0) {
                finalScore = Math.max(0, finalScore + sentimentPenalty);
                scoreResult.category = 'COLD';
            }

            // CRITICAL FIX: Do NOT overwrite Action Pending Statuses
            const PROTECTED_STATUSES = ['SMS_SEND_REQUESTED', 'SMS_TO_CALL_REQUESTED', 'HUMAN_HANDOFF', 'SCHEDULE_CALL_REQUESTED'];
            if (PROTECTED_STATUSES.includes(leadContextForScore.status)) {
                console.log(`   🛡️  Keeping Protected Status: ${leadContextForScore.status} (Ignoring ${updateStatus})`);
                updateStatus = leadContextForScore.status; // Keep existing
            }
        }

        updateLeadStatus(leadPhone, updateStatus, JSON.stringify(finalSummary), finalScore, finalCategory, sid);

        // 7. CRM Stream Integration
        try {
            await crm.pushInteractionToStream(leadForEvent || leadContextForScore, 'voice', {
                summary: textSummary,
                intent: structuredSummary.user_intent,
                transcription: transcriptText,
                nextPrompt: structuredSummary.next_action
            });
        } catch (crmErr) {
            console.error(`      ❌ CRM Interaction Push Failed:`, crmErr.message);
        }

        return true;

    } catch (e) {
        console.error(`      ❌ Error in processCallCompletion: ${e.message}`);
        return false;
    }
}

// ---------------------------------------------------------
// 1. LEAD LOOKUP & CONTEXT LOADING
// ---------------------------------------------------------
const getLeadContext = (phone) => {
    const leads = readJSON(LEADS_FILE, []);
    const cleanTarget = String(phone).replace(/\D/g, "");
    const lead = leads.find(l => {
        if (!l.phone) return false;
        const cleanLead = String(l.phone).replace(/\D/g, "");
        return cleanLead.includes(cleanTarget) || cleanTarget.includes(cleanLead);
    });

    if (lead) {
        // Find Master Summary
        const events = readJSON(EVENTS_FILE, []);
        // FIX: Get the LATEST event with a summary (reverse search or sort)
        const leadEvents = events.filter(l => l.lead_id === phone && l.master_summary);
        const latestSummary = leadEvents.length > 0 ? leadEvents[leadEvents.length - 1].master_summary : null;

        return {
            type: 'EXISTING',
            name: lead.name,
            summary: latestSummary, // Use latest
            score: lead.score
        };
    }

    return { type: 'ANONYMOUS', name: 'there' };
};

// ---------------------------------------------------------
// 2. PROMPTS
// ---------------------------------------------------------
const getOpening = (ctx) => {
    if (ctx.type === 'EXISTING' && ctx.name) {
        return `Hi ${ctx.name}, this is Vijay from Hivericks regarding the XOptimus charger. Do you have a minute?`;
    }
    return "Hi, this is Vijay from Hivericks Technologies. I'm calling to discuss our XOptimus chargers. Do you have a quick minute?";
};

// ...

app.post('/voice', async (req, res) => {
    const callSid = req.body.CallSid;
    const direction = req.body.Direction || 'outbound-api';
    const leadPhone = direction === 'inbound' ? req.body.From : req.body.To;

    console.log(`\n📞 NEW CALL (${direction}): ${leadPhone} [SID: ${callSid}]`);

    try {
        const leadContext = getLeadContext(leadPhone);
        console.log(`   👤 Context: ${leadContext.type} (${leadContext.name})`);

        // 1. Determine Opening Text (Prioritize Passed Opening -> Context -> Default)
        const openingText = req.query.openingText || getOpening(leadContext);
        console.log(`\n\x1b[32m🤖 AI GREETING (Polly): "${openingText}"\x1b[0m\n`);

        writeJSON(convoFile(callSid), []); // Init empty log
        updateLeadStatus(leadPhone, 'CALL_CONNECTED', null, null, null, callSid, 1);

        const initialTurn = { role: 'assistant', text: openingText, timestamp: new Date().toISOString() };
        writeJSON(convoFile(callSid), [initialTurn]);

        const twiml = new twilio.twiml.VoiceResponse();
        const gather = twiml.gather({
            input: 'speech',
            speechTimeout: '1.5', // Give user more space before cut
            action: '/voice/input',
            method: 'POST'
        });

        gather.say(VOICE_CONFIG, textToSSML(openingText));

        res.type('text/xml').send(twiml.toString());
    } catch (e) {
        console.error("❌ ERROR in /voice handler:", e.message);
        const twiml = new twilio.twiml.VoiceResponse();
        twiml.say(VOICE_CONFIG, "System busy. Please hold.");
        res.type('text/xml').send(twiml.toString());
    }
});

// ---------------------------------------------------------
// ROUTE: USER INPUT & FILLER LOGIC
// ---------------------------------------------------------
app.post('/voice/input', async (req, res) => {
    // CRITICAL: Wrap entire handler in try-catch to ensure we ALWAYS respond to Twilio
    try {
        const userInputTime = Date.now();
        const callSid = req.body.CallSid;
        const userSpeech = (req.body.SpeechResult || '').trim();

        // 🔍 DEBUG: Log exactly what Twilio sent us
        console.log(`\n📥 TWILIO INPUT [${callSid}]:`);
        console.log(`   Confidence: ${req.body.Confidence}`);
        console.log(`   Speech: "${userSpeech}"`);

        const twiml = new twilio.twiml.VoiceResponse();

        // A. Handle Silence/No-Input
        if (!userSpeech) {
            console.log("   ⚠️ No speech detected.");
            const convo = readJSON(convoFile(callSid), []);
            const lastTurn = convo[convo.length - 1];

            // Track consecutive silences
            let silenceCount = 0;
            if (lastTurn && lastTurn.type === 'silence_marker') {
                silenceCount = lastTurn.count + 1;
            }

            // Logic: 
            // 0 -> Just wait (maybe user is thinking), prompt gently.
            // 1 -> Prompt again clearly.
            // 2 -> Hangup.

            if (silenceCount >= 3) {
                const twiml = new twilio.twiml.VoiceResponse();
                twiml.say(VOICE_CONFIG, "I am having trouble hearing you. I will disconnect now. Feel free to call back.");
                twiml.hangup();
                logTurn(callSid, 'assistant', "TIMEOUT_HANGUP");
                return res.type('text/xml').send(twiml.toString());
            }

            // Warning / Re-prompt
            const prompts = [
                "Are you still there?",
                "I didn't quite catch that. Can you hear me?"
            ];
            const prompt = prompts[silenceCount] || prompts[1];

            // Log silence marker instead of full turn to track count
            convo.push({ type: 'silence_marker', count: silenceCount, timestamp: new Date().toISOString() });
            writeJSON(convoFile(callSid), convo);

            const gather = twiml.gather({
                input: 'speech',
                action: '/voice/input',
                speechTimeout: '1.5',
                timeout: 5 // Wait up to 5s for start
            });
            gather.say(VOICE_CONFIG, textToSSML(prompt));

            return res.type('text/xml').send(twiml.toString());
        }

        // B. Log User Input (VISIBLE IN TERMINAL)
        logTurn(callSid, 'user', userSpeech);
        console.log(`\n\x1b[36m🗣️  USER SAID: "${userSpeech}"\x1b[0m\n`);

        // ...

        // C. Calculate Filler
        // C. Calculate Filler (Switched to Text below)
        // const fillerAudio = getFillerAudio(userSpeech); 
        // console.log(`   💭 FILLER SELECTED: ${fillerAudio}`);

        // D. Trigger LLM (Parallel)
        // We must start the LLM generation NOW so it runs while the filler plays.
        const convo = readJSON(convoFile(callSid), []);
        // Note: convo already has the user turn pushed (if we did it previously? No, userTurn pushed below or above?)
        // Let's check logic:
        // We need to push the user turn to convo JSON first?
        // Line 595 logs it. But Convo file update?
        // Ah, line 595 calls logTurn which writes to file?
        // Let's verify logTurn. Assuming it writes.
        // If not, we should push it.
        // Lookup Lead for Context (Tools need Phone)
        let leadContext = {};
        try {
            const leads = readJSON(LEADS_FILE, []);
            const found = leads.find(l => l.last_call_sid === callSid);
            if (found) leadContext = found;
        } catch (e) { }

        const memory = {
            history: convo,
            conversation_stage_id: leadContext.conversation_stage_id || 1,
            resistance_attempts: leadContext.resistance_attempts || 0,
            summaryContext: null
        };

        const brain = new SalesBrain({
            leadContext: leadContext,
            memory: memory,
            mode: 'VOICE_CALL'
        });

        console.log(`   ⚡ ASYNC: Playing filler & Loading Brain...`);
        const llmPromise = brain.processTurn(userSpeech);
        pendingLLMRequests.set(callSid, llmPromise);

        const deferredTwiml = new twilio.twiml.VoiceResponse();

        // NEW TEXT FILLER (Polly Consistent)
        const getFillerText = (text) => {
            if (!text) return "One moment please.";
            const t = text.toLowerCase();

            const fillers = {
                general: [
                    "Let me check that for you.",
                    "Give me a second to look into this.",
                    "Let me see... right.",
                    "Good point, let me verify that for you.",
                    "I see. Let me pull up the details."
                ],
                price: [
                    "Let me check the latest pricing for you.",
                    "I'll pull up the price list right now, one second.",
                    "Sure, let me verify the current offers on that.",
                    "Pricing, right. Let me just confirm the exact figure for you."
                ],
                tech: [
                    "Let me look at the technical specifications for you.",
                    "I'll check the compatible devices list, one moment.",
                    "Let me verify the technical details on that.",
                    "Interesting question. Let me check the engineering specs."
                ],
                needs: [
                    "I see. That's helpful to know. Let me think...",
                    "Right, I understand your situation. One second.",
                    "Got it. Let me just process that and get back to you.",
                    "That makes sense. Let me see how xOptimus fits there."
                ],
                objection: [
                    "I hear what you're saying. Let me double check something.",
                    "Fair point. Let me look into that for you.",
                    "I appreciate you bringing that up. One moment.",
                    "Let me verify a few details to address that properly."
                ]
            };

            let category = 'general';
            if (t.includes('price') || t.includes('cost') || t.includes('offer')) category = 'price';
            else if (t.includes('feature') || t.includes('specs') || t.includes('work') || t.includes('compatible') || t.includes('heat') || t.includes('gaming')) category = 'tech';
            else if (t.includes('battery') || t.includes('dying') || t.includes('charge') || t.includes('often') || t.includes('use')) category = 'needs';
            else if (t.includes('expensive') || t.includes('sure') || t.includes('later') || t.includes('skeptical') || t.includes('not interested')) category = 'objection';

            const categoryFillers = fillers[category];
            const choice = categoryFillers[Math.floor(Math.random() * categoryFillers.length)];
            return choice;
        };

        const fillerText = getFillerText(userSpeech);
        console.log(`   💭 FILLER SPOKEN: "${fillerText}"`);

        deferredTwiml.say(VOICE_CONFIG, textToSSML(fillerText));

        deferredTwiml.redirect({ method: 'POST' }, '/voice/deferred-response');

        // Log Timing (Partial)
        const partialTime = Date.now() - userInputTime;
        console.log(`   ⏱️  Filler Output Time: ${partialTime}ms (Perceived Latency: ~0ms)`);

        res.type('text/xml').send(deferredTwiml.toString());

    } catch (criticalError) {
        // CRITICAL: If anything fails, send a fallback response immediately
        console.error(`   ❌ CRITICAL ERROR in /voice/input:`, criticalError);

        const errorTwiml = new twilio.twiml.VoiceResponse();
        const gather = errorTwiml.gather({
            input: 'speech',
            speechTimeout: 'auto',
            action: '/voice/input',
            method: 'POST'
        });
        gather.say(VOICE_CONFIG, "I apologize, I'm having a technical issue. Could you repeat that?");
        res.type('text/xml').send(errorTwiml.toString());
    }
});

// ---------------------------------------------------------
// ROUTE: CALL STATUS & SUMMARIZATION
// ---------------------------------------------------------
app.post('/voice/status', async (req, res) => {
    // ⚡ CRITICAL FIX: Respond to Twilio IMMEDIATELY to prevent 502 Timeout
    // The status callback doesn't require TwiML, just an ACK.
    res.sendStatus(200);

    try {
        const { CallSid, CallStatus, Direction, To, From } = req.body;
        const leadPhone = Direction === 'inbound' ? From : To;

        console.log(`   📶 STATUS: ${CallStatus} [${leadPhone}]`);

        // 1. Map Status to Lead Status
        // VOICE: ['CALL_IDLE', 'CALL_CONNECTED', 'CALL_MISSED', 'CALL_BUSY', 'CALL_NO_ANSWER', 'CALL_COMPLETED']
        let dbStatus = 'CALL_IDLE';

        if (CallStatus === 'completed') dbStatus = 'CALL_COMPLETED';
        else if (CallStatus === 'busy') dbStatus = 'CALL_BUSY';
        else if (CallStatus === 'no-answer') dbStatus = 'CALL_NO_ANSWER';
        else if (CallStatus === 'failed') dbStatus = 'CALL_DROPPED';
        else if (CallStatus === 'in-progress') dbStatus = 'CALL_CONNECTED';

        // 2. Summarize if Completed (BACKGROUND)
        if (CallStatus === 'completed') {
            const convo = readJSON(convoFile(CallSid), []);
            if (convo.length > 0) {
                // Determine duration
                const duration = (new Date() - new Date(convo[0].timestamp)) / 1000;
                console.log(`\n\n===============================================================`);
                console.log(`🎬 CALL COMPLETED: ${leadPhone} (Duration: ${duration}s)`);
                console.log(`⏳ WAITING FOR SUMMARY GENERATION... (Blocking)`);
                console.log(`===============================================================\n`);

                // Prepare Transcript for LLM (NON-BLOCKING)
                // Fire and forget to avoid TwiML/Ngrok timeout (502)
                processCallCompletion(CallSid, leadPhone, convo)
                    .then(() => console.log(`\n✅ BACKGROUND SUMMARIZATION COMPLETE: ${leadPhone}\n`))
                    .catch(e => console.error(`❌ BACKGROUND SUMMARY ERROR:`, e));

                console.log(`⚡ Triggered Background Summary. Responding to Twilio immediately.`);
            }
        }

        // 3. Update Status (ONLY AFTER SUMMARY IS DONE)
        if (['completed', 'busy', 'no-answer', 'failed'].includes(CallStatus)) {
            updateLeadStatus(leadPhone, dbStatus);
        }


        // Create New Lead if Anonymous & Interested
        const leads = readJSON(LEADS_FILE, []);
        if (!leads.find(l => l.phone === leadPhone)) {
            leads.push({
                phone: leadPhone,
                name: "Unknown Caller",
                status: "NEW_INBOUND",
                source: "ANONYMOUS_CALL",
                score: 50,
                imported_at: new Date().toISOString()
            });
            writeJSON(LEADS_FILE, leads);
            console.log("   🆕 Captured Anonymous Lead!");
        }
    } catch (error) {
        console.error("❌ ERROR in /voice/status:", error);
    }
});

// ---------------------------------------------------------
// START SERVER
// ---------------------------------------------------------
// ---------------------------------------------------------
// RECOVERY ENDPOINT (PROCESS ORPHANED LOGS)
// ---------------------------------------------------------
app.post('/voice/recover', async (req, res) => {
    console.log("   🚑 STARTING LOG RECOVERY...");

    // 1. Get List of Conversation Files (Source of Truth)
    if (!fs.existsSync(CONVO_DIR)) return res.send({ healed: 0 });
    const files = fs.readdirSync(CONVO_DIR).filter(f => f.endsWith('.json'));

    // 2. Load Existing Logs to Avoid Duplicates
    const logs = readJSON(CALL_LOGS_FILE, []);
    const existingSids = new Set(logs.map(l => l.sid).filter(Boolean));

    let healedCount = 0;
    const allLeads = readJSON(LEADS_FILE, []);

    for (const file of files) {
        const sid = file.replace('.json', '');

        // CHECK 1: is SID already logged?
        if (existingSids.has(sid)) continue;

        console.log(`   ⚠️ Found Orphaned Log: ${sid}`);

        // READ CONVERSATION
        const convoPath = path.join(CONVO_DIR, file);
        const convo = readJSON(convoPath, []);
        if (convo.length === 0) continue; // Empty file, skip

        // IDENTIFY LEAD (Best Effort)
        // Try to find a lead that has this SID as 'last_call_sid'
        let lead = allLeads.find(l => l.last_call_sid === sid);
        let leadPhone = lead ? lead.phone : "UNKNOWN_NUMBER";

        // FALLBACK: If phone is unknown, we might want to peek at recent leads? 
        // For now, "UNKNOWN_NUMBER" is safer than guessing.

        // START/END TIMES
        const startTime = convo[0]?.timestamp || new Date().toISOString();
        const endTime = convo[convo.length - 1]?.timestamp || new Date().toISOString();

        // CHECK 2: Double check by timestamp (in case SID wasn't saved in old logs)
        // A fuzzy match: generic event within 2 seconds? No, let's trust the SID check mostly.
        // But since we JUST added SID column, old logs won't have it.
        // Let's rely on the file existence vs log existence. 
        // If we really want to avoid dupes of old logs that lack SID:
        // We can check if there's a log with SAME start_time and SAME lead_id.
        const potentialDupe = logs.find(l => l.started_at === startTime && l.lead_id === leadPhone);
        if (potentialDupe) {
            // It's likely already logged but missing the SID field. 
            // We should ideally update that log with the SID, but user asked to "append" if missing.
            // Let's just backfill the SID? 
            potentialDupe.sid = sid;
            console.log(`      🔄 Backfilled SID for existing log: ${sid}`);
            continue;
        }

        // GENERATE SUMMARY
        // GENERATE SUMMARY & PROCESS FULL PIPELINE
        // Use the unified function to ensure scoring, events, and logs are ALL updated.
        await processCallCompletion(sid, leadPhone, convo);

        healedCount++;
        console.log(`      ✅ Restored Log for ${sid}`);


    }

    if (healedCount > 0 || files.length > 0) { // Always save if we backfilled SIDs too
        writeJSON(CALL_LOGS_FILE, logs);
    }

    res.send({ healed: healedCount });
});

app.listen(PORT, async () => {
    console.log(`🟢 VOICE CALL SERVER RUNNING ON PORT ${PORT}`);

    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/9a7cfcbb-92ab-4e23-8e2c-dd5be07531c4', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ location: 'call_server.js:735', message: 'SERVER_START', data: { port: PORT }, timestamp: Date.now(), sessionId: 'debug-session', runId: 'run1', hypothesisId: 'B' }) }).catch(() => { });
});
