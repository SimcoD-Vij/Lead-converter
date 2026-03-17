// conversion-system/router/orchestrator.js
// ---------------------------------------------------------
// MASTER ORCHESTRATOR: UNIFIED GATEWAY CONTROLLER
// ---------------------------------------------------------

const fs = require('fs');
const path = require('path');
const { spawn, fork } = require('child_process');
const axios = require('axios');

console.log("\n🚀 MASTER ORCHESTRATOR: Initializing Unified System...");

// 0. INSTANCE LOCK (Rule: Never run twice)
const LOCK_FILE = path.join(__dirname, '../orchestrator.lock');
if (fs.existsSync(LOCK_FILE)) {
    console.error(`\n❌ ERROR: Another Orchestrator instance is already running!`);
    console.error(`   If this is an error, delete: ${LOCK_FILE}\n`);
    process.exit(1);
}
fs.writeFileSync(LOCK_FILE, process.pid.toString());
process.on('exit', () => { if (fs.existsSync(LOCK_FILE)) fs.unlinkSync(LOCK_FILE); });
process.on('SIGINT', () => { if (fs.existsSync(LOCK_FILE)) fs.unlinkSync(LOCK_FILE); process.exit(); });
process.on('SIGTERM', () => { if (fs.existsSync(LOCK_FILE)) fs.unlinkSync(LOCK_FILE); process.exit(); });

// ---------------------------------------------------------
// 1. INFRASTRUCTURE & STARTUP
// ---------------------------------------------------------

// A. VOICE SERVER (Internal Port 3000)
const voiceServerPath = path.join(__dirname, '../voice/call_server.js');
console.log(`🔌 INFRASTRUCTURE: Launching Internal Voice Server (Port 3000)...`);
const voiceProcess = fork(voiceServerPath, [], { stdio: ['inherit', 'pipe', 'pipe', 'ipc'] });

voiceProcess.stdout.on('data', (d) => {
    process.stdout.write(d.toString());
});
voiceProcess.stderr.on('data', (d) => {
    process.stderr.write(d.toString());
});
voiceProcess.on('close', (c) => console.log(`[VOICE] Exited: ${c}`));

// B. GATEWAY SERVER (Public Port 8082)
// This is the new "Single Ingress"
const gatewayPath = path.join(__dirname, '../gateway/server.js');
console.log(`🔌 INFRASTRUCTURE: Launching Unified Gateway (Port 8082)...`);
// Inherit stdio so we see "INCOMING SMS" logs in the main terminal
const gatewayProcess = spawn('node', [gatewayPath], { stdio: 'inherit', shell: true });

// C. NGROK (Public Tunnel -> Port 8080)
// C. NGROK (Public Tunnel -> Port 3000)
console.log(`🔌 INFRASTRUCTURE: Launching Ngrok Tunnel (Port 3000)...`);
const ngrokCmd = `npx ngrok http 3000 --domain=oretha-geniculate-addictedly.ngrok-free.dev`;
const ngrokProcess = spawn(ngrokCmd, { stdio: 'ignore', shell: true, detached: true });
console.log(`   🌍 Ngrok Public URL: https://oretha-geniculate-addictedly.ngrok-free.dev (Target: 3000)`);

// D. SERVICES IMPORTS
const smsEngine = require('../sms/sms_engine');
const smsQueueManager = require('../sms/sms_queue_manager');
const { monitorInbox } = require('../email/reply_monitor'); // NEW QUEUE MANAGER
const { generateResponse, generateOpening, generateFeedbackRequest, warmup } = require('../agent/salesBot');
// Initialize "Brain" immediately (Starts MCP)
warmup().catch(e => console.error("💥 Warmup Failed:", e.message));

const voiceEngine = require('../voice/voice_engine');
const emailEngine = require('../email/email_engine');
const crm = require('../agent/crm_connector'); // CRM Integration

// Dograh AI Client (if enabled)
const DograhClient = require('../voice/dograh_client');
const dograhClient = new DograhClient();

// D. CONFIGURATION
const LEADS_FILE = path.join(__dirname, '../processed_leads/clean_leads.json');
const EVENTS_FILE = path.join(__dirname, '../processed_leads/lead-events.json');
const SMS_HISTORY_FILE = path.join(__dirname, '../sms/sms_history.json');
const STATE_FILE = path.join(__dirname, '../system_state.json');

// Valid States
const STATES = {
    SMS: ['SMS_IDLE', 'SMS_SENT', 'SMS_DELIVERED', 'SMS_RECEIVED', 'SMS_ENGAGED', 'SMS_CALL_FOLLOWUP', 'SMS_TO_CALL_REQUESTED'],
    VOICE: ['CALL_IDLE', 'CALL_INITIATED', 'CALL_CONNECTED', 'CALL_SCORING', 'CALL_MISSED', 'CALL_BUSY', 'CALL_NO_ANSWER', 'CALL_INTERESTED', 'CALL_NOT_INTERESTED', 'CALL_DROPPED', 'CALL_TO_SMS_FOLLOWUP', 'CALL_COMPLETED', 'CALL_IN_PROGRESS'],
    MAIL: ['MAIL_IDLE', 'MAIL_SENT', 'MAIL_DELIVERED', 'MAIL_OPENED', 'MAIL_ENGAGED', 'MAIL_TO_CALL_REQUESTED', 'MAIL_NO_RESPONSE', 'MAIL_OPTED_OUT']
};

// ---------------------------------------------------------
// 2. HELPERS
// ---------------------------------------------------------

const readJSON = (file, fallback = []) => {
    try {
        if (!fs.existsSync(file)) return fallback;
        return JSON.parse(fs.readFileSync(file, 'utf8'));
    } catch (e) { return fallback; }
};

const saveLeadEvents = (data) => fs.writeFileSync(EVENTS_FILE, JSON.stringify(data, null, 2));

const isCallTime = () => {
    return true; // ALWAYS CALL FOR TESTING (Override for current time)
};

// ---------------------------------------------------------
// 3. LOGIC ENGINE (PLANNING)
// ---------------------------------------------------------

// ---------------------------------------------------------
// 3. LOGIC ENGINE (PLANNING)
// ---------------------------------------------------------

const TIMELINE_ACTIONS = [
    ['SMS', 'MAIL'],        // Attempt 0 (Day 1) - Simultaneous Outreach
    ['SMS', 'MAIL'],        // Attempt 1 (Day 2) - Simultaneous Outreach
    ['VOICE'],              // Attempt 2 (Day 3) - STRICT VOICE ONLY
    ['SMS', 'MAIL'],        // Attempt 3 (Day 5)
    ['VOICE'],              // Attempt 4 (Day 7)
    ['SMS', 'MAIL'],        // Attempt 5 (Day 10)
    ['VOICE'],              // Day 14
    ['SMS', 'MAIL'],        // Attempt 7
    ['VOICE'],              // Attempt 8
    ['SMS', 'MAIL']         // Attempt 9
];

const checkStickyChannel = (lead) => {
    if (STATES.MAIL.includes(lead.status) && lead.status.includes('ENGAGED')) return ['MAIL'];
    if (STATES.SMS.includes(lead.status) && lead.status.includes('ENGAGED')) return ['SMS'];
    return null;
};

const determineActions = (lead) => {
    // 0. GLOBAL HALT STATES
    if (['DO_NOT_CONTACT', 'OPTED_OUT', 'COMPLETED', 'SMS_USER_STOP', 'HUMAN_HANDOFF'].includes(lead.status)) return [];

    if (lead.status.includes('HANDOFF')) return [];

    // 1. GRADUATION LOGIC
    if ((lead.attempt_count || 0) >= 6 && (lead.score || 0) >= 50) return [];

    if (['CALL_INITIATED', 'CALL_CONNECTED', 'CALL_IN_PROGRESS'].includes(lead.status)) return [];

    const now = new Date();
    const offsetd = new Date(now.getTime() - (now.getTimezoneOffset() * 60000));
    const today = offsetd.toISOString().split('T')[0];

    // 2. STRICT ONE-ACTION-PER-DAY LOCK (Rule 3 & 8)
    // If we already acted today, SKIP.
    if (lead.last_action_date === today) {
        // EXCEPTION: Scheduled Callbacks (Rule 6)
        if (lead.status === 'SMS_CALL_SCHEDULED' || lead.status === 'MAIL_TO_CALL_REQUESTED') {
            // Check time...
        } else {
            return []; // HARD STOP
        }
    }

    // 1.5 STICKY CHANNEL (Prefer engaged channel)
    // Note: Sticky channel still respected but governed by daily lock above.
    // 1.5 TIMELINE PRIORITY CHECK (Rule: Voice Calls override Sticky Text Channels)
    const attempt = lead.attempt_count || 0;
    const plan = TIMELINE_ACTIONS[attempt] || [];
    const isVoiceDay = plan.includes('VOICE') && plan.length === 1;

    // 1.6 STICKY CHANNEL (Prefer engaged channel ONLY if not a Voice Day)
    if (!isVoiceDay) {
        const sticky = checkStickyChannel(lead);
        if (sticky) return sticky;
    }

    // Escalation Priority
    if (lead.status === 'SMS_TO_CALL_REQUESTED') return ['VOICE'];
    if (lead.status === 'MAIL_TO_CALL_REQUESTED') return ['VOICE'];

    // Scheduled Call Logic
    if (lead.status === 'SMS_CALL_SCHEDULED') {
        if (lead.scheduled_call_time && new Date() >= new Date(lead.scheduled_call_time)) return ['VOICE'];
        return [];
    }

    // Date Check (Timeline enforcement)
    if (lead.next_action_due && lead.next_action_due > today) return [];

    // Timeline Default
    // attempt is already defined above

    // STRICT TIMELINE: Halt if exhausted
    // plan is already defined above
    if (!plan) return [];

    // Data Priority
    let finalActions = new Set(plan);
    if (finalActions.has('SMS') && lead.email) finalActions.add('MAIL');
    // Ensure we don't accidentally add MAIL to a VOICE day unless explicit?
    // User Rule: "Day 3 -> Voice call".
    // Our array enforces this. Just need to ensure we don't 'fallback' to mail here.

    if (finalActions.has('VOICE') && !lead.phone) {
        // Fallback or Skip? User says "Mandatory".
        // If no phone, maybe skip or fallback to mail but increment attempt?
        finalActions.delete('VOICE');
        if (lead.email) finalActions.add('MAIL'); // Soft fallback to keep moving
    }
    return Array.from(finalActions);
};


// ---------------------------------------------------------
// 4. MEMORY & FINALIZATION (LOGICAL WINDOWS)
// ---------------------------------------------------------
// (finalizeSmsSessions moved to sms_queue_manager.js)

// ---------------------------------------------------------
// 4.5 POST-CALL FOLLOW-UP (IMMEDIATE FEEDBACK)
// ---------------------------------------------------------
const processPostCallActions = async () => {
    if (!fs.existsSync(LEADS_FILE)) return;
    const leads = readJSON(LEADS_FILE);
    let hasUpdates = false;

    // Filter leads needing action
    // We only process if they have a phone or email
    const pendingLeads = leads.filter(l => l.post_call_action_pending === true);

    if (pendingLeads.length > 0) {
        console.log(`   🏁 Processing Post-Call Actions for ${pendingLeads.length} leads...`);
    }

    // Get Exactly Today (Local Date)
    const now_obj = new Date();
    const offset_obj = new Date(now_obj.getTime() - (now_obj.getTimezoneOffset() * 60000));
    const today = offset_obj.toISOString().split('T')[0];

    for (const lead of pendingLeads) {
        // Post-call actions are part of the voice interaction follow-up and should NOT be blocked by the daily lock.

        // IMMEDIATE LOCK (before generation to prevent race from pulse)
        lead.last_action_date = today;
        lead.post_call_action_pending = false;
        fs.writeFileSync(LEADS_FILE, JSON.stringify(leads, null, 2));

        console.log(`      ✨ Generating Feedback Request for ${lead.phone}...`);

        // 1. Get Summary & Requests
        let summaryText = "our recent conversation";
        if (lead.last_call_summary) {
            try {
                const s = JSON.parse(lead.last_call_summary);
                const convoSummary = s.conversation_summary || s.text_summary || "";
                const requests = s.unhandled_requests || "";
                summaryText = `${convoSummary} ${requests ? "\nUSER REQUESTS: " + requests : ""}`.trim() || summaryText;
            } catch (e) {
                // heuristic fallback
            }
        }

        // 3. Generate & Send (Multi-channel)
        const { generateFeedbackRequest } = require('../agent/salesBot');
        try {
            console.log(`\n**************************************************************`);
            // SMS
            if (lead.phone) {
                const smsMsg = await generateFeedbackRequest(summaryText, 'SMS', lead.name);
                console.log(`📝 GENERATED SMS FEEDBACK: "${smsMsg}"`);
                try { await smsEngine.sendSms(lead.phone, smsMsg); } catch (e) { }
            }

            // EMAIL
            if (lead.email) {
                const fullMsg = await generateFeedbackRequest(summaryText, 'EMAIL', lead.name);

                // Parse Subject (e.g., "SUBJECT: Summary of Call")
                let subject = "Follow up from Hivericks";
                let body = fullMsg;

                const subjectMatch = fullMsg.match(/SUBJECT:\s*(.+)(\r?\n|$)/i);
                if (subjectMatch) {
                    subject = subjectMatch[1].trim();
                    body = fullMsg.replace(subjectMatch[0], '').trim();
                }

                console.log(`📝 GENERATED EMAIL FEEDBACK:\nSubject: ${subject}\n${body.substring(0, 100)}...`);
                try { await emailEngine.sendEmail(lead, subject, body); } catch (e) { console.error("Email send failed:", e.message); }
            }
            console.log(`**************************************************************\n`);

        } catch (err) {
            console.error(`      ❌ Failed to send Notification: ${err.message}`);
        }

        // 5. CRM: Log Call (New Feature)
        await crm.pushCallLog(lead, {
            status: lead.status,
            intent: lead.status.includes('INTERESTED') ? 'Interested' : 'General',
            summary: lead.last_call_summary,
            duration: 60 // Placeholder or read from metadata if available
        });

        // 6. Update Lead (FINALIZE & LOCK)
        lead.post_call_action_pending = false;

        const now = new Date();
        lead.last_action_date = today;
        
        // CHECK FOR RESCHEDULING REQUEST IN AI VARIABLES
        let rescheduleDate = null;
        if (lead.last_call_summary) {
            try {
                const s = JSON.parse(lead.last_call_summary);
                const vars = s.variables || {};
                // AI might export these keys
                rescheduleDate = vars.reschedule_date || vars.callback_date || vars.preferred_date;
            } catch (e) {}
        }

        if (rescheduleDate) {
            console.log(`      📅 AI Reschedule Requested for: ${rescheduleDate}`);
            lead.next_action_due = rescheduleDate;
            lead.status = 'SMS_CALL_SCHEDULED'; // Use this as a "ready for call" state
        } else {
            // Default: Increment Attempt & Move to Tomorrow
            lead.attempt_count = (lead.attempt_count || 0) + 1;
            const tomorrow = new Date();
            tomorrow.setDate(now.getDate() + 1);
            lead.next_action_due = tomorrow.toISOString().split('T')[0];
            console.log(`      📈 Workflow Complete. Locked for today. Attempt -> ${lead.attempt_count}`);
        }

        // CRM PUSH: Detailed Action
        crm.pushLeadUpdate(lead, {
            status: 'action_taken',
            intent: lead.status.includes('INTERESTED') ? 'interested' : 'not_interested',
            summary: lead.last_call_summary,
            channel: 'voice_workflow'
        });

        lead.last_updated = now.toISOString();
        hasUpdates = true;
    }

    if (hasUpdates) {
        fs.writeFileSync(LEADS_FILE, JSON.stringify(leads, null, 2));
    }
};

// ---------------------------------------------------------
// 4.6 GRADUATION CHECK (SCORE BASED)
// ---------------------------------------------------------
const checkGraduation = (lead) => {
    // Condition: Attempt >= 6 AND Score >= 50
    if ((lead.attempt_count || 0) >= 6 && (lead.score || 0) >= 50) {
        if (lead.status !== 'HUMAN_HANDOFF' && lead.status !== 'COMPLETED') {
            lead.status = 'HUMAN_HANDOFF';
            lead.last_updated = new Date().toISOString();
            console.log(`   🎓 LEAD GRADUATED: ${lead.phone || lead.email} (Score: ${lead.score}) -> HUMAN_HANDOFF`);
            return true;
        }
    }
    return false;
};

const processPrioritySmsActions = async () => {
    if (!fs.existsSync(LEADS_FILE)) return;
    const leads = readJSON(LEADS_FILE);
    let hasUpdates = false;

    // Filter leads needing PRIORITY SMS (from MCP)
    const priorityLeads = leads.filter(l => l.status === 'SMS_SEND_REQUESTED' && l.pending_sms_content);

    if (priorityLeads.length > 0) {
        console.log(`   📨 PRIORITY SMS: Processing ${priorityLeads.length} requests...`);
    }

    for (const lead of priorityLeads) {
        console.log(`      ⚡ Sending Requested SMS to ${lead.phone}...`);
        const message = lead.pending_sms_content;

        try {
            await smsEngine.sendSms(lead.phone, message);
            console.log(`      ✅ Priority SMS Sent.`);

            // RESET STATUS
            lead.status = 'SMS_SENT';
            delete lead.pending_sms_content;
            lead.last_updated = new Date().toISOString();
            hasUpdates = true;

        } catch (e) {
            console.error(`      ❌ Priority SMS Failed: ${e.message}`);
        }
    }

    if (hasUpdates) fs.writeFileSync(LEADS_FILE, JSON.stringify(leads, null, 2));
};

async function runOrchestrator() {
    // process.stdout.write('\x1Bc'); // DISABLED: Don't clear console, it wipes history
    console.log(`
    =============================================
       🐝 HIVERICKS INTELLIGENCE ORCHESTRATOR 🐝
       [Mode: Enterprise Integration]
    =============================================
    `);

    // 0. CHECK CRM STATUS (Added for User Clarity)
    await crm.checkConnection();

    console.log(`\n\x1b[94m-- ORCHESTRATOR PULSE [${new Date().toLocaleTimeString()}] --\x1b[0m`);

    // CRM PULL: Check for new leads
    await crm.pullNewLeads();

    // 0. Maintenance
    await smsQueueManager.finalizeSmsSessions();
    await processPostCallActions();
    await processPrioritySmsActions();
    await emailEngine.finalizeMailEvents();

    if (!fs.existsSync(LEADS_FILE)) return;
    const leads = readJSON(LEADS_FILE);
    let leadsUpdated = false;

    // STATE ENFORCEMENT HELPER (Rule 7 & 8)
    const markActionComplete = (lead) => {
        const now = new Date();
        const today = now.toISOString().split('T')[0];

        // CHECK IDEMPOTENCY: If already locked today, DO NOT increment again.
        if (lead.last_action_date === today) {
            console.log(`      🔒 Action recorded. Lead already locked for today (No double increment).`);
            return;
        }

        // 1. Set Lock
        lead.last_action_date = today;

        // 2. Increment Attempt (Only if it's a compulsory scheduled action)
        const isUserReq = ['SMS_TO_CALL_REQUESTED', 'MAIL_TO_CALL_REQUESTED', 'SMS_CALL_SCHEDULED'].includes(lead.status);

        if (!isUserReq) {
            lead.attempt_count = (lead.attempt_count || 0) + 1;

            // 3. Set Next Due (Standard 1 Day Gap, or determined by Schedule)
            const tomorrow = new Date();
            tomorrow.setDate(now.getDate() + 1);
            lead.next_action_due = tomorrow.toISOString().split('T')[0];

            console.log(`      📈 Action Complete. Locked for today. Attempt -> ${lead.attempt_count}`);
        } else {
            console.log(`      🛡️  User Request Fulfilled. Action Locked.`);
        }

        lead.last_updated = now.toISOString();

        console.log(`      📊 DIAGNOSTIC: Initiating CRM Sync Phase...`);
        console.log(`      📝 DIAGNOSTIC: Channel=${lead.status.includes('CALL') ? 'VOICE' : 'TEXT'} | ID=${lead.lead_id}`);
        crm.pushInteractionToStream(lead, lead.status.includes('CALL') ? 'voice' : (lead.status.includes('SMS') ? 'sms' : 'email'), {
            summary: `Action Completed: ${lead.status}`,
            intent: lead.status.includes('INTERESTED') ? 'potential_interest' : 'outreach',
            conversation: lead.conversation || [], // Pass transcript if available
            nextPrompt: `Next Action Due: ${lead.next_action_due}`
        });

        // CRM FULL SUITE TRIGGERS
        // 1. Opportunity: If High Interest
        if (lead.status.includes('INTERESTED') || lead.category === 'HOT') {
            crm.pushOpportunity(lead);
        }

        // 2. Meeting: If Scheduled
        if (lead.status.includes('SCHEDULED') && lead.next_action_due) {
            // Assume next_action_due is the date, default time 10AM if not parsing detailed time
            crm.pushMeeting(lead, `${lead.next_action_due} 10:00:00`);
        }

        // Persist Immediately
        fs.writeFileSync(LEADS_FILE, JSON.stringify(leads, null, 2));
    };

    /**
     * PRE-CALL LOCK: Reserve the lead immediately before starting the call process.
     * Prevents race conditions from simultaneous orchestrator processes.
     */
    const markActionInitiated = (lead) => {
        const now = new Date();
        const today = now.toISOString().split('T')[0];

        if (lead.last_action_date === today && !lead.name.includes("Vijay")) return false; // Already locked

        lead.last_action_date = today;
        lead.last_updated = now.toISOString();
        fs.writeFileSync(LEADS_FILE, JSON.stringify(leads, null, 2));
        console.log(`      🔒 Pre-Call Lock Applied for ${lead.phone}.`);
        return true;
    };


    // 1. Plan Work
    const batches = { SMS: [], MAIL: [], VOICE: [] };

    leads.forEach(lead => {
        // A. Check Graduation
        if (checkGraduation(lead)) {
            leadsUpdated = true;
            return; // Skip finding actions for this cycle, status is now HANDOFF
        }

        const actions = determineActions(lead);
        console.log(`🔎 DEBUG [${lead.name}]: Actions=${JSON.stringify(actions)}`);
        if (actions.length > 0) actions.forEach(act => batches[act].push(lead));
    });

    console.log(`📊 BATCH PLAN: SMS=${batches.SMS.length}, MAIL=${batches.MAIL.length}, VOICE=${batches.VOICE.length}`);

    if (leadsUpdated) fs.writeFileSync(LEADS_FILE, JSON.stringify(leads, null, 2));

    // ---------------------------------------------------------
    // PHASE 1: SMS (INTERLEAVED)
    // ---------------------------------------------------------
    if (batches.SMS.length > 0) {
        console.log(`   📨 Processing ${batches.SMS.length} Outbound SMS (Interleaved)...`);

        const chunkSize = 5;
        for (let i = 0; i < batches.SMS.length; i += chunkSize) {

            // A. Check Inbound Queue (Priority)
            const queuedCount = await smsQueueManager.processInboundQueue();
            if (queuedCount > 0) console.log(`      ⚡ Interrupted Outbound to process ${queuedCount} Inbound replies.`);

            // B. Process Chunk
            const chunk = batches.SMS.slice(i, i + chunkSize);

            // C. Send & Lock
            await smsEngine.runSmartSmsBatch(chunk);

            chunk.forEach(l => {
                // Re-fetch lead to ensure we have latest object (if mutated by batch) across memory
                // Actually relying on reference here is fine for this single-process model.
                const liveLead = leads.find(lead => lead.phone === l.phone);
                if (liveLead) markActionComplete(liveLead);
            });

            // D. Brief Pause (Yield)
            await new Promise(r => setTimeout(r, 1000));
        }
    } else {
        await smsQueueManager.processInboundQueue();
    }

    // ---------------------------------------------------------
    // PHASE 2: MAIL
    // ---------------------------------------------------------

    // const emailReplies = await emailEngine.processInboundQueue();
    // await monitorInbox();

    if (batches.MAIL.length > 0) {
        console.log(`   📧 Processing ${batches.MAIL.length} Outbound Emails...`);
        const { generateFeedbackRequest } = require('../agent/salesBot');
        const { getMemory } = require('../agent/memory');

        for (const lead of batches.MAIL) {

            // DYNAMIC CONTENT GENERATION
            let summaryText = "";
            if (lead.last_call_summary) {
                try {
                    const s = JSON.parse(lead.last_call_summary);
                    summaryText = s.conversation_summary || s.text_summary || summaryText;
                } catch (e) { }
            }

            // FETCH CONTEXT
            const leadId = lead.phone || lead.email;
            const memory = await getMemory(leadId);

            // MNC-GRADE GENERATION & VALIDATION LOOP
            const { validateEmailContent } = require('../utils/emailValidator');
            let fullMsg = "";
            let isValid = false;
            let attempts = 0;
            const MAX_ATTEMPTS = 2;

            while (!isValid && attempts < MAX_ATTEMPTS) {
                attempts++;
                fullMsg = await generateFeedbackRequest(summaryText, 'EMAIL', lead.name, lead.attempt_count || 0, memory);
                const validation = validateEmailContent(fullMsg.trim());
                if (validation.valid) isValid = true;
            }

            if (!isValid) {
                console.error("      ⛔ EMAIL GENERATION ABORTED: Failed validation.");
                continue;
            }

            let subject = "Follow up from Hivericks";
            let body = fullMsg;

            const subjectMatch = fullMsg.match(/^Subject:\s*(.+)(\r?\n|$)/i);
            if (subjectMatch) {
                subject = subjectMatch[1].trim();
                body = fullMsg.replace(subjectMatch[0], '').trim();
            }

            const sent = await emailEngine.sendEmail(lead, subject, body);

            if (sent) {
                const liveLead = leads.find(l => l.phone === lead.phone);
                if (liveLead) markActionComplete(liveLead);
            }

            await smsQueueManager.processInboundQueue();
        }
    }

    // ---------------------------------------------------------
    // PHASE 3: VOICE (ARBITRATED)
    // ---------------------------------------------------------
    if (batches.VOICE.length > 0) {
        if (false && !isCallTime()) {
            console.log(`   ⏳ Skipping VOICE (Outside Window).`);
        } else {
            console.log(`   ☎️ Processing ${batches.VOICE.length} Calls...`);

            const useDograh = process.env.USE_DOGRAH_AI === 'true';

            if (useDograh) {
                console.log(`   🤖 Using Dograh AI for voice calls`);
                for (const lead of batches.VOICE) {
                    const locked = markActionInitiated(lead);
                    if (!locked) {
                        console.log(`      ⏭️  Skipping ${lead.phone}: Already locked by another process.`);
                        continue;
                    }

                    try {
                        console.log(`      🤖 Initiating Dograh AI call to ${lead.phone}...`);
                        const triggerUuid = process.env.DOGRAH_TRIGGER_UUID;
                        const call = await dograhClient.initiateCall(triggerUuid, lead.phone, {
                            lead_name: lead.name,
                            lead_email: lead.email || '',
                            lead_status: lead.status || 'NEW'
                        });

                        console.log(`      ✓ Dograh call initiated: ${call.call_id}`);

                        const freshLeads = readJSON(LEADS_FILE);
                        const freshLead = freshLeads.find(l => l.phone === lead.phone);
                        if (freshLead) {
                            freshLead.status = 'CALL_INITIATED';
                            freshLead.attempt_count = (freshLead.attempt_count || 0) + 1;
                            freshLead.last_call_summary = JSON.stringify({ dograh_workflow_run_id: call.call_id });
                            fs.writeFileSync(LEADS_FILE, JSON.stringify(freshLeads, null, 2));
                        }

                        const workflowId = process.env.DOGRAH_WORKFLOW_ID;
                        if (workflowId) {
                            const result = await dograhClient.waitForCallCompletion(call.call_id, workflowId);
                            const finalLeads = readJSON(LEADS_FILE);
                            const finalLead = finalLeads.find(l => l.phone === lead.phone);
                            if (finalLead) {
                                finalLead.status = result.status === 'completed' ? 'CALL_COMPLETED' : 'CALL_DROPPED';
                                finalLead.last_call_summary = JSON.stringify({
                                    transcript: result.transcript?.transcript || "",
                                    duration: result.duration,
                                    variables: result.variables || {}
                                });
                                finalLead.post_call_action_pending = true;
                                fs.writeFileSync(LEADS_FILE, JSON.stringify(finalLeads, null, 2));
                                await processPostCallActions();
                            }
                        }
                    } catch (error) {
                        console.error(`      ❌ Dograh call failed:`, error.message);
                    }
                    await new Promise(r => setTimeout(r, 2000));
                }
            } else {
                for (const lead of batches.VOICE) {
                    const locked = markActionInitiated(lead);
                    if (!locked) continue;

                    console.log(`      📞 Dialing ${lead.phone}...`);
                    const sid = await voiceEngine.dialLead(lead, null, "Hello from Hivericks");
                    if (sid) {
                        await waitForCallCompletion(lead.phone, sid);
                        await processPostCallActions();
                    }
                    await new Promise(r => setTimeout(r, 2000));
                }
            }
        }
    }
}

// HELPER: Wait for Call
const waitForCallCompletion = async (phone, sid) => {
    // Poll logs until status is terminal
    const START = Date.now();
    let loops = 0;

    const smsQueuePath = path.join(__dirname, '../sms/inbound_sms_queue.json');
    const emailQueuePath = path.join(__dirname, '../email/inbound_email_queue.json');

    while (Date.now() - START < 600000) { // 10 min max
        const leads = readJSON(LEADS_FILE);
        const l = leads.find(le => le.phone === phone);
        if (l && ['CALL_COMPLETED', 'CALL_BUSY', 'CALL_NO_ANSWER', 'CALL_DROPPED'].includes(l.status)) {
            return;
        }

        // Observability: Log Queue Status every 10s
        loops++;
        if (loops % 10 === 0) {
            const smsQ = readJSON(smsQueuePath);
            const mailQ = readJSON(emailQueuePath);
            if (smsQ.length > 0 || mailQ.length > 0) {
                console.log(`      ⏳ Call In Progress... Buffering [SMS: ${smsQ.length} | Mail: ${mailQ.length}]`);
            }
        }

        await new Promise(r => setTimeout(r, 1000));
    }
    console.log("      ⚠️ Call Timeout (Logic).");
};

// ---------------------------------------------------------
// AUTO-RUN
// ---------------------------------------------------------
const runLoop = async () => {
    try {
        await runOrchestrator();
    } catch (e) {
        console.error("💥 ORCHESTRATOR ERROR:", e);
    }
    setTimeout(runLoop, 30000); // 30s Pulse
};

runLoop();