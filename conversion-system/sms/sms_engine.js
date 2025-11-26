// ---------------------------------------------------------
// TASK 4: WHATSAPP FALLBACK ENGINE (SENDER)
// ---------------------------------------------------------

require('dotenv').config({ path: '../.env' });
const client = require('twilio')(process.env.TWILIO_SID, process.env.TWILIO_AUTH);
const fs = require('fs');
const path = require('path');
const { fillSMSTemplate } = require('./templates');

const LEADS_FILE = path.join(__dirname, '../processed_leads/clean_leads.json');

const runWhatsAppCampaign = async () => {
    console.log("🚀 Starting WhatsApp Campaign...");

    if (!fs.existsSync(LEADS_FILE)) {
        console.log("❌ clean_leads.json not found.");
        return;
    }

    const leads = JSON.parse(fs.readFileSync(LEADS_FILE, 'utf-8'));

    // 1. FILTER TARGETS (Updated)
    // We now accept "CALLED" (Missed Call) OR "CALL_LATER" (Pressed 2)
    const targets = leads.filter(l => 
        (l.status === "CALLED" || l.status === "CALL_LATER") && 
        l.phone
    );

    console.log(`📱 Found ${targets.length} leads for WhatsApp.`);

    for (const lead of targets) {
        
        // 2. CONTEXTUAL MESSAGE LOGIC
        let msgBody = "";
        
        if (lead.status === "CALL_LATER") {
            // Specific message for people who pressed 2
            const firstName = lead.name.split(' ')[0];
            msgBody = `Hi ${firstName}, noted that you asked for a callback later. When is a good time for you?`;
        } else {
            // Standard message for missed calls (Status: CALLED)
            msgBody = fillSMSTemplate("SMS_1", lead);
        }

        let phone = lead.phone;

        // Handle object bug
        if (typeof phone === 'object') phone = phone.number || phone.phone;

        // WHATSAPP FORMATTING
        // Twilio requires the format: "whatsapp:+919876543210"
        const toWhatsApp = `whatsapp:${phone}`;
        const fromWhatsApp = 'whatsapp:+14155238886'; // This is the Twilio Sandbox Number

        try {
            console.log(`   💬 Sending WhatsApp to ${lead.name} [Status: ${lead.status}]...`);

            const message = await client.messages.create({
                body: msgBody,
                from: fromWhatsApp,
                to: toWhatsApp
            });

            console.log(`      ✅ Sent! SID: ${message.sid}`);
            
            lead.status = "WHATSAPP_SENT";
            lead.last_sms_time = new Date().toISOString();

        } catch (error) {
            console.log(`      ❌ Failed: ${error.message}`);
            if (error.code === 63015) {
                console.log("         💡 TIP: You must send 'join <code-word>' to the Sandbox number first!");
            }
        }
    }

    fs.writeFileSync(LEADS_FILE, JSON.stringify(leads, null, 2));
    console.log("\n💾 WhatsApp Progress Saved.");
};

runWhatsAppCampaign();