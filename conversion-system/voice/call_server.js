// ---------------------------------------------------------
// TASK 3: VOICE BRAIN (FRESH BUILD)
// ---------------------------------------------------------
const express = require('express');
const bodyParser = require('body-parser');
const fs = require('fs');
const path = require('path');

const app = express();
app.use(bodyParser.urlencoded({ extended: false }));

const PORT = 3000;
const LEADS_FILE = path.resolve(__dirname, '../processed_leads/clean_leads.json');

// --- HELPER: UPDATE DATABASE ---
const saveResult = (callSid, status, digits) => {
    console.log(`\n💾 SAVING RESULT for SID: ${callSid}...`);

    if (!fs.existsSync(LEADS_FILE)) return console.log("❌ DB Missing");

    // 1. Read File
    let leads = JSON.parse(fs.readFileSync(LEADS_FILE, 'utf-8'));

    // 2. Find Lead by Call ID
    const lead = leads.find(l => l.last_call_sid === callSid);

    if (lead) {
        // 3. Update Logic
        lead.status = status;
        lead.last_response_digit = digits;
        
        // Scoring (Simple Version)
        if (status === "INTERESTED") lead.score = (lead.score || 0) + 40;
        if (status === "CALL_LATER") lead.score = (lead.score || 0) + 10;

        // 4. Write File
        fs.writeFileSync(LEADS_FILE, JSON.stringify(leads, null, 2));
        console.log(`   ✅ UPDATED: ${lead.name} is now ${status}`);
    } else {
        console.log("   ❌ ERROR: Call SID not found in database. (Did the Engine save it?)");
    }
};

// --- ROUTE 1: SPEAK SCRIPT ---
app.post('/voice', (req, res) => {
    const twiml = `
    <Response>
        <Say voice="Polly.Aditi">Hello! This is an automated call from the Sales Team.</Say>
        <Gather numDigits="1" action="/gather" method="POST" timeout="10">
            <Say voice="Polly.Aditi">
                Press 1 if you are Interested.
                Press 2 to Call Later.
                Press 3 if Not Interested.
            </Say>
        </Gather>
        <Say voice="Polly.Aditi">We didn't receive any input. Goodbye.</Say>
    </Response>
    `;
    res.type('text/xml');
    res.send(twiml);
});

// --- ROUTE 2: HANDLE INPUT ---
app.post('/gather', (req, res) => {
    const digit = req.body.Digits;
    const callSid = req.body.CallSid;

    console.log(`📞 INPUT: User pressed ${digit}`);

    let reply = "Sorry, invalid input.";
    let status = "CALL_COMPLETE";

    if (digit === '1') {
        reply = "Great! Connecting you to a human.";
        status = "INTERESTED";
    } else if (digit === '2') {
        reply = "Okay. We will call you tomorrow.";
        status = "CALL_LATER";
    } else if (digit === '3') {
        reply = "Understood. Goodbye.";
        status = "NOT_INTERESTED";
    }

    // Trigger Save
    saveResult(callSid, status, digit);

    res.type('text/xml');
    res.send(`<Response><Say voice="Polly.Aditi">${reply}</Say></Response>`);
});

app.listen(PORT, () => {
    console.log(`🤖 Voice Brain running on Port ${PORT}`);
});