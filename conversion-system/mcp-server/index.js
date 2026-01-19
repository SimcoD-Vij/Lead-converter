#!/usr/bin/env node

/**
 * HIVERICKS ACTION MCP SERVER
 * ---------------------------
 * Exposes system capabilities as AI Tools.
 * Mechanisms: Modifies shared 'clean_leads.json' state to trigger Orchestrator.
 */

const { Server } = require("@modelcontextprotocol/sdk/server/index.js");
const { StdioServerTransport } = require("@modelcontextprotocol/sdk/server/stdio.js");
const { CallToolRequestSchema, ListToolsRequestSchema } = require("@modelcontextprotocol/sdk/types.js");
const { z } = require("zod");
const fs = require("fs");
const path = require("path");

const LEADS_FILE = path.join(__dirname, "../processed_leads/clean_leads.json");

// HELPER: Read/Write Leads safely
const updateLeadState = (phone, updates) => {
    if (!fs.existsSync(LEADS_FILE)) return { success: false, error: "Database not found" };

    try {
        const leads = JSON.parse(fs.readFileSync(LEADS_FILE, "utf8"));
        const idx = leads.findIndex(l => l.phone.includes(phone.replace("whatsapp:", "")) || phone.includes(l.phone));

        if (idx === -1) return { success: false, error: "Lead not found" };

        // Apply Updates
        Object.keys(updates).forEach(key => {
            leads[idx][key] = updates[key];
        });
        leads[idx].last_updated = new Date().toISOString();

        fs.writeFileSync(LEADS_FILE, JSON.stringify(leads, null, 2));
        console.error(`[MCP] Updated Lead ${leads[idx].name}: ${JSON.stringify(updates)}`);
        return { success: true, lead: leads[idx] };
    } catch (e) {
        return { success: false, error: e.message };
    }
};

// CREATE SERVER
const server = new Server(
    {
        name: "hivericks-action-server",
        version: "1.0.0",
    },
    {
        capabilities: {
            tools: {},
        },
    }
);

// 1. LIST TOOLS
server.setRequestHandler(ListToolsRequestSchema, async () => {
    return {
        tools: [
            {
                name: "trigger_voice_call",
                description: "Scheudle an IMMEDIATE voice call to the user. Use when user says 'Call me', 'Speak to me', or asks for a call.",
                inputSchema: {
                    type: "object",
                    properties: {
                        phone: { type: "string", description: "User's phone number" },
                        reason: { type: "string", description: "Why the call is being triggered (brief)" }
                    },
                    required: ["phone"]
                }
            },
            {
                name: "escalate_to_human",
                description: "Handoff the lead to a HUMAN agent. Use when user wants to buy, pay, or is frustrated.",
                inputSchema: {
                    type: "object",
                    properties: {
                        phone: { type: "string", description: "User's phone number" },
                        reason: { type: "string", description: "Reason for handoff" }
                    },
                    required: ["phone"]
                }
            },
            {
                name: "schedule_call",
                description: "Flag a call for later/clarification. Use when user says 'Call me later' or 'Schedule a time'.",
                inputSchema: {
                    type: "object",
                    properties: {
                        phone: { type: "string", description: "User's phone number" },
                        when: { type: "string", description: "Preferred time (optional string)" }
                    },
                    required: ["phone"]
                }
            },
            {
                name: "send_sms_message",
                description: "Send a textual information via WhatsApp/SMS. Use when user says 'Send details', 'WhatsApp me', or asks for info.",
                inputSchema: {
                    type: "object",
                    properties: {
                        phone: { type: "string", description: "User's phone number" },
                        message: { type: "string", description: "The content to send (e.g. product details)." }
                    },
                    required: ["phone", "message"]
                }
            }
        ]
    };
});

// 2. CALL TOOLS
server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;

    if (name === "trigger_voice_call") {
        const res = updateLeadState(args.phone, { status: "SMS_TO_CALL_REQUESTED" });
        if (res.success) {
            return { content: [{ type: "text", text: "Call Initiated. Creating immediate voice request." }] };
        }
        return { content: [{ type: "text", text: `Failed: ${res.error}` }], isError: true };
    }

    if (name === "escalate_to_human") {
        const res = updateLeadState(args.phone, { status: "HUMAN_HANDOFF" });
        if (res.success) {
            return { content: [{ type: "text", text: "Lead graduated to Human Desk." }] };
        }
        return { content: [{ type: "text", text: `Failed: ${res.error}` }], isError: true };
    }

    if (name === "schedule_call") {
        const res = updateLeadState(args.phone, { status: "SMS_CALL_SCHEDULED" });
        if (res.success) {
            return { content: [{ type: "text", text: "Call Scheduled. Status updated." }] };
        }
        return { content: [{ type: "text", text: `Failed: ${res.error}` }], isError: true };
    }

    if (name === "send_sms_message") {
        const res = updateLeadState(args.phone, {
            status: "SMS_SEND_REQUESTED",
            pending_sms_content: args.message
        });
        if (res.success) {
            return { content: [{ type: "text", text: "SMS Requested. System will dispatch shortly." }] };
        }
        return { content: [{ type: "text", text: `Failed: ${res.error}` }], isError: true };
    }

    throw new Error(`Tool ${name} not found`);
});

// START
const runServer = async () => {
    const transport = new StdioServerTransport();
    await server.connect(transport);
    console.error("Hivericks Action MCP running on stdio");
};

runServer().catch(console.error);
