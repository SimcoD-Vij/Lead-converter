"use strict";

// conversion-system/agent/test_speed.js
var _require = require('./salesBot'),
    generateResponse = _require.generateResponse;

function runSpeedTest() {
  var start, reply, time1, time2, time3;
  return regeneratorRuntime.async(function runSpeedTest$(_context) {
    while (1) {
      switch (_context.prev = _context.next) {
        case 0:
          console.log("🚀 STARTING BRAIN SPEED TEST...");
          console.log("------------------------------------------------"); // Test 1: Simple Greeting

          console.log("🗣️  USER: 'Hello, who is this?'");
          start = Date.now();
          _context.next = 6;
          return regeneratorRuntime.awrap(generateResponse({
            userMessage: "Hello, who is this?"
          }));

        case 6:
          reply = _context.sent;
          time1 = Date.now() - start;
          if (time1 > 2000) console.log("⚠️  SLOW: > 2 Seconds");else console.log("✅  FAST");
          console.log("------------------------------------------------"); // Test 2: Product Question

          console.log("🗣️  USER: 'How much does the charger cost?'");
          start = Date.now();
          _context.next = 14;
          return regeneratorRuntime.awrap(generateResponse({
            userMessage: "How much does the charger cost?"
          }));

        case 14:
          reply = _context.sent;
          time2 = Date.now() - start;
          if (time2 > 2000) console.log("⚠️  SLOW: > 2 Seconds");else console.log("✅  FAST");
          console.log("------------------------------------------------"); // Test 3: Rejection

          console.log("🗣️  USER: 'I am not interested.'");
          start = Date.now();
          _context.next = 22;
          return regeneratorRuntime.awrap(generateResponse({
            userMessage: "I am not interested."
          }));

        case 22:
          reply = _context.sent;
          time3 = Date.now() - start;
          if (time3 > 2000) console.log("⚠️  SLOW: > 2 Seconds");else console.log("✅  FAST");
          console.log("------------------------------------------------");
          console.log("📊 AVERAGE RESPONSE TIME:", Math.round((time1 + time2 + time3) / 3) + "ms");
          console.log("NOTE: For Voice, this MUST be under 1500ms.");

        case 28:
        case "end":
          return _context.stop();
      }
    }
  });
}

runSpeedTest();