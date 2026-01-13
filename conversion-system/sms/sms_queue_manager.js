// ---------------------------------------------------------
// SMS QUEUE MANAGER (INBOUND PROCESSOR)
// ---------------------------------------------------------
// Handles the "Logical Windows" and Inbound Queue Processing.
// Called by Orchestrator during the "Interleaved Loop".
// ---------------------------------------------------------

const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: '../.env' });
const client = require('twilio')(process.env.TWILIO_SID, process.env.TWILIO_AUTH);

// MODULES
const { generateResponse, detectIntent } = require('../agent/salesBot');
const { getMemory, upsertMemory } = require('../agent/memory');
const { logSmsSession } = require('./sms_engine'); // Shared Logger

// PATHS
const SMS_QUEUE_FILE = path.join(__dirname, 'inbound_sms_queue.json');
const ACTIVE_WINDOWS_FILE = path.join(__dirname, 'active_conversations.json');
const LEADS_FILE = path.join(__dirname, '../processed_leads/clean_leads.json');

// HELPERS
const readJSON = (file) => {
    try { return fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : []; } catch (e) { return []; }
};
const writeJSON = (file, data) => fs.writeFileSync(file, JSON.stringify(data, null, 2));

// ---------------------------------------------------------
// CORE LOGIC
// ---------------------------------------------------------

const processInboundQueue = async () => {
    console.log("DEBUG: Checking Queue...");
    const queue = readJSON(SMS_QUEUE_FILE);
    if (!Array.isArray(queue) || queue.length === 0) return 0;

    console.log(`\n📨 QUEUE MANAGER: Processing ${queue.length} inbound messages...`);

    // Process ALL pending messages (or chunk if too many?)
    // For now, process all because "Human Real-Time" is priority.
    let processedCount = 0;

    // We clone queue to iterate, then we will save the REMAINING (if any fail)
    // Actually, pop one by one is safer.

    while (queue.length > 0) {
        const item = queue.shift(); // FIFO
        const { lead_id, message, timestamp } = item;

        console.log(`   👉 Processing: ${lead_id} ("${message}")`);

        try {
            await handleInboundMessage(lead_id, message);
            processedCount++;
        } catch (e) {
            console.error(`      ❌ Error processing ${lead_id}:`, e.message);
            // Re-queue at end? Or Drop? Drop to avoid infinite loop block.
            // Maybe log to error file.
        }
    }

    // Save empty queue
    writeJSON(SMS_QUEUE_FILE, []);
    return processedCount;
};

// ---------------------------------------------------------
// WINDOW & CONTEXT LOGIC
// ---------------------------------------------------------

const handleInboundMessage = async (leadId, userMessage) => {
    // 0. Update Status: SMS_RECEIVED (Audit requirement)
    updateLeadStatus(leadId, 'SMS_RECEIVED');

    // 1. Log to Session History (Unified Log)
    // This logs the raw turn.
    logSmsSession(leadId, 'user', userMessage);

    // 2. Manage Logical Window
    const windows = readJSON(ACTIVE_WINDOWS_FILE) || {}; // Object: { lead_id: { start_time, last_interaction } }
    let window = windows[leadId];

    let context = "";

    // NEW WINDOW CREATION LOGIC (The "3-Day Return" Support)
    if (!window) {
        console.log(`      🆕 New Conversation Window for ${leadId}`);
        window = {
            start_time: new Date().toISOString(),
            last_interaction: new Date().toISOString(),
            lead_id: leadId
        };

        // LOAD PREVIOUS SUMMARY (Context Injection)
        const leads = readJSON(LEADS_FILE);
        const lead = leads.find(l => l.phone === leadId || l.phone === leadId.replace('whatsapp:', ''));
        if (lead && lead.last_call_summary) {
            context = `PREVIOUS CONTEXT: ${JSON.stringify(lead.last_call_summary)}`;
            console.log(`      🧠 Loaded Context: ${context.substring(0, 50)}...`);
        }
    } else {
        console.log(`      🔄 Resuming Active Window...`);
        // Update interaction time
        window.last_interaction = new Date().toISOString();
    }

    // Save Window State
    windows[leadId] = window;
    writeJSON(ACTIVE_WINDOWS_FILE, windows);

    // 2.5 EARLY ACCEPTANCE CHECK (DISABLED - Handling via AI Conversation)
    /*
    const intent = detectIntent(userMessage, 'SMS_CHAT');
    let isHandoff = false;
    if (intent && intent.type === 'PURCHASE_INTENT') {
        console.log(`      💰 EARLY ACCEPTANCE DETECTED! Stopping Automation.`);
        updateLeadStatus(leadId, 'HUMAN_HANDOFF');
        isHandoff = true;
    }
    */
    let isHandoff = false;

    // 3. Generate AI Response
    // We use 'SMS_CHAT' mode.
    // If it's a new window, we might inject the Context into the System Prompt via Memory?
    // The salesBot logic uses `getMemory` which pulls from `last_call_summary`. 
    // So actually, `salesBot.js` ALREADY handles the context loading if we use `getMemory`.
    // Let's verify: memory.js looks at `lead.last_call_summary`. YES.

    const memory = await getMemory(leadId);

    const aiResponse = await generateResponse({
        userMessage: userMessage,
        memory: memory,
        mode: 'SMS_CHAT'
    });

    // SAFETY FILTER
    let finalResponse = aiResponse;
    if (finalResponse.includes("cannot create content") || finalResponse.includes("illegal") || finalResponse.includes("promote") || finalResponse.includes("harmful")) {
        console.log("   🛡️ SAFETY FILTER: Caught LLM Refusal.");
        finalResponse = "That sounds important. To ensure I understand fully and give you the best details, could we discuss this on a quick call?";
    }

    // 3.5 Ensure Lead Exists (Scenario 7)
    // We update status to SMS_ENGAGED if not escalated (AND NOT HANDOFF)
    if (!isHandoff) {
        updateLeadStatus(leadId, 'SMS_ENGAGED');

        // G. UPDATE SCORE (NEW)
        const { calculateScore } = require('../scoring/scoring_engine');
        const leads = readJSON(LEADS_FILE);
        const lIndex = leads.findIndex(l => l.phone === leadId || l.phone === leadId.replace('whatsapp:', ''));
        if (lIndex !== -1) {
            const scoreResult = calculateScore(leads[lIndex], 'WARM', leads[lIndex].status);
            leads[lIndex].score = scoreResult.score;
            leads[lIndex].category = scoreResult.category;
            console.log(`      💯 Score Updated: ${scoreResult.score} (${scoreResult.category})`);
            writeJSON(LEADS_FILE, leads);
        }
    }

    // 4. Send Reply
    // Use Twilio Client directly
    // Ensure "from" number is correct (Sandbox rules)
    const fromNum = 'whatsapp:+14155238886';
    const toNum = leadId.includes('whatsapp:') ? leadId : `whatsapp:${leadId}`;

    await client.messages.create({
        body: finalResponse,
        from: fromNum,
        to: toNum
    });

    // 5. Log AI Reply
    logSmsSession(leadId, 'assistant', finalResponse); // Log what was actually sent
    await upsertMemory(leadId, { last_bot_message: finalResponse });

    // 6. Check for Escalation (Status Updates)
    const lower = userMessage.toLowerCase();

    // A. IMMEDIATE CALL
    if (lower.includes('call me') && (lower.includes('now') || lower.includes('ready'))) {
        updateLeadStatus(leadId, 'SMS_TO_CALL_REQUESTED');
        console.log(`      🚨 Escalation (Immediate) Triggered!`);
    }
    // B. SCHEDULED / CLARIFICATION CALL
    else if (lower.includes('schedule') || lower.includes('tomorrow') || lower.includes('time') || lower.includes('discuss') || lower.includes('clarif')) {
        // Default to tomorrow for now, or keep existing if set
        updateLeadStatus(leadId, 'SMS_CALL_SCHEDULED');
        console.log(`      📅 Scheduling/Clarification Triggered!`);
    }
};

const updateLeadStatus = (phone, status) => {
    try {
        let leads = readJSON(LEADS_FILE); // Use let to allow push
        let lead = leads.find(l => l.phone === phone || l.phone === phone.replace('whatsapp:', ''));

        if (!lead) {
            // SCENARIO 7: CREATE NEW LEAD (First Touch)
            console.log(`      ✨ Creating New Lead for ${phone}`);
            lead = {
                phone: phone.replace('whatsapp:', ''),
                name: "New Website Lead",
                email: "",
                status: status || "SMS_ENGAGED",
                score: 10,
                attempt_count: 1,
                next_action_due: new Date().toISOString().split('T')[0],
                last_interaction: new Date().toISOString(),
                source: "INBOUND_SMS"
            };
            leads.push(lead);
        } else {
            // Only update status if not already escalated
            if (lead.status !== 'SMS_TO_CALL_REQUESTED' && lead.status !== 'SMS_CALL_SCHEDULED') {
                lead.status = status || lead.status;
            }
        }
        writeJSON(LEADS_FILE, leads);
    } catch (e) {
        console.error("CRITICAL ERROR UPDATING LEAD:", e);
    }
};

module.exports = { processInboundQueue };

