"use strict";

// ---------------------------------------------------------
// TASK: MCP SERVER FOR XOPTIMUS AGENT
// ---------------------------------------------------------
var _require = require("@modelcontextprotocol/sdk/server/index.js"),
    Server = _require.Server;

var _require2 = require("@modelcontextprotocol/sdk/server/stdio.js"),
    StdioServerTransport = _require2.StdioServerTransport;

var _require3 = require("@modelcontextprotocol/sdk/types.js"),
    CallToolRequestSchema = _require3.CallToolRequestSchema,
    ListResourcesRequestSchema = _require3.ListResourcesRequestSchema,
    ListToolsRequestSchema = _require3.ListToolsRequestSchema,
    ListPromptsRequestSchema = _require3.ListPromptsRequestSchema,
    GetPromptRequestSchema = _require3.GetPromptRequestSchema,
    ReadResourceRequestSchema = _require3.ReadResourceRequestSchema;

var fs = require('fs');

var path = require('path');

var _require4 = require("zod"),
    z = _require4.z; // Import existing logic


var _require5 = require('./salesBot'),
    generateResponse = _require5.generateResponse;

var _require6 = require('./memory'),
    getMemory = _require6.getMemory,
    upsertMemory = _require6.upsertMemory; // CONFIG


var FACTS_PATH = path.join(__dirname, 'data', 'sample_product_facts.txt');
var PRODUCT_FACTS = fs.existsSync(FACTS_PATH) ? fs.readFileSync(FACTS_PATH, 'utf8') : "Data missing"; // 1. Initialize MCP Server

var server = new Server({
  name: "xoptimus-sales-agent",
  version: "1.0.0"
}, {
  capabilities: {
    resources: {},
    tools: {},
    prompts: {}
  }
}); // ---------------------------------------------------------
// 2. EXPOSE RESOURCES (Data)
// Allows clients to read 'product_facts' directly
// ---------------------------------------------------------

server.setRequestHandler(ListResourcesRequestSchema, function _callee() {
  return regeneratorRuntime.async(function _callee$(_context) {
    while (1) {
      switch (_context.prev = _context.next) {
        case 0:
          return _context.abrupt("return", {
            resources: [{
              uri: "xoptimus://data/product_facts",
              name: "XOptimus Product Knowledge",
              mimeType: "text/plain",
              description: "Technical specs and features of the XOptimus Smart Charger"
            }]
          });

        case 1:
        case "end":
          return _context.stop();
      }
    }
  });
});
server.setRequestHandler(ReadResourceRequestSchema, function _callee2(request) {
  return regeneratorRuntime.async(function _callee2$(_context2) {
    while (1) {
      switch (_context2.prev = _context2.next) {
        case 0:
          if (!(request.params.uri === "xoptimus://data/product_facts")) {
            _context2.next = 2;
            break;
          }

          return _context2.abrupt("return", {
            contents: [{
              uri: "xoptimus://data/product_facts",
              mimeType: "text/plain",
              text: PRODUCT_FACTS
            }]
          });

        case 2:
          throw new Error("Resource not found");

        case 3:
        case "end":
          return _context2.stop();
      }
    }
  });
}); // ---------------------------------------------------------
// 3. EXPOSE PROMPTS (Persona)
// Allows clients to use your 'Sales Protocol' prompt
// ---------------------------------------------------------

server.setRequestHandler(ListPromptsRequestSchema, function _callee3() {
  return regeneratorRuntime.async(function _callee3$(_context3) {
    while (1) {
      switch (_context3.prev = _context3.next) {
        case 0:
          return _context3.abrupt("return", {
            prompts: [{
              name: "sales_persona",
              description: "The 'Let's Get Real' sales persona prompt template"
            }]
          });

        case 1:
        case "end":
          return _context3.stop();
      }
    }
  });
});
server.setRequestHandler(GetPromptRequestSchema, function _callee4(request) {
  return regeneratorRuntime.async(function _callee4$(_context4) {
    while (1) {
      switch (_context4.prev = _context4.next) {
        case 0:
          if (!(request.params.name === "sales_persona")) {
            _context4.next = 2;
            break;
          }

          return _context4.abrupt("return", {
            messages: [{
              role: "user",
              content: {
                type: "text",
                text: "Please act as Vijay, the Senior Consultant using the XOptimus Sales Protocol."
              }
            }]
          });

        case 2:
        case "end":
          return _context4.stop();
      }
    }
  });
}); // ---------------------------------------------------------
// 4. EXPOSE TOOLS (Functions)
// Allows clients to 'Call' your Agent logic
// ---------------------------------------------------------

server.setRequestHandler(ListToolsRequestSchema, function _callee5() {
  return regeneratorRuntime.async(function _callee5$(_context5) {
    while (1) {
      switch (_context5.prev = _context5.next) {
        case 0:
          return _context5.abrupt("return", {
            tools: [{
              name: "consultative_chat",
              description: "Chat with the XOptimus Sales Agent (Handles objections, specs, and pricing)",
              inputSchema: {
                type: "object",
                properties: {
                  message: {
                    type: "string",
                    description: "The user's message or question"
                  },
                  sessionId: {
                    type: "string",
                    description: "Unique ID for conversation memory (optional)"
                  }
                },
                required: ["message"]
              }
            }]
          });

        case 1:
        case "end":
          return _context5.stop();
      }
    }
  });
});
server.setRequestHandler(CallToolRequestSchema, function _callee6(request) {
  var _request$params$argum, message, sessionId, leadId, memory, reply, patch;

  return regeneratorRuntime.async(function _callee6$(_context6) {
    while (1) {
      switch (_context6.prev = _context6.next) {
        case 0:
          if (!(request.params.name === "consultative_chat")) {
            _context6.next = 22;
            break;
          }

          _request$params$argum = request.params.arguments, message = _request$params$argum.message, sessionId = _request$params$argum.sessionId;
          leadId = sessionId || "mcp_user_default"; // Reuse your existing Logic!

          _context6.next = 5;
          return regeneratorRuntime.awrap(getMemory(leadId));

        case 5:
          _context6.t0 = _context6.sent;

          if (_context6.t0) {
            _context6.next = 8;
            break;
          }

          _context6.t0 = {};

        case 8:
          memory = _context6.t0;
          _context6.prev = 9;
          _context6.next = 12;
          return regeneratorRuntime.awrap(generateResponse({
            userMessage: message,
            memory: memory,
            mode: 'CONSULTATIVE'
          }));

        case 12:
          reply = _context6.sent;
          // Update Memory (Basic tracking)
          patch = {
            last_user_message: message
          };
          _context6.next = 16;
          return regeneratorRuntime.awrap(upsertMemory(leadId, patch));

        case 16:
          return _context6.abrupt("return", {
            content: [{
              type: "text",
              text: reply
            }]
          });

        case 19:
          _context6.prev = 19;
          _context6.t1 = _context6["catch"](9);
          return _context6.abrupt("return", {
            content: [{
              type: "text",
              text: "Error: ".concat(_context6.t1.message)
            }],
            isError: true
          });

        case 22:
          throw new Error("Tool not found");

        case 23:
        case "end":
          return _context6.stop();
      }
    }
  }, null, null, [[9, 19]]);
}); // 5. START SERVER (StdIO Mode)

function run() {
  var transport;
  return regeneratorRuntime.async(function run$(_context7) {
    while (1) {
      switch (_context7.prev = _context7.next) {
        case 0:
          transport = new StdioServerTransport();
          _context7.next = 3;
          return regeneratorRuntime.awrap(server.connect(transport));

        case 3:
        case "end":
          return _context7.stop();
      }
    }
  });
}

run()["catch"](console.error);