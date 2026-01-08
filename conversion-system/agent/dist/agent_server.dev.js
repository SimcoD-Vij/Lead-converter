"use strict";

var express = require('express');

var bodyParser = require('body-parser');

var _require = require('uuid'),
    uuidv4 = _require.v4;

var _require2 = require('./salesBot'),
    generateResponse = _require2.generateResponse;

var _require3 = require('./memory'),
    getMemory = _require3.getMemory,
    upsertMemory = _require3.upsertMemory;

var _require4 = require('./utils'),
    sanitize = _require4.sanitize;

var app = express();
app.use(bodyParser.json());
var PORT = 6000; // Distinct port for the Agent

app.post('/api/salesbot', function _callee(req, res) {
  var _req$body, incomingLeadId, message, mode, messageText, leadId, memory, reply, lower, patch, newMemory;

  return regeneratorRuntime.async(function _callee$(_context) {
    while (1) {
      switch (_context.prev = _context.next) {
        case 0:
          _context.prev = 0;
          // LeadId can be a phone number or email
          _req$body = req.body, incomingLeadId = _req$body.leadId, message = _req$body.message, mode = _req$body.mode;

          if (message) {
            _context.next = 4;
            break;
          }

          return _context.abrupt("return", res.status(400).send({
            error: 'message required'
          }));

        case 4:
          messageText = sanitize(message);
          leadId = incomingLeadId || uuidv4();
          console.log("\n\uD83E\uDD16 Agent received msg from ".concat(leadId, ": \"").concat(messageText, "\"")); // 1. Load Memory

          _context.next = 9;
          return regeneratorRuntime.awrap(getMemory(leadId));

        case 9:
          _context.t0 = _context.sent;

          if (_context.t0) {
            _context.next = 12;
            break;
          }

          _context.t0 = {};

        case 12:
          memory = _context.t0;
          _context.next = 15;
          return regeneratorRuntime.awrap(generateResponse({
            userMessage: messageText,
            memory: memory,
            mode: mode || 'CONSULTATIVE'
          }));

        case 15:
          reply = _context.sent;
          console.log("   \uD83D\uDCA1 Agent Reply: \"".concat(reply, "\"")); // 3. Update Memory (Extract intents)

          lower = messageText.toLowerCase();
          patch = {};

          if (/no budget|not interested|stop/.test(lower)) {
            patch.status = 'OBJECTION';
          }

          if (/price|cost|how much/.test(lower)) {
            patch.pricing_inquiry = true;
          }

          patch.last_user_message = messageText;
          _context.next = 24;
          return regeneratorRuntime.awrap(upsertMemory(leadId, patch));

        case 24:
          newMemory = _context.sent;
          return _context.abrupt("return", res.send({
            leadId: leadId,
            reply: reply,
            memory: newMemory
          }));

        case 28:
          _context.prev = 28;
          _context.t1 = _context["catch"](0);
          console.error(_context.t1);
          res.status(500).send({
            error: 'server error'
          });

        case 32:
        case "end":
          return _context.stop();
      }
    }
  }, null, null, [[0, 28]]);
});
app.listen(PORT, function () {
  return console.log("\uD83D\uDE80 XOptimus Sales Agent running on Port ".concat(PORT));
});