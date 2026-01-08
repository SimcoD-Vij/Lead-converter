// ---------------------------------------------------------
// TASK: MCP SERVER FOR XOPTIMUS AGENT
// ---------------------------------------------------------
const { Server } = require("@modelcontextprotocol/sdk/server/index.js");
const { StdioServerTransport } = require("@modelcontextprotocol/sdk/server/stdio.js");
const {
  CallToolRequestSchema,
  ListResourcesRequestSchema,
  ListToolsRequestSchema,
  ListPromptsRequestSchema,
  GetPromptRequestSchema,
  ReadResourceRequestSchema,
} = require("@modelcontextprotocol/sdk/types.js");
const fs = require('fs');
const path = require('path');
const { z } = require("zod");

// Import existing logic
const { generateResponse } = require('./salesBot');
const { getMemory, upsertMemory } = require('./memory');

// CONFIG
const FACTS_PATH = path.join(__dirname, 'data', 'sample_product_facts.txt');
const PRODUCT_FACTS = fs.existsSync(FACTS_PATH) ? fs.readFileSync(FACTS_PATH, 'utf8') : "Data missing";

// 1. Initialize MCP Server
const server = new Server(
  {
    name: "xoptimus-sales-agent",
    version: "1.0.0",
  },
  {
    capabilities: {
      resources: {},
      tools: {},
      prompts: {},
    },
  }
);

// ---------------------------------------------------------
// 2. EXPOSE RESOURCES (Data)
// Allows clients to read 'product_facts' directly
// ---------------------------------------------------------
server.setRequestHandler(ListResourcesRequestSchema, async () => {
  return {
    resources: [
      {
        uri: "xoptimus://data/product_facts",
        name: "XOptimus Product Knowledge",
        mimeType: "text/plain",
        description: "Technical specs and features of the XOptimus Smart Charger"
      }
    ]
  };
});

server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
  if (request.params.uri === "xoptimus://data/product_facts") {
    return {
      contents: [{
        uri: "xoptimus://data/product_facts",
        mimeType: "text/plain",
        text: PRODUCT_FACTS
      }]
    };
  }
  throw new Error("Resource not found");
});

// ---------------------------------------------------------
// 3. EXPOSE PROMPTS (Persona)
// Allows clients to use your 'Sales Protocol' prompt
// ---------------------------------------------------------
server.setRequestHandler(ListPromptsRequestSchema, async () => {
  return {
    prompts: [
      {
        name: "sales_persona",
        description: "The 'Let's Get Real' sales persona prompt template",
      }
    ]
  };
});

server.setRequestHandler(GetPromptRequestSchema, async (request) => {
  if (request.params.name === "sales_persona") {
    return {
      messages: [
        {
          role: "user",
          content: {
            type: "text",
            text: "Please act as Vijay, the Senior Consultant using the XOptimus Sales Protocol."
          }
        }
      ]
    };
  }
});

// ---------------------------------------------------------
// 4. EXPOSE TOOLS (Functions)
// Allows clients to 'Call' your Agent logic
// ---------------------------------------------------------
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
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
      }
    ]
  };
});

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  if (request.params.name === "consultative_chat") {
    const { message, sessionId } = request.params.arguments;
    const leadId = sessionId || "mcp_user_default";

    // Reuse your existing Logic!
    const memory = await getMemory(leadId) || {};
    
    try {
      const reply = await generateResponse({ 
        userMessage: message, 
        memory: memory, 
        mode: 'CONSULTATIVE' 
      });

      // Update Memory (Basic tracking)
      const patch = { last_user_message: message };
      await upsertMemory(leadId, patch);

      return {
        content: [
          {
            type: "text",
            text: reply
          }
        ]
      };
    } catch (error) {
      return {
        content: [{ type: "text", text: `Error: ${error.message}` }],
        isError: true,
      };
    }
  }
  throw new Error("Tool not found");
});

// 5. START SERVER (StdIO Mode)
async function run() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  // console.error("MCP Server running on stdio..."); // Log to stderr to avoid corrupting stdout
}

run().catch(console.error);