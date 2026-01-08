"use strict";

function _typeof(obj) { if (typeof Symbol === "function" && typeof Symbol.iterator === "symbol") { _typeof = function _typeof(obj) { return typeof obj; }; } else { _typeof = function _typeof(obj) { return obj && typeof Symbol === "function" && obj.constructor === Symbol && obj !== Symbol.prototype ? "symbol" : typeof obj; }; } return _typeof(obj); }

// TASK 4: WHATSAPP FALLBACK ENGINE (SENDER)
// ---------------------------------------------------------
require('dotenv').config({
  path: '../.env'
});

var client = require('twilio')(process.env.TWILIO_SID, process.env.TWILIO_AUTH);

var fs = require('fs');

var path = require('path');

var _require = require('./templates'),
    fillSMSTemplate = _require.fillSMSTemplate;

var LEADS_FILE = path.join(__dirname, '../processed_leads/clean_leads.json');

var runWhatsAppCampaign = function runWhatsAppCampaign() {
  var leads, targets, _iteratorNormalCompletion, _didIteratorError, _iteratorError, _iterator, _step, lead, msgBody, firstName, phone, toWhatsApp, fromWhatsApp, message;

  return regeneratorRuntime.async(function runWhatsAppCampaign$(_context) {
    while (1) {
      switch (_context.prev = _context.next) {
        case 0:
          console.log("🚀 Starting WhatsApp Campaign...");

          if (fs.existsSync(LEADS_FILE)) {
            _context.next = 4;
            break;
          }

          console.log("❌ clean_leads.json not found.");
          return _context.abrupt("return");

        case 4:
          leads = JSON.parse(fs.readFileSync(LEADS_FILE, 'utf-8')); // 1. FILTER TARGETS
          // We look for leads who:
          // A. Missed the call (Status: CALLED) OR
          // B. Asked to call later (Status: CALL_LATER)

          targets = leads.filter(function (l) {
            return (l.status === "CALLED" || l.status === "CALL_LATER") && l.phone;
          });
          console.log("\uD83D\uDCF1 Found ".concat(targets.length, " leads for WhatsApp."));
          _iteratorNormalCompletion = true;
          _didIteratorError = false;
          _iteratorError = undefined;
          _context.prev = 10;
          _iterator = targets[Symbol.iterator]();

        case 12:
          if (_iteratorNormalCompletion = (_step = _iterator.next()).done) {
            _context.next = 38;
            break;
          }

          lead = _step.value;
          // 2. CONTEXTUAL MESSAGE LOGIC
          msgBody = "";
          firstName = lead.name.split(' ')[0];

          if (lead.status === "CALL_LATER") {
            // Specific message for people who pressed 2
            msgBody = "Hi ".concat(firstName, ", noted that you asked for a callback later. When is a good time for you?");
          } else {
            // Standard message for missed calls (Status: CALLED)
            msgBody = fillSMSTemplate("SMS_1", lead);
          }

          phone = lead.phone; // Handle legacy object bug if present

          if (_typeof(phone) === 'object') phone = phone.number || phone.phone; // WHATSAPP FORMATTING
          // Ensure format is: "whatsapp:+919876543210"
          // Note: For Sandbox testing, ensure 'whatsapp:' is present. 
          // For production SMS, remove 'whatsapp:'.

          toWhatsApp = phone.includes('whatsapp:') ? phone : "whatsapp:".concat(phone);
          fromWhatsApp = 'whatsapp:+14155238886'; // Twilio Sandbox Number

          _context.prev = 21;
          console.log("   \uD83D\uDCAC Sending to ".concat(lead.name, " [Status: ").concat(lead.status, "]..."));
          _context.next = 25;
          return regeneratorRuntime.awrap(client.messages.create({
            body: msgBody,
            from: fromWhatsApp,
            to: toWhatsApp
          }));

        case 25:
          message = _context.sent;
          console.log("      \u2705 Sent! SID: ".concat(message.sid));
          lead.status = "WHATSAPP_SENT";
          lead.last_sms_time = new Date().toISOString();
          _context.next = 35;
          break;

        case 31:
          _context.prev = 31;
          _context.t0 = _context["catch"](21);
          console.log("      \u274C Failed: ".concat(_context.t0.message));

          if (_context.t0.code === 63015) {
            console.log("         💡 TIP: You must send 'join <code-word>' to the Sandbox number first!");
          }

        case 35:
          _iteratorNormalCompletion = true;
          _context.next = 12;
          break;

        case 38:
          _context.next = 44;
          break;

        case 40:
          _context.prev = 40;
          _context.t1 = _context["catch"](10);
          _didIteratorError = true;
          _iteratorError = _context.t1;

        case 44:
          _context.prev = 44;
          _context.prev = 45;

          if (!_iteratorNormalCompletion && _iterator["return"] != null) {
            _iterator["return"]();
          }

        case 47:
          _context.prev = 47;

          if (!_didIteratorError) {
            _context.next = 50;
            break;
          }

          throw _iteratorError;

        case 50:
          return _context.finish(47);

        case 51:
          return _context.finish(44);

        case 52:
          // 3. SAVE PROGRESS
          fs.writeFileSync(LEADS_FILE, JSON.stringify(leads, null, 2));
          console.log("\n💾 WhatsApp Progress Saved.");

        case 54:
        case "end":
          return _context.stop();
      }
    }
  }, null, null, [[10, 40, 44, 52], [21, 31], [45,, 47, 51]]);
};

runWhatsAppCampaign();