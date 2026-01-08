"use strict";

// ---------------------------------------------------------
// TASK: CONSOLE CHAT FOR TESTING AGENT LOGIC
// ---------------------------------------------------------
var readline = require('readline');

var _require = require('uuid'),
    uuidv4 = _require.v4;

var _require2 = require('./salesBot'),
    generateResponse = _require2.generateResponse;

var _require3 = require('./memory'),
    getMemory = _require3.getMemory,
    upsertMemory = _require3.upsertMemory; // Setup Readline logic to type in terminal


var rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
}); // Generate a random ID for this session so Memory works

var LEAD_ID = "console_user_".concat(Date.now());
console.log("\n=================================================");
console.log("🚀 XOPTIMUS SALES AGENT - CONSOLE MODE");
console.log("   (Type 'exit' or 'quit' to stop)");
console.log("-------------------------------------------------");
console.log("\uD83C\uDD94 Session ID: ".concat(LEAD_ID));
console.log("=================================================\n"); // Helper to ask questions

var ask = function ask(query) {
  return new Promise(function (resolve) {
    return rl.question(query, resolve);
  });
};

var runChat = function runChat() {
  var memory, userMessage, reply, lower, patch;
  return regeneratorRuntime.async(function runChat$(_context) {
    while (1) {
      switch (_context.prev = _context.next) {
        case 0:
          _context.next = 2;
          return regeneratorRuntime.awrap(getMemory(LEAD_ID));

        case 2:
          _context.t0 = _context.sent;

          if (_context.t0) {
            _context.next = 5;
            break;
          }

          _context.t0 = {};

        case 5:
          memory = _context.t0;

        case 6:
          if (!true) {
            _context.next = 36;
            break;
          }

          _context.next = 9;
          return regeneratorRuntime.awrap(ask("\n👤 YOU: "));

        case 9:
          userMessage = _context.sent;

          if (!['exit', 'quit', 'stop'].includes(userMessage.toLowerCase().trim())) {
            _context.next = 14;
            break;
          }

          console.log("\n👋 Ending session. Memory saved.");
          rl.close();
          return _context.abrupt("break", 36);

        case 14:
          _context.prev = 14;
          // 3. Generate AI Response
          process.stdout.write("🤖 AI: Thinking..."); // Loading indicator

          _context.next = 18;
          return regeneratorRuntime.awrap(generateResponse({
            userMessage: userMessage,
            memory: memory,
            mode: 'CONSULTATIVE'
          }));

        case 18:
          reply = _context.sent;
          // Clear "Thinking..." line
          readline.clearLine(process.stdout, 0);
          readline.cursorTo(process.stdout, 0);
          console.log("\uD83E\uDD16 AI: \"".concat(reply, "\"")); // 4. Update Memory
          // We mimic the logic from agent_server.js to track objections/pricing

          lower = userMessage.toLowerCase();
          patch = {
            last_user_message: userMessage
          };

          if (/no budget|not interested|stop/.test(lower)) {
            patch.status = 'OBJECTION';
          }

          if (/price|cost|how much/.test(lower)) {
            patch.pricing_inquiry = true;
          }

          _context.next = 28;
          return regeneratorRuntime.awrap(upsertMemory(LEAD_ID, patch));

        case 28:
          memory = _context.sent;
          _context.next = 34;
          break;

        case 31:
          _context.prev = 31;
          _context.t1 = _context["catch"](14);
          console.log("\n\u274C Error: ".concat(_context.t1.message));

        case 34:
          _context.next = 6;
          break;

        case 36:
        case "end":
          return _context.stop();
      }
    }
  }, null, null, [[14, 31]]);
};

runChat();