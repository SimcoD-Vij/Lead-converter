// ---------------------------------------------------------
// TASK 4: SMS SERVER WITH XOPTIMUS AGENT (ADVANCED)
// ---------------------------------------------------------
const express = require('express');
const bodyParser = require('body-parser');
const { MessagingResponse } = require('twilio').twiml;
const fs = require('fs');
const path = require('path');

// --- INTEGRATION: CONNECT TO AGENT BRAIN ---
const { generateResponse } = require('../agent/salesBot');
const { getMemory, upsertMemory } = require('../agent/memory');
// Import unified logger
const { logSmsSession } = require('./sms_engine');

const app = express();
app.use(bodyParser.urlencoded({ extended: false }));

// PORT CONFIGURATION
const PORT = 5000;
const LEADS_FILE = path.resolve(__dirname, '../processed_leads/clean_leads.json');

// HELPER: Update Lead Status
const updateLeadStatus = (phone, newStatus, extraFields = {}) => {
    if (!fs.existsSync(LEADS_FILE)) return;
    const leads = JSON.parse(fs.readFileSync(LEADS_FILE, 'utf-8'));

    const cleanPhone = phone.replace('whatsapp:', '');
    const lead = leads.find(l => (l.phone || '').replace(/\D/g, '') === cleanPhone.replace(/\D/g, ''));

    if (lead) {
        lead.status = newStatus;
        Object.assign(lead, extraFields);
        fs.writeFileSync(LEADS_FILE, JSON.stringify(leads, null, 2));
        console.log(`   📝 Status Updated: ${newStatus} for ${cleanPhone}`);
    }
};

// MAIN ROUTE
app.post('/sms', async (req, res) => {
    const incomingMsg = req.body.Body;
    const fromPhone = req.body.From; // e.g. whatsapp:+91...

    console.log(`\n📩 INCOMING from ${fromPhone}: "${incomingMsg}"`);

    const twiml = new MessagingResponse();

    // 1. CHECK STOP WORDS
    if (['stop', 'unsubscribe', 'cancel'].includes(incomingMsg.toLowerCase())) {
        twiml.message("You have been unsubscribed.");
        res.type('text/xml').send(twiml.toString());
        return;
    }

    try {
        // 2. LOG USER INPUT
        logSmsSession(fromPhone, 'user', incomingMsg);

        // 3. DETECT ESCALATION INTENT
        const lowerMsg = incomingMsg.toLowerCase();

        // A. IMMEDIATE CALL REQUEST
        if (/(call|speak|talk).*(now|immediately|right now)/.test(lowerMsg) ||
            lowerMsg === 'call me' || lowerMsg === 'call me now') {

            console.log("   🚨 ESCALATION: User requested immediate call.");
            updateLeadStatus(fromPhone, 'SMS_TO_CALL_REQUESTED');

            const reply = "Understood. I've alerted my manager to call you right away.";
            logSmsSession(fromPhone, 'assistant', reply);
            twiml.message(reply);
            res.type('text/xml').send(twiml.toString());
            return;
        }

        // B. SCHEDULED CALL REQUEST (Simple detection)
        if (/(call|speak).*(at|on|tomorrow|later|pm|am)/.test(lowerMsg)) {
            console.log("   📅 SCHEDULING: User wants to schedule a call.");

            // Extract time using AI (Simplified for now, assumes orchestrator handles logic)
            // We mark it as SCHEDULED so the AI knows to confirm time in next turn if vague,
            // or if specific, we assume the Human/Agent sync. 
            // Ideally, we'd use the SalesBot to extract the time entity.

            // For this iteration, let's update status and ask AI to confirm.
            updateLeadStatus(fromPhone, 'SMS_CALL_SCHEDULED', {
                scheduled_call_time: new Date().toISOString() // Placeholder, ideally parsed
            });

            // Let AI generate the confirmation based on the prompt
        }

        // 4. GENERATE RESPONSE
        const memory = await getMemory(fromPhone) || {};

        // Inject Status Context into Prompt
        let systemContext = "";
        if (lowerMsg.includes("call")) systemContext = "CONTEXT: User mentioned calling. If they gave a time, CONFIRM it and say we will call then. If asking for a call now, agree.";

        const aiReply = await generateResponse({
            userMessage: incomingMsg + "\n" + systemContext,
            memory: memory,
            mode: 'SMS_CHAT'
        });

        console.log(`   💡 Agent Says: "${aiReply}"`);

        // 5. UPDATE MEMORY & LOGGING
        await upsertMemory(fromPhone, { last_user_message: incomingMsg, last_bot_message: aiReply });
        logSmsSession(fromPhone, 'assistant', aiReply);

        // 6. SEND REPLY
        twiml.message(aiReply);

    } catch (error) {
        console.error("   ❌ Agent Error:", error);
        twiml.message("I'm connecting you to a human agent now.");
    }

    res.type('text/xml').send(twiml.toString());
});

app.listen(PORT, () => {
    console.log(`📡 XOptimus SMS Agent running on Port ${PORT}`);
});