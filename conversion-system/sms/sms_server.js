// ---------------------------------------------------------
// TASK 4: WHATSAPP/SMS LISTENER (DEBUG MODE)
// ---------------------------------------------------------
const express = require('express');
const bodyParser = require('body-parser');
const fs = require('fs');
const path = require('path');
const { MessagingResponse } = require('twilio').twiml;

const app = express();
app.use(bodyParser.urlencoded({ extended: false }));

// PORT CONFIGURATION
const PORT = 4000; 
const LEADS_FILE = path.resolve(__dirname, '../processed_leads/clean_leads.json');

// 1. GLOBAL DEBUG LOGGER (Catches ANY traffic)
app.use((req, res, next) => {
    console.log(`\n🔔 INCOMING SIGNAL: ${req.method} ${req.url}`);
    next();
});

// HELPER: Update Status
const updateLeadStatus = (phoneNumber, newStatus) => {
    if (!fs.existsSync(LEADS_FILE)) {
        console.log("   ❌ Error: clean_leads.json not found.");
        return false;
    }
    
    const leads = JSON.parse(fs.readFileSync(LEADS_FILE, 'utf-8'));
    
    // Normalize: Remove 'whatsapp:' and spaces
    const cleanIncoming = phoneNumber.replace('whatsapp:', '').replace(/\s/g, '');
    console.log(`   🔍 Searching for: ${cleanIncoming}`);

    const lead = leads.find(l => {
        const cleanLeadPhone = (l.phone || "").replace(/\s/g, '');
        return cleanLeadPhone === cleanIncoming;
    });

    if (lead) {
        const oldStatus = lead.status;
        lead.status = newStatus;
        lead.last_reply = new Date().toISOString();
        
        fs.writeFileSync(LEADS_FILE, JSON.stringify(leads, null, 2));
        console.log(`   💾 SUCCESS: Updated ${lead.name} (${oldStatus} -> ${newStatus})`);
        return true;
    } else {
        console.log(`   ⚠️ FAILED: Number not found in database.`);
        return false;
    }
};

// MAIN ROUTE
app.post('/sms', (req, res) => {
    const incomingMsg = req.body.Body ? req.body.Body.trim().toLowerCase() : "empty";
    const fromPhone = req.body.From; 
    
    console.log(`   📩 Message Content: "${incomingMsg}" from ${fromPhone}`);

    const twiml = new MessagingResponse();

    // 2. ANALYZE INTENT
    if (['stop', 'cancel', 'no'].includes(incomingMsg)) {
        updateLeadStatus(fromPhone, "STOPPED");
        twiml.message("You have been unsubscribed.");
    }
    else if (['yes', 'interested', 'sure', 'ok'].includes(incomingMsg)) {
        updateLeadStatus(fromPhone, "INTERESTED");
        twiml.message("Great! A human agent will follow up.");
    }
    else {
        updateLeadStatus(fromPhone, "REPLIED");
        twiml.message("Thanks for your reply.");
    }

    res.type('text/xml').send(twiml.toString());
});

app.listen(PORT, () => {
    console.log("------------------------------------------------");
    console.log(`📡 WhatsApp Listener running on http://localhost:${PORT}`);
    console.log("   Waiting for Twilio...");
    console.log("------------------------------------------------");
});