"use strict";

// ---------------------------------------------------------
// TASK 3: VOICE ENGINE (FRESH BUILD)
// ---------------------------------------------------------
require('dotenv').config({
  path: '../.env'
});

var client = require('twilio')(process.env.TWILIO_SID, process.env.TWILIO_AUTH);

var fs = require('fs');

var path = require('path');

var LEADS_FILE = path.resolve(__dirname, '../processed_leads/clean_leads.json');
var SERVER_URL = process.env.SERVER_URL; // Ngrok URL

var runBatch = function runBatch() {
  var leads, targets, _iteratorNormalCompletion, _didIteratorError, _iteratorError, _iterator, _step, lead, call;

  return regeneratorRuntime.async(function runBatch$(_context) {
    while (1) {
      switch (_context.prev = _context.next) {
        case 0:
          console.log("🚀 Starting Voice Engine..."); // 1. Safety Checks

          if (SERVER_URL) {
            _context.next = 3;
            break;
          }

          return _context.abrupt("return", console.log("❌ Missing SERVER_URL in .env"));

        case 3:
          if (fs.existsSync(LEADS_FILE)) {
            _context.next = 5;
            break;
          }

          return _context.abrupt("return", console.log("❌ Missing DB file"));

        case 5:
          // 2. Load Leads
          leads = JSON.parse(fs.readFileSync(LEADS_FILE, 'utf-8')); // 3. Filter: Find VERIFIED or CONTACTED leads

          targets = leads.filter(function (l) {
            return (l.status === "VERIFIED" || l.status === "CONTACTED") && l.phone.length > 5;
          });
          console.log("\uD83D\uDCDE Found ".concat(targets.length, " leads to call.")); // 4. Call Loop

          _iteratorNormalCompletion = true;
          _didIteratorError = false;
          _iteratorError = undefined;
          _context.prev = 11;
          _iterator = targets[Symbol.iterator]();

        case 13:
          if (_iteratorNormalCompletion = (_step = _iterator.next()).done) {
            _context.next = 34;
            break;
          }

          lead = _step.value;
          _context.prev = 15;
          console.log("   \u260E\uFE0F Dialing ".concat(lead.name, " (").concat(lead.phone, ")..."));
          _context.next = 19;
          return regeneratorRuntime.awrap(client.calls.create({
            url: "".concat(SERVER_URL, "/voice"),
            to: lead.phone,
            from: process.env.TWILIO_PHONE
          }));

        case 19:
          call = _context.sent;
          console.log("      \u2705 Call Started! SID: ".concat(call.sid)); // --- CRITICAL: SAVE SID IMMEDIATELY ---
          // This links the Lead to the Call

          lead.status = "CALLED";
          lead.last_call_sid = call.sid;
          lead.last_called = new Date().toISOString(); // Write to disk NOW so the Brain can read it in 5 seconds

          fs.writeFileSync(LEADS_FILE, JSON.stringify(leads, null, 2));
          console.log("      💾 Database Updated (SID Saved).");
          _context.next = 31;
          break;

        case 28:
          _context.prev = 28;
          _context.t0 = _context["catch"](15);
          console.log("      \u274C Error: ".concat(_context.t0.message));

        case 31:
          _iteratorNormalCompletion = true;
          _context.next = 13;
          break;

        case 34:
          _context.next = 40;
          break;

        case 36:
          _context.prev = 36;
          _context.t1 = _context["catch"](11);
          _didIteratorError = true;
          _iteratorError = _context.t1;

        case 40:
          _context.prev = 40;
          _context.prev = 41;

          if (!_iteratorNormalCompletion && _iterator["return"] != null) {
            _iterator["return"]();
          }

        case 43:
          _context.prev = 43;

          if (!_didIteratorError) {
            _context.next = 46;
            break;
          }

          throw _iteratorError;

        case 46:
          return _context.finish(43);

        case 47:
          return _context.finish(40);

        case 48:
        case "end":
          return _context.stop();
      }
    }
  }, null, null, [[11, 36, 40, 48], [15, 28], [41,, 43, 47]]);
};

runBatch();