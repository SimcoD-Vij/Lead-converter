"use strict";

require('dotenv').config({
  path: '../.env'
});

var express = require('express');

var bodyParser = require('body-parser');

var twilio = require('twilio');

var MessagingResponse = require('twilio').twiml.MessagingResponse; // Import our modularized agent components


var _require = require('../agent/salesBot'),
    generateResponse = _require.generateResponse;

var _require2 = require('../agent/memory'),
    logInteraction = _require2.logInteraction,
    getMemory = _require2.getMemory;

var _require3 = require('../agent/voice_utils'),
    textToSSML = _require3.textToSSML;

var app = express();
app.use(bodyParser.urlencoded({
  extended: true
}));
app.use(bodyParser.json());
var PORT = 3000; // --- 1. VOICE: HANDLE SPEECH (The "Ear") ---

app.post('/gather', function _callee(req, res) {
  var callSid, userSpeech, leadId, _twiml, memory, aiText, summary, ssmlResponse, twiml;

  return regeneratorRuntime.async(function _callee$(_context) {
    while (1) {
      switch (_context.prev = _context.next) {
        case 0:
          callSid = req.body.CallSid;
          userSpeech = req.body.SpeechResult;
          leadId = req.body.From || 'unknown_caller'; // If user stayed silent, just reprompt

          if (userSpeech) {
            _context.next = 6;
            break;
          }

          _twiml = "\n        <Response>\n            <Gather input=\"speech\" action=\"/gather\" method=\"POST\" timeout=\"3\"></Gather>\n        </Response>";
          return _context.abrupt("return", res.type('text/xml').send(_twiml));

        case 6:
          console.log("\uD83D\uDDE3\uFE0F  USER (Voice): \"".concat(userSpeech, "\"")); // A. BRAIN: Generate Answer
          // We explicitly set mode to 'VOICE_CALL' so it keeps it short & spoken

          _context.next = 9;
          return regeneratorRuntime.awrap(getMemory(leadId));

        case 9:
          memory = _context.sent;
          _context.next = 12;
          return regeneratorRuntime.awrap(generateResponse({
            userMessage: userSpeech,
            memory: memory,
            mode: 'VOICE_CALL'
          }));

        case 12:
          aiText = _context.sent;
          // B. LOGGING: Extract Intent
          summary = null;
          if (userSpeech.match(/price|cost/i)) summary = "Lead asked about Pricing";
          if (userSpeech.match(/not interested|busy/i)) summary = "Lead Objected/Busy";
          _context.next = 18;
          return regeneratorRuntime.awrap(logInteraction(leadId, 'VOICE', "User: ".concat(userSpeech, " | AI: ").concat(aiText), summary));

        case 18:
          // C. HUMANIZE: Apply SSML
          ssmlResponse = textToSSML(aiText); // D. RESPOND
          // Using Amazon Polly (Matthew) for a clear, standard male voice
          // "language='en-IN'" ensures Indian accent compatibility if preferred

          twiml = "\n    <Response>\n        <Say voice=\"Polly.Matthew\" language=\"en-IN\">".concat(ssmlResponse, "</Say>\n        <Gather input=\"speech\" action=\"/gather\" method=\"POST\" timeout=\"2\" language=\"en-IN\"></Gather>\n    </Response>\n    ");
          res.type('text/xml').send(twiml);

        case 21:
        case "end":
          return _context.stop();
      }
    }
  });
}); // --- 2. VOICE: START CALL (The "Hello") ---

app.post('/voice', function _callee2(req, res) {
  var greeting, ssmlGreeting, twiml;
  return regeneratorRuntime.async(function _callee2$(_context2) {
    while (1) {
      switch (_context2.prev = _context2.next) {
        case 0:
          // Initial greeting when call picks up
          greeting = "Hello? This is Vijay from Hivericks.";
          ssmlGreeting = textToSSML(greeting);
          twiml = "\n    <Response>\n        <Say voice=\"Polly.Matthew\" language=\"en-IN\">".concat(ssmlGreeting, "</Say>\n        <Gather input=\"speech\" action=\"/gather\" method=\"POST\" timeout=\"2\" language=\"en-IN\"></Gather>\n    </Response>\n    ");
          res.type('text/xml').send(twiml);

        case 4:
        case "end":
          return _context2.stop();
      }
    }
  });
}); // --- 3. SMS: HANDLE MESSAGES (The "Chat") ---

app.post('/sms', function _callee3(req, res) {
  var incomingMsg, leadId, memory, aiText, summary, twiml;
  return regeneratorRuntime.async(function _callee3$(_context3) {
    while (1) {
      switch (_context3.prev = _context3.next) {
        case 0:
          incomingMsg = req.body.Body;
          leadId = req.body.From;
          console.log("\uD83D\uDCE9 USER (SMS): \"".concat(incomingMsg, "\"")); // A. BRAIN: Generate Answer
          // Mode is 'SMS_CHAT' allows emojis and links

          _context3.next = 5;
          return regeneratorRuntime.awrap(getMemory(leadId));

        case 5:
          memory = _context3.sent;
          _context3.next = 8;
          return regeneratorRuntime.awrap(generateResponse({
            userMessage: incomingMsg,
            memory: memory,
            mode: 'SMS_CHAT'
          }));

        case 8:
          aiText = _context3.sent;
          // B. LOGGING
          summary = null;
          if (incomingMsg.match(/call me/i)) summary = "Requested Call";
          _context3.next = 13;
          return regeneratorRuntime.awrap(logInteraction(leadId, 'SMS', "User: ".concat(incomingMsg, " | AI: ").concat(aiText), summary));

        case 13:
          // C. RESPOND
          twiml = new MessagingResponse();
          twiml.message(aiText);
          res.type('text/xml').send(twiml.toString());

        case 16:
        case "end":
          return _context3.stop();
      }
    }
  });
});
app.listen(PORT, function () {
  console.log("\uD83D\uDE80 UNIFIED SERVER RUNNING ON PORT ".concat(PORT));
  console.log("   - Voice Engine: Amazon Polly (SSML Enabled)");
  console.log("   - Intelligence: Ollama (Mode Switching Enabled)");
});