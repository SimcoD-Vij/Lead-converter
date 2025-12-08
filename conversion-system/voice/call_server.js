/*
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
        <Say voice="Polly.Aditi">Hello! This is an automated call from the Hivericks Technologies.</Say>
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
*/
// ---------------------------------------------------------
// TASK 3: AI VOICE BRAIN (AGENTIC BUILD)
// ---------------------------------------------------------
// ---------------------------------------------------------
// TASK 3: AI VOICE BRAIN (AGENTIC BUILD)
// ---------------------------------------------------------
const express = require('express');
const bodyParser = require('body-parser');
const fs = require('fs');
const path = require('path');
const { OpenAI } = require('openai'); 

const app = express();
app.use(bodyParser.urlencoded({ extended: false }));

const PORT = 3000;
const LEADS_FILE = path.resolve(__dirname, '../processed_leads/clean_leads.json');

// --- 1. SETUP LOCAL AI (OLLAMA) ---
const client = new OpenAI({
    baseURL: 'http://127.0.0.1:11434/v1', 
    apiKey: 'ollama', 
});

// --- 2. CONFIGURATION: NAME & PERSONA ---
// We tell the AI who it is here.
const SYSTEM_PROMPT = `
You are Vijaypargavan, a friendly and professional assistant for Hivericks Technologies.
- Your goal is to see if the user is interested in our new software services.
- Keep your responses SHORT (1-2 sentences max) because this is a phone call.
- Be polite, natural, and conversational.
- If they are not interested, say goodbye politely.
- Do NOT use emojis or complex formatting.
`;

let callHistory = {};

// --- HELPER: UPDATE DATABASE ---
const saveStatus = (callSid, status) => {
    if (!fs.existsSync(LEADS_FILE)) return;
    let leads = JSON.parse(fs.readFileSync(LEADS_FILE, 'utf-8'));
    const lead = leads.find(l => l.last_call_sid === callSid);

    if (lead) {
        lead.status = status;
        fs.writeFileSync(LEADS_FILE, JSON.stringify(leads, null, 2));
        console.log(`   💾 DB Updated: Lead is now ${status}`);
    }
};

// --- ROUTE 1: START THE CALL ---
app.post('/voice', async (req, res) => {
    const callSid = req.body.CallSid;
    console.log(`\n📞 NEW CALL STARTED: ${callSid}`);

    callHistory[callSid] = [
        { role: "system", content: SYSTEM_PROMPT }
    ];

    saveStatus(callSid, "AI_CONVERSATION_START");

    // Ask AI (Vijaypargavan) to generate the greeting
    const aiResponse = await generateAIResponse(callSid, "The user just picked up. Say hello and introduce yourself as Vijaypargavan.");

    // NOTE: We use "Polly.Matthew" because it is a clear MALE voice.
    // Twilio does not have a specific "Vijaypargavan" voice setting.
    const twiml = `
    <Response>
        <Say voice="Polly.Matthew">${aiResponse}</Say>
        <Gather input="speech" action="/gather" method="POST" timeout="2" language="en-US">
        </Gather>
        <Say voice="Polly.Matthew">I didn't hear anything. Goodbye.</Say>
    </Response>
    `;
    
    res.type('text/xml');
    res.send(twiml);
});

// --- ROUTE 2: HANDLE USER SPEECH ---
app.post('/gather', async (req, res) => {
    const callSid = req.body.CallSid;
    const userSpeech = req.body.SpeechResult; 

    if (!userSpeech) {
        res.type('text/xml');
        return res.send(`<Response><Hangup/></Response>`);
    }

    console.log(`🗣️  USER SAID: "${userSpeech}"`);

    const aiResponse = await generateAIResponse(callSid, userSpeech);
    console.log(`🤖 VIJAYPARGAVAN SAID: "${aiResponse}"`);

    const twiml = `
    <Response>
        <Say voice="Polly.Matthew">${aiResponse}</Say>
        <Gather input="speech" action="/gather" method="POST" timeout="2">
        </Gather>
    </Response>
    `;

    res.type('text/xml');
    res.send(twiml);
});

// --- HELPER: TALK TO OLLAMA ---
async function generateAIResponse(callSid, userInput) {
    try {
        if (!callHistory[callSid]) callHistory[callSid] = []; 
        callHistory[callSid].push({ role: "user", content: userInput });

        const completion = await client.chat.completions.create({
            model: "llama3.2", 
            messages: callHistory[callSid],
            max_tokens: 100, 
        });

        const botReply = completion.choices[0].message.content;

        callHistory[callSid].push({ role: "assistant", content: botReply });

        return botReply;

    } catch (error) {
        console.error("❌ OLLAMA ERROR:", error.message);
        return "I am having a little trouble connecting. Can you say that again?";
    }
}

app.listen(PORT, () => {
    console.log(`🤖 Vijaypargavan (Voice Brain) running on Port ${PORT}`);
});