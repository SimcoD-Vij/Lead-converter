
const { Client } = require("@modelcontextprotocol/sdk/client/index.js");
const { StdioClientTransport } = require("@modelcontextprotocol/sdk/client/stdio.js");
const path = require("path");

// CONFIGURATION
const SERVERS = [
    {
        id: "hivericks-action",
        command: "node",
        args: [path.join(__dirname, "../mcp-server/index.js")]
    },
    {
        id: "context7",
        command: "node",
        args: [
            path.join(__dirname, "../context7-server/packages/mcp/dist/index.js"),
            ...(process.env.CONTEXT7_API_KEY ? ["--api-key", process.env.CONTEXT7_API_KEY] : [])
        ]
    }
];

let clients = [];
let allTools = [];

// 1. INITIALIZE CLIENTS
const initializeMCP = async () => {
    console.log("   🔌 MCP: Connecting to Tool Servers...");
    clients = [];
    allTools = [];

    for (const srv of SERVERS) {
        try {
            const transport = new StdioClientTransport({
                command: srv.command,
                args: srv.args
            });

            const client = new Client({
                name: "hivericks-sales-bot",
                version: "1.0.0"
            }, {
                capabilities: { tools: {} }
            });

            await client.connect(transport);

            // Fetch Tools
            const toolsResult = await client.listTools();
            const tools = toolsResult.tools.map(t => ({ ...t, serverId: srv.id }));

            if (tools.length > 0) {
                console.log(`      ✅ Connected to ${srv.id}: Loaded ${tools.length} tools.`);
                allTools.push(...tools);
                clients.push({ id: srv.id, client, tools });
            }

        } catch (e) {
            console.error(`      ❌ Failed to connect to ${srv.id}: ${e.message}`);
        }
    }
    return true;
};

// 2. GET TOOLS (Formatted for AI)
const getMCPTools = (allowedServers = null) => {
    let toolsToReturn = allTools;

    if (allowedServers) {
        toolsToReturn = allTools.filter(t => allowedServers.includes(t.serverId));
    }

    return toolsToReturn.map(t => ({
        type: "function",
        function: {
            name: t.name,
            description: t.description,
            parameters: t.inputSchema
        }
    }));
};

// 3. EXECUTE TOOL
const executeMCPTool = async (toolName, args) => {
    const serverObj = clients.find(c => c.tools.some(t => t.name === toolName));
    if (!serverObj) {
        throw new Error(`Tool ${toolName} not found in any connected MCP server.`);
    }

    console.log(`   🛠️  MCP EXECUTION: ${serverObj.id} -> ${toolName}(${JSON.stringify(args)})`);

    const result = await serverObj.client.callTool({
        name: toolName,
        arguments: args
    });

    // Parse Result
    if (result.isError) {
        throw new Error(result.content.map(c => c.text).join('\n'));
    }

    return result.content.map(c => c.text).join('\n');
};

module.exports = { initializeMCP, getMCPTools, executeMCPTool };
