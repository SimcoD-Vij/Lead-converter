"use strict";

// ---------------------------------------------------------
// TASK 4: SMS SERVER WITH XOPTIMUS AGENT (ADVANCED)
// ---------------------------------------------------------
var express = require('express');

var bodyParser = require('body-parser');

var MessagingResponse = require('twilio').twiml.MessagingResponse;

var fs = require('fs');

var path = require('path'); // --- INTEGRATION: CONNECT TO AGENT BRAIN ---
// We import the advanced Agent components instead of simple AI


var _require = require('../agent/salesBot'),
    generateResponse = _require.generateResponse;

var _require2 = require('../agent/memory'),
    getMemory = _require2.getMemory,
    upsertMemory = _require2.upsertMemory;

var app = express();
app.use(bodyParser.urlencoded({
  extended: false
})); // PORT CONFIGURATION

var PORT = 5000;
var LEADS_FILE = path.resolve(__dirname, '../processed_leads/clean_leads.json'); // HELPER: Log Interaction to Legacy Database (clean_leads.json)

var logLegacyInteraction = function logLegacyInteraction(phone, msg, type) {
  if (!fs.existsSync(LEADS_FILE)) return;
  var leads = JSON.parse(fs.readFileSync(LEADS_FILE, 'utf-8')); // Normalize phone (remove whatsapp prefix for matching)

  var cleanPhone = phone.replace('whatsapp:', '').replace(/\s/g, '');
  var lead = leads.find(function (l) {
    return (l.phone || '').replace(/\s/g, '') === cleanPhone;
  });

  if (lead) {
    if (!lead.conversation_history) lead.conversation_history = [];
    lead.conversation_history.push({
      type: type,
      msg: msg,
      time: new Date().toISOString()
    });
    lead.status = "AI_CONVERSATION";
    fs.writeFileSync(LEADS_FILE, JSON.stringify(leads, null, 2));
  }
}; // MAIN ROUTE


app.post('/sms', function _callee(req, res) {
  var incomingMsg, fromPhone, twiml, memory, aiReply, lower, patch;
  return regeneratorRuntime.async(function _callee$(_context) {
    while (1) {
      switch (_context.prev = _context.next) {
        case 0:
          incomingMsg = req.body.Body;
          fromPhone = req.body.From; // Use this as the unique Lead ID for memory

          console.log("\n\uD83D\uDCE9 INCOMING from ".concat(fromPhone, ": \"").concat(incomingMsg, "\""));
          twiml = new MessagingResponse(); // 1. CHECK STOP WORDS (Safety)

          if (!['stop', 'unsubscribe', 'cancel'].includes(incomingMsg.toLowerCase())) {
            _context.next = 9;
            break;
          }

          twiml.message("You have been unsubscribed.");
          res.type('text/xml').send(twiml.toString());
          console.log("   🛑 User opted out.");
          return _context.abrupt("return");

        case 9:
          _context.prev = 9;
          _context.next = 12;
          return regeneratorRuntime.awrap(getMemory(fromPhone));

        case 12:
          _context.t0 = _context.sent;

          if (_context.t0) {
            _context.next = 15;
            break;
          }

          _context.t0 = {};

        case 15:
          memory = _context.t0;
          _context.next = 18;
          return regeneratorRuntime.awrap(generateResponse({
            userMessage: incomingMsg,
            memory: memory,
            mode: 'CONSULTATIVE'
          }));

        case 18:
          aiReply = _context.sent;
          console.log("   \uD83D\uDCA1 Agent Says: \"".concat(aiReply, "\"")); // 4. UPDATE AGENT MEMORY
          // We scan for objections/pricing intents to update the agent's state

          lower = incomingMsg.toLowerCase();
          patch = {
            last_user_message: incomingMsg
          };
          if (/price|cost|how much/.test(lower)) patch.pricing_inquiry = true;
          _context.next = 25;
          return regeneratorRuntime.awrap(upsertMemory(fromPhone, patch));

        case 25:
          // 5. SYNC WITH LEGACY SYSTEM
          logLegacyInteraction(fromPhone, incomingMsg, 'USER');
          logLegacyInteraction(fromPhone, aiReply, 'AI'); // 6. SEND TO TWILIO

          twiml.message(aiReply);
          _context.next = 34;
          break;

        case 30:
          _context.prev = 30;
          _context.t1 = _context["catch"](9);
          console.error("   ❌ Agent Error:", _context.t1);
          twiml.message("I'm connecting you to a human agent now.");

        case 34:
          res.type('text/xml').send(twiml.toString());

        case 35:
        case "end":
          return _context.stop();
      }
    }
  }, null, null, [[9, 30]]);
});
app.listen(PORT, function () {
  console.log("\uD83D\uDCE1 XOptimus SMS Agent running on Port ".concat(PORT));
});