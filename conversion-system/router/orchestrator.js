// conversion-system/router/orchestrator.js
// ---------------------------------------------------------
// MASTER ORCHESTRATOR: UNIFIED GATEWAY CONTROLLER
// ---------------------------------------------------------

const fs = require('fs');
const path = require('path');
const { spawn, fork } = require('child_process');

console.log("\n🚀 MASTER ORCHESTRATOR: Initializing Unified System...");

// ---------------------------------------------------------
// 1. INFRASTRUCTURE & STARTUP
// ---------------------------------------------------------

// A. VOICE SERVER (Internal Port 3000)
const voiceServerPath = path.join(__dirname, '../voice/call_server.js');
console.log(`🔌 INFRASTRUCTURE: Launching Internal Voice Server (Port 3000)...`);
const voiceProcess = fork(voiceServerPath, [], { stdio: 'pipe' });

voiceProcess.stdout.on('data', (d) => process.stdout.write(d));
voiceProcess.stderr.on('data', (d) => process.stderr.write(d));
voiceProcess.on('close', (c) => console.log(`[VOICE] Exited: ${c}`));

// B. GATEWAY SERVER (Public Port 8080)
// This is the new "Single Ingress"
const gatewayPath = path.join(__dirname, '../gateway/server.js');
console.log(`🔌 INFRASTRUCTURE: Launching Unified Gateway (Port 8080)...`);
// Inherit stdio so we see "INCOMING SMS" logs in the main terminal
const gatewayProcess = spawn('node', [gatewayPath], { stdio: 'inherit', shell: true });

// C. NGROK (Public Tunnel -> Port 8080)
console.log(`🔌 INFRASTRUCTURE: Launching Ngrok Tunnel (Port 8080)...`);
const ngrokCmd = `npx ngrok http 8080 --domain=oretha-geniculate-addictedly.ngrok-free.dev`;
const ngrokProcess = spawn(ngrokCmd, { stdio: 'ignore', shell: true, detached: true });
console.log(`   🌍 Ngrok Public URL: https://oretha-geniculate-addictedly.ngrok-free.dev`);

// D. SERVICES IMPORTS
const smsEngine = require('../sms/sms_engine');
const smsQueueManager = require('../sms/sms_queue_manager');
const { monitorInbox } = require('../email/reply_monitor'); // NEW QUEUE MANAGER
const { generateResponse, warmup } = require('../agent/salesBot');
const voiceEngine = require('../voice/voice_engine');
const emailEngine = require('../email/email_engine');

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
    const hour = new Date().getHours();
    return hour >= 9 && hour < 18; // 9 AM - 6 PM
};

// ---------------------------------------------------------
// 3. LOGIC ENGINE (PLANNING)
// ---------------------------------------------------------

const TIMELINE_ACTIONS = [
    ['SMS', 'MAIL'],        // Day 1
    ['SMS', 'MAIL'],        // Day 2
    ['VOICE'],              // Day 3
    ['SMS', 'MAIL'],        // Day 5
    ['VOICE'],              // Day 7
    ['SMS', 'MAIL'],        // Day 10
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
    if (['DO_NOT_CONTACT', 'OPTED_OUT', 'COMPLETED', 'SMS_USER_STOP', 'HUMAN_HANDOFF', 'MAIL_COMPLETE'].includes(lead.status)) return [];
    if (lead.status.includes('HANDOFF')) return []; // Safety catch-all

    // 1. GRADUATION LOGIC (Attempt > 6 && Score >= 50)
    // If graduated, we effectively HALT automation here. 
    // The actual status update to 'HUMAN_HANDOFF' should be handled by a separate maintenance function or we assume the score update triggered it.
    // For now, let's treat this valid condition as a "Stop Automation" signal.
    // NOTE: User asked to SET Human Handoff. We'll do that in the main loop 'checkGraduation'.
    // Here we just respect the consequence.
    if ((lead.attempt_count || 0) >= 6 && (lead.score || 0) >= 50) return [];

    if (['CALL_INITIATED', 'CALL_CONNECTED', 'CALL_IN_PROGRESS'].includes(lead.status)) return [];

    const now = new Date();
    const offsetd = new Date(now.getTime() - (now.getTimezoneOffset() * 60000));
    const today = offsetd.toISOString().split('T')[0];

    if (lead.next_action_due && lead.next_action_due > today) return [];

    // Sticky Priority
    const sticky = checkStickyChannel(lead);
    if (sticky) return sticky;

    // Escalation Priority
    if (lead.status === 'SMS_TO_CALL_REQUESTED') return ['VOICE'];
    if (lead.status === 'MAIL_TO_CALL_REQUESTED') return ['VOICE'];
    if (lead.status === 'SMS_CALL_SCHEDULED') {
        if (lead.scheduled_call_time && new Date() >= new Date(lead.scheduled_call_time)) return ['VOICE'];
        return [];
    }

    // Timeline Default
    const attempt = lead.attempt_count || 0;

    // STRICT TIMELINE: Halt if exhausted (No infinite loop)
    const plan = TIMELINE_ACTIONS[attempt];
    if (!plan) return []; // Auto-Halt

    // Data Priority
    let finalActions = new Set(plan);
    if (finalActions.has('SMS') && lead.email) finalActions.add('MAIL');
    if (finalActions.has('VOICE') && !lead.phone) {
        finalActions.delete('VOICE');
        if (lead.email) finalActions.add('MAIL');
    }
    return Array.from(finalActions);
};

// ---------------------------------------------------------
// 4. MEMORY & FINALIZATION (LOGICAL WINDOWS)
// ---------------------------------------------------------

const finalizeSmsSessions = async () => {
    const smsHistory = readJSON(SMS_HISTORY_FILE, {});
    const allLeadEvents = readJSON(EVENTS_FILE, []);
    const SESSION_TIMEOUT_MS = 10 * 1000; // 10 Seconds (TESTING MODE)
    const now = new Date().getTime();
    let hasUpdates = false;

    for (const [leadId, session] of Object.entries(smsHistory)) {
        if (!session.last_interaction || !session.messages?.length) continue;

        // Timeout Checker
        const lastTime = new Date(session.last_interaction).getTime();
        if ((now - lastTime) > SESSION_TIMEOUT_MS) {
            console.log(`   🏁 Finalizing Inactive Session: ${leadId}`);

            // Generate Summary
            const transcript = session.messages.map(m => `${m.role.toUpperCase()}: ${m.content}`).join('\n');
            const summaryPrompt = `
            Analyze this COMPLETED SMS conversation.
            Write a human-readable summary (max 2 sentences).
            Focus on: User Intent, key objections, and final outcome.
            Do NOT mention "AI", "System", or confidence scores.
            TRANSCRIPT:
            ${transcript}
            `;
            const summaryText = await generateResponse({
                userMessage: summaryPrompt,
                memory: {}, mode: 'SMS_CHAT'
            });

            // Create Event
            allLeadEvents.push({
                event_id: `evt_sms_${Date.now()}`,
                lead_id: leadId,
                channel: 'WHATSAPP',
                type: 'CONVERSATION_COMPLETE',
                timestamp: new Date().toISOString(),
                summary: summaryText
            });

            // Trigger Follow-up (1 Day)
            const leads = readJSON(LEADS_FILE, []);
            const leadEntry = leads.find(l => l.phone === leadId || l.phone === leadId.replace('whatsapp:', ''));
            if (leadEntry) {
                leadEntry.last_call_summary = summaryText;
                const tmrw = new Date(); tmrw.setDate(tmrw.getDate() + 1);
                leadEntry.next_action_due = tmrw.toISOString().split('T')[0];
                console.log(`      📅 Set Next Action: ${leadEntry.next_action_due} (Mail)`);
                fs.writeFileSync(LEADS_FILE, JSON.stringify(leads, null, 2));
            }

            delete smsHistory[leadId];
            hasUpdates = true;
        }
    }

    if (hasUpdates) {
        fs.writeFileSync(SMS_HISTORY_FILE, JSON.stringify(smsHistory, null, 2));
        saveLeadEvents(allLeadEvents);
    }
};

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

    for (const lead of pendingLeads) {
        console.log(`      ✨ Generating Feedback Request for ${lead.phone}...`);

        // 1. Get Summary
        let summaryText = "our recent conversation";
        if (lead.last_call_summary) {
            try {
                const s = JSON.parse(lead.last_call_summary);
                summaryText = s.conversation_summary || s.text_summary || summaryText;
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
                const smsMsg = await generateFeedbackRequest(summaryText, 'SMS');
                console.log(`📝 GENERATED SMS FEEDBACK: "${smsMsg}"`);
                try { await smsEngine.sendSms(lead.phone, smsMsg); } catch (e) { }
            }

            // EMAIL
            if (lead.email) {
                const fullMsg = await generateFeedbackRequest(summaryText, 'EMAIL');

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

        // 5. Update Lead
        lead.post_call_action_pending = false;
        lead.last_updated = new Date().toISOString();
        hasUpdates = true;
    }

    if (hasUpdates) {
        fs.writeFileSync(LEADS_FILE, JSON.stringify(leads, null, 2));
    }
};

// ---------------------------------------------------------
// 5. MAIN ORCHESTRATOR RUNNER (INTERLEAVED LOOP)
// ---------------------------------------------------------

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

const runOrchestrator = async () => {
    console.log("\n🎻 ORCHESTRATOR PULSE: Checking State...");

    // 0. Maintenance
    await finalizeSmsSessions();
    await processPostCallActions(); // NEW: Handle post-call feedback immediately
    await emailEngine.finalizeMailEvents();

    if (!fs.existsSync(LEADS_FILE)) return;
    const leads = readJSON(LEADS_FILE);
    let leadsUpdated = false;

    // TRACKING: Ensure we only increment ONCE per cycle
    const processedLeadsCycle = new Set();

    const incrementLeadSafe = (lead) => {
        if (processedLeadsCycle.has(lead.phone)) return; // Already bumped

        // 1. Increment
        lead.attempt_count = (lead.attempt_count || 0) + 1;

        // 2. Set Next Due (Standard 1 Day Gap)
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        lead.next_action_due = tomorrow.toISOString().split('T')[0];
        lead.last_updated = new Date().toISOString();

        processedLeadsCycle.add(lead.phone);
        console.log(`      📈 Attempt Count Incremented -> ${lead.attempt_count} (Next: ${lead.next_action_due})`);

        fs.writeFileSync(LEADS_FILE, JSON.stringify(leads, null, 2));
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
        if (actions.length > 0) actions.forEach(act => batches[act].push(lead));
    });

    if (leadsUpdated) fs.writeFileSync(LEADS_FILE, JSON.stringify(leads, null, 2));

    // ---------------------------------------------------------
    // PHASE 1: SMS (INTERLEAVED)
    // ---------------------------------------------------------
    if (batches.SMS.length > 0) {
        console.log(`   📨 Processing ${batches.SMS.length} Outbound SMS (Interleaved)...`);

        // CHUNK SIZE = 5 (User Requirement: "Human Real-Time")
        const chunkSize = 5;
        for (let i = 0; i < batches.SMS.length; i += chunkSize) {

            // A. Check Inbound Queue (Priority)
            const queuedCount = await smsQueueManager.processInboundQueue();
            if (queuedCount > 0) console.log(`      ⚡ Interrupted Outbound to process ${queuedCount} Inbound replies.`);

            // B. Process Chunk
            const chunk = batches.SMS.slice(i, i + chunkSize);

            // INCREMENT ATTEMPTS SAFELY
            chunk.forEach(l => {
                // Ensure we bump the count if not already done this cycle
                const cleanLead = leads.find(lead => lead.phone === l.phone);
                if (cleanLead) incrementLeadSafe(cleanLead);
            });

            // console.log(`      ➡️ Sending Chunk ${i / chunkSize + 1}...`);
            await smsEngine.runSmartSmsBatch(chunk);

            // C. Brief Pause (Yield)
            await new Promise(r => setTimeout(r, 1000));
        }
    } else {
        // Even if no outbound, we must check inbound queue!
        await smsQueueManager.processInboundQueue();
    }

    // ---------------------------------------------------------
    // PHASE 2: MAIL
    // ---------------------------------------------------------

    // A. Check Inbound (Priority)


    // 4.2 Process Inbound Email Queue (Webhook + IMAP)
    const emailReplies = await emailEngine.processInboundQueue();
    // NEW: Check IMAP Inbox directly (No Webhook needed)
    await monitorInbox(); // Will safely skip if already scanning

    // 5. Outbound Processing
    // ...

    // B. Process Outbound
    if (batches.MAIL.length > 0) {
        console.log(`   📧 Processing ${batches.MAIL.length} Outbound Emails...`);
        const { generateFeedbackRequest } = require('../agent/salesBot'); // Ensure imported

        for (const lead of batches.MAIL) {

            // DYNAMIC CONTENT GENERATION (Replcaing Templates)
            // Context: Use last call summary or just general "Follow up"
            let summaryText = "our previous attempts to reach you";
            if (lead.last_call_summary) {
                try {
                    const s = JSON.parse(lead.last_call_summary);
                    summaryText = s.conversation_summary || s.text_summary || summaryText;
                } catch (e) { }
            }

            console.log(`      ✨ Generating Dynamic Email for ${lead.email}...`);
            const fullMsg = await generateFeedbackRequest(summaryText, 'EMAIL');

            // Parse Subject
            let subject = "Follow up from Hivericks";
            let body = fullMsg;

            const subjectMatch = fullMsg.match(/SUBJECT:\s*(.+)(\r?\n|$)/i);
            if (subjectMatch) {
                subject = subjectMatch[1].trim();
                body = fullMsg.replace(subjectMatch[0], '').trim();
            }

            const sent = await emailEngine.sendEmail(lead, subject, body);

            if (sent) {
                // UPDATE LEAD TO PREVENT LOOP (Now centralized)
                const freshLeads = readJSON(LEADS_FILE);
                const lIndex = freshLeads.findIndex(l => l.phone === lead.phone);

                if (lIndex !== -1) {
                    // Use centralized increment which handles date checks
                    incrementLeadSafe(freshLeads[lIndex]);
                }
            }

            // Interleaved Check
            await smsQueueManager.processInboundQueue();
        }
    }

    // ---------------------------------------------------------
    // PHASE 3: VOICE (ARBITRATED)
    // ---------------------------------------------------------
    if (batches.VOICE.length > 0) {
        if (false && !isCallTime()) { // FORCE ENABLE: BYPASS TIME CHECK
            console.log(`   ⏳ Skipping VOICE (Outside Window).`);
        } else {
            // Warmup
            await warmup();
            console.log(`   ☎️ Processing ${batches.VOICE.length} Calls...`);

            for (const lead of batches.VOICE) {
                // A. Check Inbound SMS Logic FIRST
                const queued = await smsQueueManager.processInboundQueue();
                if (queued > 0) console.log(`      ⚡ Voice Paused for SMS Queue.`);

                // B. Dial
                console.log(`      📞 Dialing ${lead.phone}...`);
                const attemptBefore = lead.attempt_count || 0;

                const sid = await voiceEngine.dialLead(lead);

                // C. Wait & Block (Exclusive Port Usage)
                if (sid) {
                    await waitForCallCompletion(lead.phone, sid);

                    // Attempt Increment Logic (Exempt User Requests)
                    const isUserReq = ['SMS_TO_CALL_REQUESTED', 'MAIL_TO_CALL_REQUESTED'].includes(lead.status);

                    if (!isUserReq) {
                        // Lock & Load
                        const freshLeads = readJSON(LEADS_FILE);
                        const lIndex = freshLeads.findIndex(l => l.phone === lead.phone);
                        if (lIndex !== -1) {
                            freshLeads[lIndex].attempt_count = (freshLeads[lIndex].attempt_count || 0) + 1;
                            fs.writeFileSync(LEADS_FILE, JSON.stringify(freshLeads, null, 2));
                            console.log(`      📈 Attempt Count Incremented -> ${freshLeads[lIndex].attempt_count}`);
                        }
                    } else {
                        console.log(`      🛡️  Escalation Call: Attempt count NOT incremented.`);
                    }
                }

                // D. Yield before next call
                await new Promise(r => setTimeout(r, 2000));
            }
        }
    }
};

// HELPER: Wait for Call
const waitForCallCompletion = async (phone, sid) => {
    // Poll logs until status is terminal
    const START = Date.now();
    while (Date.now() - START < 600000) { // 10 min max
        const leads = readJSON(LEADS_FILE);
        const l = leads.find(le => le.phone === phone);
        if (l && ['CALL_COMPLETED', 'CALL_BUSY', 'CALL_NO_ANSWER', 'CALL_DROPPED'].includes(l.status)) {
            return;
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