"use strict";

function _toConsumableArray(arr) { return _arrayWithoutHoles(arr) || _iterableToArray(arr) || _nonIterableSpread(); }

function _nonIterableSpread() { throw new TypeError("Invalid attempt to spread non-iterable instance"); }

function _iterableToArray(iter) { if (Symbol.iterator in Object(iter) || Object.prototype.toString.call(iter) === "[object Arguments]") return Array.from(iter); }

function _arrayWithoutHoles(arr) { if (Array.isArray(arr)) { for (var i = 0, arr2 = new Array(arr.length); i < arr.length; i++) { arr2[i] = arr[i]; } return arr2; } }

// ---------------------------------------------------------
// TASK 8: OLLAMA AI WRAPPER (FULL PRODUCTION GRADE)
// ---------------------------------------------------------
var axios = require('axios'); // CONFIGURATION


var OLLAMA_URL = 'http://127.0.0.1:11434/api/chat';
var MODEL = 'llama3.2:1b';
var TIMEOUT_MS = 20000; // 20 Second Timeout
// 1. HARDCODED KNOWLEDGE BASE (From Manual)

var PRODUCT_FACTS = "\nPRODUCT: XOptimus Smart Charger (Wall Adapter)\nMANUFACTURER: Hivericks Technologies Pvt Ltd (Chennai).\n\nCORE VALUE PROPOSITION:\n- Increases Li-Ion battery life expectancy.\n- Prevents overcharging/heating using real-time monitoring.\n- Saves energy by maintaining optimal charge levels.\n\nKEY MODES:\n1. Smart Mode (Default): Optimizes for daily battery health.\n2. Gaming Mode: High-end mode for heavy usage/high discharge.\n3. Full Charge Mode: Forces 100% charge when needed.\n\nSPECS:\n- Input/Output: 110-230V AC.\n- Max Current: 5A.\n- Connectivity: Bluetooth 5.0 (BLE).\n- App: \"Xoptimus\" (Play Store).\n"; // 2. SALES PROTOCOLS (The Logic)

var SALES_PROTOCOL = "\nOBJECTION HANDLING PROTOCOL:\nIf user says \"No budget\", \"Not interested\", or \"Things are fine\":\n1. ACKNOWLEDGE & PIVOT (Pattern Interrupt):\n   - \"Totally fair. Most people feel that way until the battery dies.\"\n2. FORCED CHOICE (Truth Detector):\n   - \"Is it that you've evaluated alternatives and found them lacking, or just haven't had time to look?\"\n3. EXIT WITH VALUE:\n   - \"Would it be helpful to see the upside math? If not, we walk. Fair?\"\n"; // 3. SYSTEM PERSONAS

var SYSTEM_PROMPTS = {
  CONSULTATIVE: "\n    You are Vijay, Senior Consultant at Hivericks Technologies.\n    Role: Consultative Sales Expert for XOptimus.\n    \n    GUIDELINES:\n    - Do NOT invent specs. Use PRODUCT_KNOWLEDGE only.\n    - Keep answers concise (Max 2 sentences).\n    - Ask exactly ONE clarifying question per turn.\n    - NO FLUFF: Don't say \"I hope you are well.\"\n    ",
  GHOST: "\n    You are Vijay. The user has stopped replying.\n    Role: Re-engagement specialist.\n    Style: Blunt, casual, \"Chris Voss\" style.\n    - \"Have you given up on fixing your battery issues?\"\n    - \"Did you get abducted by aliens?\"\n    "
};
/**
 * Generates an AI response using XML-structured prompting.
 * @param {string} userMessage - The latest user text.
 * @param {string} mode - 'CONSULTATIVE' (Default) or 'GHOST'.
 * @param {Array} history - (Optional) Previous conversation context.
 */

var generateResponse = function generateResponse(userMessage) {
  var mode,
      history,
      basePersona,
      structuredSystemMsg,
      messages,
      payload,
      response,
      reply,
      _args = arguments;
  return regeneratorRuntime.async(function generateResponse$(_context) {
    while (1) {
      switch (_context.prev = _context.next) {
        case 0:
          mode = _args.length > 1 && _args[1] !== undefined ? _args[1] : 'CONSULTATIVE';
          history = _args.length > 2 && _args[2] !== undefined ? _args[2] : [];
          _context.prev = 2;
          console.log("   \uD83E\uDDE0 AI Thinking (".concat(mode, " Mode)...")); // Select Persona

          basePersona = SYSTEM_PROMPTS[mode] || SYSTEM_PROMPTS.CONSULTATIVE; // 4. BUILD XML PROMPT (The "Perfect" Structure)
          // This structure forces Llama 3 to separate data from instructions.

          structuredSystemMsg = "\n<SYSTEM>\n".concat(basePersona, "\n</SYSTEM>\n\n<PRODUCT_KNOWLEDGE>\n").concat(PRODUCT_FACTS, "\n</PRODUCT_KNOWLEDGE>\n\n<SALES_PROTOCOL>\n").concat(SALES_PROTOCOL, "\n</SALES_PROTOCOL>\n\n<INSTRUCTION>\nAnswer the user based on the knowledge above. \nIf they object, follow the SALES_PROTOCOL.\nKeep it short.\n</INSTRUCTION>\n"); // Construct Message Chain
          // We include history if provided, otherwise just System + User

          messages = [{
            role: "system",
            content: structuredSystemMsg
          }].concat(_toConsumableArray(history), [{
            role: "user",
            content: userMessage
          }]);
          payload = {
            model: MODEL,
            messages: messages,
            stream: false,
            options: {
              temperature: 0.7,
              // Balance between creative and strict
              num_ctx: 4096 // Larger context window

            }
          };
          _context.next = 10;
          return regeneratorRuntime.awrap(axios.post(OLLAMA_URL, payload, {
            timeout: TIMEOUT_MS
          }));

        case 10:
          response = _context.sent;
          reply = response.data.message.content.trim();
          console.log("   \uD83D\uDCA1 AI Answer: \"".concat(reply, "\""));
          return _context.abrupt("return", reply);

        case 16:
          _context.prev = 16;
          _context.t0 = _context["catch"](2);
          console.log("   ❌ Ollama Error:", _context.t0.message);

          if (!(_context.t0.code === 'ECONNABORTED')) {
            _context.next = 21;
            break;
          }

          return _context.abrupt("return", "I'm having a little trouble connecting. Can you repeat that?");

        case 21:
          return _context.abrupt("return", "Let me double-check that with my technical team. One moment.");

        case 22:
        case "end":
          return _context.stop();
      }
    }
  }, null, null, [[2, 16]]);
};

module.exports = {
  generateResponse: generateResponse
};