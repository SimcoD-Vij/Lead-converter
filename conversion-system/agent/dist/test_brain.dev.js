"use strict";

// conversion-system/agent/test_brain.js
console.log("✅ Script Loaded: test_brain.js is running...");

var _require = require('./salesBot'),
    generateResponse = _require.generateResponse;

function runDiagnostics() {
  var start, reply1, end, duration1;
  return regeneratorRuntime.async(function runDiagnostics$(_context) {
    while (1) {
      switch (_context.prev = _context.next) {
        case 0:
          console.log("🧠 STARTING BRAIN DIAGNOSTICS...");
          console.log("--------------------------------------------------");
          console.log("NOTE: The first call will be slow (Model Loading).");
          console.log("--------------------------------------------------\n"); // --- TEST 1: COLD START ---

          console.log("👉i could buy the same product somewhere in flipkart in cheap why should i buy from u '");
          start = Date.now();
          _context.prev = 6;
          _context.next = 9;
          return regeneratorRuntime.awrap(generateResponse({
            userMessage: "Hello, i am not interested a bit so do u try to convince me ?",
            mode: 'VOICE_CALL'
          }));

        case 9:
          reply1 = _context.sent;
          end = Date.now();
          duration1 = (end - start) / 1000;
          console.log("\uD83E\uDD16 REPLY: \"".concat(reply1, "\""));
          console.log("\u23F1\uFE0F TIME:  ".concat(duration1.toFixed(2), " seconds"));
          _context.next = 19;
          break;

        case 16:
          _context.prev = 16;
          _context.t0 = _context["catch"](6);
          console.log("❌ CRASHED:", _context.t0.message);

        case 19:
          console.log("--------------------------------------------------\n");

        case 20:
        case "end":
          return _context.stop();
      }
    }
  }, null, null, [[6, 16]]);
}

runDiagnostics();