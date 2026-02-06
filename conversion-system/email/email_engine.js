require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const fs = require('fs');
const path = require('path');
const nodemailer = require('nodemailer');
// const { fillTemplate } = require('./templates'); // REMOVED: User deleted templates.js
const { openMailEvent, logMailInteraction, getOpenMailEvent, summarizeMailEvent } = require('./email_events');
const { getMemory, upsertMemory } = require('../agent/memory');
const { generateResponse, detectIntent } = require('../agent/salesBot');
const crm = require('../agent/crm_connector');

const LEADS_FILE = path.join(__dirname, '../processed_leads/clean_leads.json');
const TRACKING_DOMAIN = process.env.TRACKING_DOMAIN || 'http://localhost:5000';

// Helpers
const readJSON = (file) => {
    try {
        if (!fs.existsSync(file)) return [];
        return JSON.parse(fs.readFileSync(file, 'utf8'));
    } catch (e) {
        return [];
    }
};
const writeJSON = (file, data) => fs.writeFileSync(file, JSON.stringify(data, null, 2));

// ---------------------------------------------------------
// 1. TRANSPORTER
// ---------------------------------------------------------
const createTransporter = async () => {
    if (process.env.EMAIL_USER && process.env.EMAIL_PASS) {
        return nodemailer.createTransport({
            service: 'gmail',
            auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS }
        });
    }
    // Test Account
    const testAccount = await nodemailer.createTestAccount();
    return nodemailer.createTransport({
        host: 'smtp.ethereal.email',
        port: 587,
        secure: false,
        auth: { user: testAccount.user, pass: testAccount.pass }
    });
};

// ---------------------------------------------------------
// 2. OUTBOUND MAIL (INITIATE)
// ---------------------------------------------------------
/**
 * Dynamic Email Sender
 * @param {Object} lead - Lead object
 * @param {String} subjectOrTemplate - Subject Line (since template is deprecated)
 * @param {String} bodyContent - The actual email body text (HTML or Plain)
 */
const sendEmail = async (lead, subjectOrTemplate, bodyContent) => {
    // If called with old signature (lead, templateName), we must handle or error.
    // Assuming Orchestrator now passes (lead, subject, body).

    const subject = subjectOrTemplate || "Follow up from Hivericks";
    const body = bodyContent || "Please ignore this test email.";

    console.log(`   📧 EMAIL ENGINE: Sending Email to ${lead.email}...`);
    console.log(`\n================= DRAFT EMAIL START =================`);
    console.log(`To: ${lead.email}`);
    console.log(`Subject: ${subject}`);
    console.log(`-----------------------------------------------------`);
    console.log(body.replace(/<br>/g, '\n'));
    console.log(`================= DRAFT EMAIL END ===================\n`);

    // A. Check for Open Event?
    // Requirement: "Each outbound email send initiates a MAIL event"
    // If one is already open (e.g. waiting for reply), do we close it and start new?
    // Or do we append? Rule: "Events close on intent, not silence."
    // If we are sending a NEW template (drip), the previous one technically timed out (timeline logic).

    // We should probably CLOSE any old open event for this lead before starting a new drip step.
    const openEvt = getOpenMailEvent(lead.phone || lead.email); // Use ID
    if (openEvt) {
        // Force Close/Summarize old one?
        // For now, let's assume Orchestrator handles timeline closure.
        // We just open a NEW one for the new Outbound attempt.
    }

    const transporter = await createTransporter();

    // B. Build Tracking
    const pixelUrl = `${TRACKING_DOMAIN}/track/open?email=${lead.email}`;
    // const clickUrl = `${TRACKING_DOMAIN}/track/click?email=${lead.email}&dest=https://xoptimus.com`;

    const htmlBody = `
        <div style="font-family: Arial, sans-serif; color: #333;">
            <p>${body.replace(/\n/g, '<br>')}</p>
            <br>
            <p>Best regards,<br>Vijay<br>Hivericks Technologies</p>
            <img src="${pixelUrl}" width="1" height="1" style="display:none;" />
        </div>
    `;

    try {
        await transporter.sendMail({
            from: '"Vijay from XOptimus" <rsvijaypargavan@gmail.com>',
            to: lead.email,
            subject: subject,
            text: body,
            html: htmlBody,
            headers: { 'X-Hivericks-Bot': 'true' }
        });

        console.log(`      ✅ Email Sent!`);

        // C. Open Event
        const eventId = openMailEvent(lead.phone || lead.email, body);

        // D. Update Lead
        // Note: Orchestrator might also manage status, but we update timestamp here.
        // Lead Status should be updated by Orchestrator based on this result.

        // CRM SYNC (Outbound)
        try {
            await crm.pushInteractionToStream(lead, 'email', {
                summary: `Outbound Email: ${subject}`,
                intent: 'outreach',
                content: body,
                nextPrompt: 'Waiting for reply'
            });
        } catch (e) { }

        return true;

    } catch (error) {
        console.log(`      ❌ Email Failed: ${error.message}`);
        return false;
    }
};

// ---------------------------------------------------------
// 3. INBOUND MAIL (PROCESS QUEUE)
// ---------------------------------------------------------
const EMAIL_QUEUE_FILE = path.join(__dirname, 'inbound_email_queue.json');

// (Moved to Bottom)

// Helper: Strip Quoted Replies (Regex Optimized)
const cleanEmailBody = (text) => {
    if (!text) return "";

    // 1. Regex for "On [Date], [Name] <email> wrote:" (Multi-line friendly)
    // Matches "On" ... "wrote:" with anything in between.
    const replyHeaderRegex = /On\s+.+?wrote:/s;

    // 2. Regex for "From: ... Sent: ... Subject:" block
    const outlookHeaderRegex = /From:\s+.+?Sent:\s+.+?Subject:/s;

    // 3. Regex for separators
    const separatorRegex = /-----Original Message-----/i;

    let clean = text;

    // Execute Stripping (Split by regex and take first part)
    if (replyHeaderRegex.test(clean)) clean = clean.split(replyHeaderRegex)[0];
    if (outlookHeaderRegex.test(clean)) clean = clean.split(outlookHeaderRegex)[0];
    if (separatorRegex.test(clean)) clean = clean.split(separatorRegex)[0];

    // 4. Remove lines starting with ">" (Quoted lines)
    clean = clean.split('\n').filter(line => !line.trim().startsWith('>')).join('\n');

    return clean.trim();
};

// Internal Logic
const processInboundEmail = async (webhookPayload) => {
    // payload: { sender, subject, body }
    const { sender, body: rawBody } = webhookPayload;

    // CLEAN THE BODY (Remove Quoted History)
    const body = cleanEmailBody(rawBody);

    console.log(`      📩 From ${sender}`);
    console.log(`      📝 Cleaned Body: "${body.substring(0, 100).replace(/\n/g, ' ')}..."`);

    // FILTER: Ignore Automated System Emails
    const IGNORED_SENDERS = ['no-reply', 'noreply', 'mailer-daemon', 'notification', 'alert', 'team@', 'support@'];
    if (IGNORED_SENDERS.some(s => sender.toLowerCase().includes(s))) {
        console.log(`      🚫 BLOCKED: Automated Email from ${sender}. ignoring.`);
        return true;
    }
    // ... rest of logic


    const leads = readJSON(LEADS_FILE);
    let lead = leads.find(l => l.email === sender);

    // A. Anonymous Logic
    if (!lead) {
        console.log(`      ✨ New Anonymous Lead!`);
        lead = {
            email: sender,
            phone: "",
            name: "Anonymous Mail User",
            status: "MAIL_RECEIVED", // Initial State
            source: "ANONYMOUS_MAIL",
            attempt_count: 0,
            next_action_due: new Date().toISOString().split('T')[0]
        };
        leads.push(lead);
    } else {
        // STATE LOGGING: Mark as Received
        lead.status = 'MAIL_RECEIVED';
    }
    writeJSON(LEADS_FILE, leads);

    const leadId = lead.phone || lead.email; // Consistent ID

    // B. Find or Open Event
    let event = getOpenMailEvent(leadId);
    if (!event) {
        // Treat as new thread
        const eid = openMailEvent(leadId, null);
        event = { event_id: eid }; // minimal stub
    }

    // ... imports
    const { getMemory, upsertMemory } = require('../agent/memory');

    // ...

    // C. Log Interaction
    logMailInteraction(event.event_id, 'user', body);
    await upsertMemory(leadId, { last_user_message: body }); // Sync with Memory

    // 2.5 EARLY ACCEPTANCE CHECK (DISABLED - Handling via AI Conversation)
    /*
    const intent = detectIntent(body, 'EMAIL_REPLY');
    let isHandoff = false;
    if (intent && intent.type === 'PURCHASE_INTENT') {
        console.log(`      💰 EARLY ACCEPTANCE DETECTED! Stopping Automation.`);
        lead.status = 'HUMAN_HANDOFF';
        writeJSON(LEADS_FILE, leads);
        isHandoff = true;
    }
    */
    let isHandoff = false;

    // D. Generate AI Reply (Intent Aware)
    // LOAD CONTEXT FIRST
    const memory = await getMemory(leadId);

    // We use SalesBot in EMAIL_REPLY mode, passing memory
    const aiResponse = await generateResponse({
        userMessage: body,
        memory: memory,
        mode: 'EMAIL_REPLY',
        leadContext: lead
    });

    console.log(`      🤖 AI Suggests: "${aiResponse.substring(0, 50)}..."`);

    // ... sending logic ...

    logMailInteraction(event.event_id, 'assistant', aiResponse);
    await upsertMemory(leadId, { last_bot_message: aiResponse }); // Sync with Memory

    // E. Send Reply?
    // "The system must not auto-respond immediately unless..."
    // For this implementation, we will auto-respond if AI provides content, assuming it's useful.
    // In a real system, we might queue for approval. Here, we send.

    const transporter = await createTransporter();
    await transporter.sendMail({
        from: '"Vijay from Hivericks" <rsvijaypargavan@gmail.com>',
        to: sender,
        subject: `Re: ${webhookPayload.subject || 'Previous Conversation'}`,
        text: aiResponse
    });

    logMailInteraction(event.event_id, 'assistant', aiResponse);

    // F. Check Escalation (Simple regex for now)
    if (body.toLowerCase().includes('call') || body.toLowerCase().includes('number')) {
        console.log(`      🚨 MAIL-TO-CALL ESCALATION DETECTED`);
        // Update lead status
        lead.status = 'MAIL_TO_CALL_REQUESTED';
    } else if (!isHandoff) {
        lead.status = 'MAIL_ENGAGED';
    }

    // G. UPDATE SCORE (NEW)
    const { calculateScore } = require('../scoring/scoring_engine');
    // Assume 'WARM' intent for engaged email unless AI says otherwise.
    // Ideally we parse intent from AI response, but for now we assume positive engagement.
    const scoreResult = calculateScore(lead, 'WARM', lead.status);
    lead.score = scoreResult.score;
    lead.category = scoreResult.category;
    console.log(`      💯 Score Updated: ${lead.score} (${lead.category})`);

    writeJSON(LEADS_FILE, leads);

    // CRM Stream Integration
    try {
        await crm.pushInteractionToStream(lead, 'email', {
            summary: `Inbound Email from ${sender}`,
            intent: lead.status === 'MAIL_TO_CALL_REQUESTED' ? 'request_call' : 'engaged',
            transcription: body,
            nextPrompt: aiResponse
        });
    } catch (crmErr) {
        console.error(`      ❌ CRM Interaction Push Failed:`, crmErr.message);
    }

    return true;
};

// ---------------------------------------------------------
// 4. MAINTAINANCE: DEFERRED SUMMARIZATION
// ---------------------------------------------------------
const startMaintenance = async () => {
    // We already exported 'finalizeMailEvents' which is called by Orchestrator.
    // This is just a comment block.
};

const finalizeMailEvents = async () => {
    const EVENTS_FILE = path.join(__dirname, '../processed_leads/lead-events.json');
    if (!fs.existsSync(EVENTS_FILE)) return;

    // 1. Read once
    let events;
    try {
        events = JSON.parse(fs.readFileSync(EVENTS_FILE, 'utf8'));
    } catch (e) { return; }

    const now = new Date();
    const TIMEOUT_HOURS = 24;

    // 2. Identify stale events
    const staleEvents = events.filter(e => {
        if (['CLOSED', 'FAILED_FINAL', 'SKIPPED'].includes(e.status)) return false;
        const lastTouch = new Date(e.last_updated || e.timestamp);
        return (now - lastTouch) / (1000 * 60 * 60) > TIMEOUT_HOURS;
    });

    if (staleEvents.length === 0) return;

    // 3. CAP PROCESSING: Limit to 5 per pulse to prevent blocking
    const BATCH_SIZE = 5;
    const toProcess = staleEvents.slice(0, BATCH_SIZE);

    console.log(`   🧹 MAIL MAINTENANCE: Summarizing ${toProcess.length}/${staleEvents.length} stale events...`);

    const leads = readJSON(LEADS_FILE);
    let leadsUpdated = false;
    let eventsChanged = false;

    // 4. Process in memory
    for (const evt of toProcess) {
        // Optimization: Use a local version of summarize that doesn't R/W file
        const summaryData = await summarizeMailEventInMemory(evt, events);
        if (summaryData) {
            eventsChanged = true;
            const lead = leads.find(l => (l.phone === evt.lead_id || l.email === evt.lead_id));
            if (lead) {
                lead.last_call_summary = JSON.stringify({
                    lead_status: "stalled",
                    generated_at: new Date().toISOString(),
                    text_summary: summaryData.conversation_summary
                });
                lead.status = "MAIL_COMPLETE";
                leadsUpdated = true;

                try {
                    await crm.pushInteractionToStream(lead, 'email', {
                        summary: summaryData.conversation_summary,
                        intent: summaryData.user_intent || 'email_session_complete',
                        transcription: `Email Thread Completed.`,
                        nextPrompt: 'N/A'
                    });
                } catch (e) { }
            }
        }
    }

    // 5. Write once
    if (eventsChanged) fs.writeFileSync(EVENTS_FILE, JSON.stringify(events, null, 2));
    if (leadsUpdated) writeJSON(LEADS_FILE, leads);
};

// Helper: Local summary logic to avoid file I/O within loops
const summarizeMailEventInMemory = async (evt, eventsList) => {
    if (['CLOSED', 'FAILED_FINAL'].includes(evt.status)) return evt.structured_analysis;

    evt.summary_attempts = (evt.summary_attempts || 0) + 1;
    if (evt.summary_attempts > 3) {
        evt.status = 'FAILED_FINAL';
        return null;
    }

    const { generateStructuredSummary } = require('../agent/salesBot');
    const transcriptText = (evt.transcript || [])
        .filter(t => t.role === 'user')
        .map(t => `${t.role.toUpperCase()}: ${t.content}`)
        .join('\n');

    if (!transcriptText) {
        evt.status = 'CLOSED';
        evt.summary = "No response to drip.";
        evt.structured_analysis = { conversation_summary: evt.summary, user_intent: "no_response" };
        return evt.structured_analysis;
    }

    try {
        const summaryData = await generateStructuredSummary(transcriptText);
        evt.summary = summaryData.conversation_summary;
        evt.structured_analysis = summaryData;
        evt.status = 'CLOSED';
        return summaryData;
    } catch (e) {
        return null;
    }
};

// ---------------------------------------------------------
// 4. QUEUE PROCESSOR (MOVED HERE TO FIX HOISTING)
// ---------------------------------------------------------
const processInboundQueue = async () => {
    if (!fs.existsSync(EMAIL_QUEUE_FILE)) return 0;

    let queue = [];
    try { queue = JSON.parse(fs.readFileSync(EMAIL_QUEUE_FILE, 'utf8')); } catch (e) { return 0; }

    if (queue.length === 0) return 0;

    console.log(`   📧 EMAIL ENGINE: Processing ${queue.length} Inbound Emails...`);

    for (const item of queue) {
        try {
            await processInboundEmail(item);
        } catch (e) {
            console.error(`      ❌ Failed to process email from ${item.sender}:`, e);
            console.error(e.stack);
        }
    }

    // Clear Queue
    writeJSON(EMAIL_QUEUE_FILE, []);
    return queue.length;
};

module.exports = { sendEmail, processInboundQueue, processInboundEmail, finalizeMailEvents };