"use strict";

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
var express = require('express');

var bodyParser = require('body-parser');

var fs = require('fs');

var path = require('path');

var _require = require('openai'),
    OpenAI = _require.OpenAI;

var app = express();
app.use(bodyParser.urlencoded({
  extended: false
}));
var PORT = 3000;
var LEADS_FILE = path.resolve(__dirname, '../processed_leads/clean_leads.json'); // --- 1. SETUP LOCAL AI (OLLAMA) ---

var client = new OpenAI({
  baseURL: 'http://127.0.0.1:11434/v1',
  apiKey: 'ollama'
}); // --- 2. CONFIGURATION: NAME & PERSONA ---
// We tell the AI who it is here.

var SYSTEM_PROMPT = "\nYou are Vijaypargavan, a friendly and professional assistant for Hivericks Technologies.\n- Your goal is to see if the user is interested in our new software services.\n- Keep your responses SHORT (1-2 sentences max) because this is a phone call.\n- Be polite, natural, and conversational.\n- If they are not interested, say goodbye politely.\n- Do NOT use emojis or complex formatting.\n";
var callHistory = {}; // --- HELPER: UPDATE DATABASE ---

var saveStatus = function saveStatus(callSid, status) {
  if (!fs.existsSync(LEADS_FILE)) return;
  var leads = JSON.parse(fs.readFileSync(LEADS_FILE, 'utf-8'));
  var lead = leads.find(function (l) {
    return l.last_call_sid === callSid;
  });

  if (lead) {
    lead.status = status;
    fs.writeFileSync(LEADS_FILE, JSON.stringify(leads, null, 2));
    console.log("   \uD83D\uDCBE DB Updated: Lead is now ".concat(status));
  }
}; // --- ROUTE 1: START THE CALL ---


app.post('/voice', function _callee(req, res) {
  var callSid, aiResponse, twiml;
  return regeneratorRuntime.async(function _callee$(_context) {
    while (1) {
      switch (_context.prev = _context.next) {
        case 0:
          callSid = req.body.CallSid;
          console.log("\n\uD83D\uDCDE NEW CALL STARTED: ".concat(callSid));
          callHistory[callSid] = [{
            role: "system",
            content: SYSTEM_PROMPT
          }];
          saveStatus(callSid, "AI_CONVERSATION_START"); // Ask AI (Vijaypargavan) to generate the greeting

          _context.next = 6;
          return regeneratorRuntime.awrap(generateAIResponse(callSid, "The user just picked up. Say hello and introduce yourself as Vijaypargavan."));

        case 6:
          aiResponse = _context.sent;
          // NOTE: We use "Polly.Matthew" because it is a clear MALE voice.
          // Twilio does not have a specific "Vijaypargavan" voice setting.
          twiml = "\n    <Response>\n        <Say voice=\"Polly.Matthew\">".concat(aiResponse, "</Say>\n        <Gather input=\"speech\" action=\"/gather\" method=\"POST\" timeout=\"2\" language=\"en-US\">\n        </Gather>\n        <Say voice=\"Polly.Matthew\">I didn't hear anything. Goodbye.</Say>\n    </Response>\n    ");
          res.type('text/xml');
          res.send(twiml);

        case 10:
        case "end":
          return _context.stop();
      }
    }
  });
}); // --- ROUTE 2: HANDLE USER SPEECH ---

app.post('/gather', function _callee2(req, res) {
  var callSid, userSpeech, aiResponse, twiml;
  return regeneratorRuntime.async(function _callee2$(_context2) {
    while (1) {
      switch (_context2.prev = _context2.next) {
        case 0:
          callSid = req.body.CallSid;
          userSpeech = req.body.SpeechResult;

          if (userSpeech) {
            _context2.next = 5;
            break;
          }

          res.type('text/xml');
          return _context2.abrupt("return", res.send("<Response><Hangup/></Response>"));

        case 5:
          console.log("\uD83D\uDDE3\uFE0F  USER SAID: \"".concat(userSpeech, "\""));
          _context2.next = 8;
          return regeneratorRuntime.awrap(generateAIResponse(callSid, userSpeech));

        case 8:
          aiResponse = _context2.sent;
          console.log("\uD83E\uDD16 VIJAYPARGAVAN SAID: \"".concat(aiResponse, "\""));
          twiml = "\n    <Response>\n        <Say voice=\"Polly.Matthew\">".concat(aiResponse, "</Say>\n        <Gather input=\"speech\" action=\"/gather\" method=\"POST\" timeout=\"2\">\n        </Gather>\n    </Response>\n    ");
          res.type('text/xml');
          res.send(twiml);

        case 13:
        case "end":
          return _context2.stop();
      }
    }
  });
}); // --- HELPER: TALK TO OLLAMA ---

function generateAIResponse(callSid, userInput) {
  var completion, botReply;
  return regeneratorRuntime.async(function generateAIResponse$(_context3) {
    while (1) {
      switch (_context3.prev = _context3.next) {
        case 0:
          _context3.prev = 0;
          if (!callHistory[callSid]) callHistory[callSid] = [];
          callHistory[callSid].push({
            role: "user",
            content: userInput
          });
          _context3.next = 5;
          return regeneratorRuntime.awrap(client.chat.completions.create({
            model: "llama3.2",
            messages: callHistory[callSid],
            max_tokens: 100
          }));

        case 5:
          completion = _context3.sent;
          botReply = completion.choices[0].message.content;
          callHistory[callSid].push({
            role: "assistant",
            content: botReply
          });
          return _context3.abrupt("return", botReply);

        case 11:
          _context3.prev = 11;
          _context3.t0 = _context3["catch"](0);
          console.error("❌ OLLAMA ERROR:", _context3.t0.message);
          return _context3.abrupt("return", "I am having a little trouble connecting. Can you say that again?");

        case 15:
        case "end":
          return _context3.stop();
      }
    }
  }, null, null, [[0, 11]]);
}

app.listen(PORT, function () {
  console.log("\uD83E\uDD16 Vijaypargavan (Voice Brain) running on Port ".concat(PORT));
});