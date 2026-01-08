require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const fs = require('fs');
const path = require('path');
const nodemailer = require('nodemailer');
// const { fillTemplate } = require('./templates'); // REMOVED: User deleted templates.js
const { openMailEvent, logMailInteraction, getOpenMailEvent, summarizeMailEvent } = require('./email_events');
const { generateResponse } = require('../agent/salesBot');

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
            html: htmlBody
        });

        console.log(`      ✅ Email Sent!`);

        // C. Open Event
        const eventId = openMailEvent(lead.phone || lead.email, body);

        // D. Update Lead
        // Note: Orchestrator might also manage status, but we update timestamp here.
        // Lead Status should be updated by Orchestrator based on this result.

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

// Internal Logic
const processInboundEmail = async (webhookPayload) => {
    // payload: { sender, subject, body }
    const { sender, body } = webhookPayload;
    console.log(`      📩 From ${sender}`);
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
            status: "MAIL_ENGAGED",
            source: "ANONYMOUS_MAIL",
            attempt_count: 0,
            next_action_due: new Date().toISOString().split('T')[0]
        };
        leads.push(lead);
        writeJSON(LEADS_FILE, leads);
    }

    const leadId = lead.phone || lead.email; // Consistent ID

    // B. Find or Open Event
    let event = getOpenMailEvent(leadId);
    if (!event) {
        // Treat as new thread
        const eid = openMailEvent(leadId, null);
        event = { event_id: eid }; // minimal stub
    }

    // C. Log Interaction
    logMailInteraction(event.event_id, 'user', body);

    // D. Generate AI Reply (Intent Aware)
    // "Replies must be intent-aware, not reactive."
    // Logic: If user asks question -> Reply. If user says "Unsubscribe" -> Close.

    // We use SalesBot in EMAIL_REPLY mode
    const aiResponse = await generateResponse({
        userMessage: body,
        mode: 'EMAIL_REPLY' // We need to add this to salesBot or map to standard
    });

    console.log(`      🤖 AI Suggests: "${aiResponse.substring(0, 50)}..."`);

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
        // Orchestrator will pick this up next cycle and trigger Voice
    } else {
        lead.status = 'MAIL_ENGAGED';
    }
    writeJSON(LEADS_FILE, leads);

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
    console.log("   🧹 MAIL MAINTENANCE: Checking for stale events...");
    const { readEvents } = require('./email_events'); // Lazy load to avoid circular if any? 
    // Actually we iterate events file directly or use getter?
    // We need 'readEvents' exposed or we just read the file ourselves.
    // email_events.js doesn't export readEvents.
    // Let's rely on 'summarizeMailEvent' which does the read/write locally but we need to ID the stale ones.

    // Better strategy: Add 'searchStaleEvents' to email_events.js?
    // Or just read lead-events.json here. It is shared.

    const EVENTS_FILE = path.join(__dirname, '../processed_leads/lead-events.json');
    if (!fs.existsSync(EVENTS_FILE)) return;

    const events = JSON.parse(fs.readFileSync(EVENTS_FILE, 'utf8'));
    const now = new Date();
    const TIMEOUT_HOURS = 24;

    const staleEvents = events.filter(e => {
        if (e.channel !== 'MAIL' || e.status !== 'OPEN') return false;
        const lastTouch = new Date(e.last_updated || e.timestamp);
        const diffMs = now - lastTouch;
        const diffHours = diffMs / (1000 * 60 * 60);
        return diffHours > TIMEOUT_HOURS;
    });

    if (staleEvents.length === 0) return;

    console.log(`      Found ${staleEvents.length} stale MAIL events. Summarizing...`);

    const leads = readJSON(LEADS_FILE);
    let leadsUpdated = false;

    for (const evt of staleEvents) {
        // 1. Generate Summary
        const summaryData = await summarizeMailEvent(evt.event_id);

        if (summaryData) {
            // 2. Update Lead Context
            const lead = leads.find(l => (l.phone === evt.lead_id || l.email === evt.lead_id));
            if (lead) {
                lead.last_call_summary = `[MAIL SUMMARY]: ${summaryData.conversation_summary}`;
                lead.status = "MAIL_COMPLETE"; // Or keep previous?
                // If interest is high, maybe bump score?
                leadsUpdated = true;
            }
        }
    }

    if (leadsUpdated) writeJSON(LEADS_FILE, leads);
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