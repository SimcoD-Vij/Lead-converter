// ---------------------------------------------------------
// SMS ENGINE: WHATSAPP + AI SALES BOT INTEGRATION
// ---------------------------------------------------------

require('dotenv').config({ path: '../.env' });
const client = require('twilio')(process.env.TWILIO_SID, process.env.TWILIO_AUTH);
const fs = require('fs');
const path = require('path');

// IMPORT AI BRAIN
const { generateResponse } = require('../agent/salesBot');
const { getMemory, upsertMemory } = require('../agent/memory');

// PATHS
const LEADS_FILE = path.join(__dirname, '../processed_leads/clean_leads.json');
const SMS_HISTORY_FILE = path.join(__dirname, 'sms_history.json');

// ---------------------------------------------------------
// 1. HELPERS
// ---------------------------------------------------------

function getLeads() {
    if (!fs.existsSync(LEADS_FILE)) return [];
    return JSON.parse(fs.readFileSync(LEADS_FILE, 'utf8'));
}

function saveLeads(leads) {
    fs.writeFileSync(LEADS_FILE, JSON.stringify(leads, null, 2));
}

// Strict Phone Validation
function isValidMobile(lead) {
    if (!lead.phone) return false;
    // Basic check: must have at least 10 digits
    const cleaned = lead.phone.replace(/\D/g, '');
    return cleaned.length >= 10;
}

// Unified Session Logging
function logSmsSession(leadId, role, content) {
    let history = {};
    if (fs.existsSync(SMS_HISTORY_FILE)) {
        try { history = JSON.parse(fs.readFileSync(SMS_HISTORY_FILE)); } catch (e) { }
    }

    // Normalize Lead ID
    const normalizedId = leadId.replace('whatsapp:', '');

    if (!history[normalizedId]) {
        history[normalizedId] = {
            session_start: new Date().toISOString(),
            messages: []
        };
    } else if (!history[normalizedId].messages) {
        // Failsafe if messages array is missing
        history[normalizedId].messages = [];
    }

    history[normalizedId].messages.push({
        role: role,
        content: content,
        timestamp: new Date().toISOString()
    });

    // Update last interaction for session timeout logic
    history[normalizedId].last_interaction = new Date().toISOString();

    fs.writeFileSync(SMS_HISTORY_FILE, JSON.stringify(history, null, 2));
}

// ---------------------------------------------------------
// 2. ORCHESTRATOR LOGIC (Timeline Verification)
// ---------------------------------------------------------

function isSmsDue(lead) {
    const today = new Date().toISOString().split('T')[0];

    // Rule 1: Validity Check
    if (!isValidMobile(lead)) return { due: false, reason: "Invalid Phone Number" };

    // Rule 2: Status Check
    if (lead.status === 'DO_NOT_CONTACT' || lead.status === 'COLD_LEAD' || lead.status === 'SMS_TO_CALL_REQUESTED' || lead.status === 'SMS_CALL_SCHEDULED') {
        return { due: false, reason: `Status is ${lead.status}` };
    }

    // Rule 3: Date Check (Due Today or Overdue)
    if (!lead.next_action_due || lead.next_action_due > today) {
        return { due: false, reason: `Not due until ${lead.next_action_due}` };
    }

    // Rule 4: Channel Logic (Odd Attempts = Message)
    const attempt = lead.attempt_count || 0;

    if (attempt % 2 !== 0) {
        return { due: true, reason: "Timeline matches Messaging" };
    } else {
        return { due: false, reason: `Attempt ${attempt} is reserved for VOICE` };
    }
}

// ---------------------------------------------------------
// 3. MAIN RUNNER WITH AI GENERATION
// ---------------------------------------------------------

const runSmartSmsBatch = async (forcedLeads = null) => {
    console.log("\n🚀 STARTING SMART WHATSAPP BATCH...");
    console.log("-------------------------------------------------");

    const leads = forcedLeads || getLeads();
    console.log(`📂 Loaded ${leads.length} leads (Source: ${forcedLeads ? 'Orchestrator' : 'Database'}).`);

    let processedCount = 0;

    for (let i = 0; i < leads.length; i++) {
        let lead = leads[i];

        // Strict Eligibility: Skip if no phone
        if (!isValidMobile(lead)) {
            // console.log(`   ⏭️  Skipping Invalid Mobile: ${lead.name}`);
            continue;
        }

        const check = forcedLeads ? { due: true, reason: "Orchestrator Override" } : isSmsDue(lead);
        const leadId = lead.phone;
        const name = lead.name.split(' ')[0];

        if (check.due) {
            console.log(`\n👉 PROCESSING: ${lead.name} (${leadId})`);
            console.log(`   ✅ Check Passed: ${check.reason}`);

            try {
                // B. GET MEMORY & GENERATE AI MESSAGE
                const memory = await getMemory(leadId);

                // Construct a system-like prompt for the initiation
                let prompt = `INITIATE_CONVERSATION: Hi ${name}.`;
                if (lead.attempt_count > 1) {
                    prompt = `FOLLOW_UP_CONVERSATION: Hi ${name}, checking in again.`;
                }

                // Generate Content using Sales Bot
                const aiBody = await generateResponse({
                    userMessage: prompt,
                    memory: memory,
                    mode: 'SMS_CHAT'
                });

                console.log(`   🤖 AI Generated: "${aiBody}"`);

                // C. PREPARE WHATSAPP NUMBERS
                const fromNum = 'whatsapp:+14155238886';
                const toNum = leadId.includes('whatsapp:') ? leadId : `whatsapp:${leadId}`;

                // D. SEND MESSAGE VIA TWILIO
                console.log(`   📤 Sending via WhatsApp...`);
                await sendSms(leadId, aiBody);
                console.log("   ✅ Message Sent to Twilio API");

                // E. LOG TO SESSION (NO EVENT EMISSION YET)
                logSmsSession(leadId, 'assistant', aiBody);
                await upsertMemory(leadId, { last_bot_message: aiBody });

                // F. UPDATE LEAD STATE
                // Advance timeline to next action (+2 days)
                lead.attempt_count = (lead.attempt_count || 0) + 1;

                const nextDate = new Date();
                nextDate.setDate(nextDate.getDate() + 2);
                lead.next_action_due = nextDate.toISOString().split('T')[0];
                lead.last_sms_time = new Date().toISOString();

                console.log(`   💾 Lead Updated: Next action due ${lead.next_action_due}`);
                processedCount++;

            } catch (error) {
                console.error(`   ❌ Failed: ${error.message}`);
            }

        } else {
            // console.log(`   ⏭️  Skipping ${name}: ${check.reason}`);
        }
    }

    saveLeads(leads);

    console.log("-------------------------------------------------");
    console.log(`🏁 BATCH COMPLETE. Sent WhatsApp to ${processedCount} leads.\n`);
};

// DIRECT SENDER (New Export)
const sendSms = async (to, body) => {
    const fromNum = 'whatsapp:+14155238886';
    const toNum = to.includes('whatsapp:') ? to : `whatsapp:${to}`;

    return await client.messages.create({
        body: body,
        from: fromNum,
        to: toNum
    });
};

module.exports = { runSmartSmsBatch, logSmsSession, sendSms };

if (require.main === module) {
    runSmartSmsBatch();
}