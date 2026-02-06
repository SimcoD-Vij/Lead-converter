const { initializeMCP, getMCPTools } = require('./mcp_manager');

(async () => {
    console.log("🔍 Checking Available Tools...");
    try {
        await initializeMCP();
        const tools = getMCPTools();
        console.log("\n✅ AVAILABLE TOOLS:");
        tools.forEach(t => {
            console.log(`- ${t.function.name} (${t.function.description}) [Server: ${t.function.name.includes('context7') ? 'Context7' : 'Action'}]`);
        });
    } catch (e) {
        console.error("❌ Failed:", e);
    }
})();
