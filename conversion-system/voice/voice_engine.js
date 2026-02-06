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

console.log("DEBUG AUTH: SID starts with", (process.env.TWILIO_SID || "").substring(0, 4));
console.log("DEBUG AUTH: AUTH length", (process.env.TWILIO_AUTH || "").length);

// ---------------------------------------------------------
// DIAL LEAD FUNCTION
// ---------------------------------------------------------
async function dialLead(lead, openingFile, openingText) {
    // ⚠️ CRITICAL: Always read process.env here to get the LATEST Ngrok URL
    // (Orchestrator updates this value dynamically when switching ports)
    const SERVER_URL = process.env.SERVER_URL;

    if (!SERVER_URL) {
        throw new Error("Missing SERVER_URL in environment - Is Ngrok running?");
    }

    if (!lead.phone) {
        console.log(`      ⚠️ Skipping Call: Lead ${lead.name} has no phone number.`);
        return null; // Graceful skip
    }
    console.log(`\n☎️ INITITATING CALL to ${lead.name} (${lead.phone})...`);
    console.log(`      🔗 Webhook Server: ${SERVER_URL}`);

    console.log("      🔍 DEBUG AUTH: TWILIO_SID =", (process.env.TWILIO_SID || "MISSING").substring(0, 4) + "****");
    console.log("      🔍 DEBUG AUTH: TWILIO_AUTH Length =", (process.env.TWILIO_AUTH || "").length);

    try {
        // Build URL with parameters
        let callUrl = `${SERVER_URL}/voice?`;
        if (openingFile) callUrl += `openingFile=${encodeURIComponent(openingFile)}&`;
        if (openingText) callUrl += `openingText=${encodeURIComponent(openingText)}&`;

        const call = await client.calls.create({
            url: callUrl,
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
