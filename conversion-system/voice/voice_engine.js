// conversion-system/voice/voice_engine.js
// ---------------------------------------------------------
// VOICE ENGINE: PURE EXECUTION UTILITY
// Responsibilities:
// - Initiate calls via Twilio
// - Handle basic success/fail logging for the dial attempt
// - delegated by Orchestrator
// ---------------------------------------------------------

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const client = require('twilio')(
    process.env.TWILIO_SID,
    process.env.TWILIO_AUTH
);

// ---------------------------------------------------------
// DIAL LEAD FUNCTION
// ---------------------------------------------------------
async function dialLead(lead) {
    // ⚠️ CRITICAL: Always read process.env here to get the LATEST Ngrok URL
    // (Orchestrator updates this value dynamically when switching ports)
    const SERVER_URL = process.env.SERVER_URL;

    if (!SERVER_URL) {
        throw new Error("Missing SERVER_URL in environment - Is Ngrok running?");
    }

    if (!lead.phone) {
        throw new Error(`Lead ${lead.name} has no phone number`);
    }

    console.log(`   ☎️ VoiceEngine: Dialing ${lead.name} (${lead.phone})...`);
    console.log(`      🔗 Webhook Server: ${SERVER_URL}`);

    try {
        const call = await client.calls.create({
            url: `${SERVER_URL}/voice`,
            to: lead.phone,
            from: process.env.TWILIO_PHONE,
            statusCallback: `${SERVER_URL}/voice/status`,
            statusCallbackEvent: ['initiated', 'ringing', 'answered', 'completed']
        });

        console.log(`      ✅ Call Initiated! SID: ${call.sid}`);
        return call.sid;

    } catch (error) {
        console.error(`      ❌ VoiceEngine Error: ${error.message}`);
        throw error;
    }
}

module.exports = { dialLead };
