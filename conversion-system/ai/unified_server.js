
require('dotenv').config({ path: '../.env' });
const express = require('express');
const bodyParser = require('body-parser');
const twilio = require('twilio');
const { MessagingResponse } = require('twilio').twiml;

// Import our modularized agent components
const { generateResponse } = require('../agent/salesBot');
const { logInteraction, getMemory } = require('../agent/memory');
const { textToSSML } = require('../agent/voice_utils');

const app = express();
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

const PORT = 3000; 

// --- 1. VOICE: HANDLE SPEECH (The "Ear") ---
app.post('/gather', async (req, res) => {
    const callSid = req.body.CallSid;
    const userSpeech = req.body.SpeechResult;
    const leadId = req.body.From || 'unknown_caller';

    // If user stayed silent, just reprompt
    if (!userSpeech) {
        const twiml = `
        <Response>
            <Gather input="speech" action="/gather" method="POST" timeout="3"></Gather>
        </Response>`;
        return res.type('text/xml').send(twiml);
    }

    console.log(`🗣️  USER (Voice): "${userSpeech}"`);

    // A. BRAIN: Generate Answer
    // We explicitly set mode to 'VOICE_CALL' so it keeps it short & spoken
    const memory = await getMemory(leadId);
    const aiText = await generateResponse({ 
        userMessage: userSpeech, 
        memory: memory, 
        mode: 'VOICE_CALL' 
    });

    // B. LOGGING: Extract Intent
    let summary = null;
    if (userSpeech.match(/price|cost/i)) summary = "Lead asked about Pricing";
    if (userSpeech.match(/not interested|busy/i)) summary = "Lead Objected/Busy";
    
    await logInteraction(leadId, 'VOICE', `User: ${userSpeech} | AI: ${aiText}`, summary);

    // C. HUMANIZE: Apply SSML
    const ssmlResponse = textToSSML(aiText);

    // D. RESPOND
    // Using Amazon Polly (Matthew) for a clear, standard male voice
    // "language='en-IN'" ensures Indian accent compatibility if preferred
    const twiml = `
    <Response>
        <Say voice="Polly.Matthew" language="en-IN">${ssmlResponse}</Say>
        <Gather input="speech" action="/gather" method="POST" timeout="2" language="en-IN"></Gather>
    </Response>
    `;
    res.type('text/xml').send(twiml);
});

// --- 2. VOICE: START CALL (The "Hello") ---
app.post('/voice', async (req, res) => {
    // Initial greeting when call picks up
    const greeting = "Hello? This is Vijay from Hivericks.";
    const ssmlGreeting = textToSSML(greeting);

    const twiml = `
    <Response>
        <Say voice="Polly.Matthew" language="en-IN">${ssmlGreeting}</Say>
        <Gather input="speech" action="/gather" method="POST" timeout="2" language="en-IN"></Gather>
    </Response>
    `;
    res.type('text/xml').send(twiml);
});

// --- 3. SMS: HANDLE MESSAGES (The "Chat") ---
app.post('/sms', async (req, res) => {
    const incomingMsg = req.body.Body;
    const leadId = req.body.From;

    console.log(`📩 USER (SMS): "${incomingMsg}"`);

    // A. BRAIN: Generate Answer
    // Mode is 'SMS_CHAT' allows emojis and links
    const memory = await getMemory(leadId);
    const aiText = await generateResponse({ 
        userMessage: incomingMsg, 
        memory: memory, 
        mode: 'SMS_CHAT' 
    });

    // B. LOGGING
    let summary = null;
    if (incomingMsg.match(/call me/i)) summary = "Requested Call";
    
    await logInteraction(leadId, 'SMS', `User: ${incomingMsg} | AI: ${aiText}`, summary);

    // C. RESPOND
    const twiml = new MessagingResponse();
    twiml.message(aiText);
    res.type('text/xml').send(twiml.toString());
});

app.listen(PORT, () => {
    console.log(`🚀 UNIFIED SERVER RUNNING ON PORT ${PORT}`);
    console.log(`   - Voice Engine: Amazon Polly (SSML Enabled)`);
    console.log(`   - Intelligence: Ollama (Mode Switching Enabled)`);
});