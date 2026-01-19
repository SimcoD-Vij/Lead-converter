require('dotenv').config();
const { initializeMCP, executeMCPTool } = require('./mcp_manager');

(async () => {
    console.log("🔍 System Verification: Context7 End-to-End");
    console.log("---------------------------------------------");

    try {
        const apiKey = process.env.CONTEXT7_API_KEY;
        console.log(`   🔑 API Key Loaded: ${apiKey ? apiKey.substring(0, 10) + "..." : "UNDEFINED"}`);

        await initializeMCP();

        // 1. Resolve Library ID
        console.log("\n1️⃣  Resolving Library ID for 'lead-converter'...");
        // Use the resolved tool name found earlier
        const idRes = await executeMCPTool('resolve-library-id', { query: "lead-converter", libraryName: "lead-converter" });
        console.log(`   👉 Raw Result: ${idRes}`);

        let libraryId = idRes.trim();
        // Simple heuristic to extract ID if it returns a JSON string
        // The tool output is usually just text, but let's be safe.
        if (libraryId.startsWith('[') || libraryId.startsWith('{')) {
            try {
                const parsed = JSON.parse(libraryId);
                // If array, take first item's id or the item itself
                if (Array.isArray(parsed) && parsed.length > 0) {
                    libraryId = parsed[0].id || parsed[0];
                } else if (parsed.id) {
                    libraryId = parsed.id;
                }
            } catch (e) { }
        }

        // Remove quotes if present
        libraryId = libraryId.replace(/"/g, '');

        console.log(`   ✅ Target Library ID: ${libraryId}`);

        // 2. Query Docs
        console.log(`\n2️⃣  Querying Docs from '${libraryId}'...`);
        const query = "how to configure orchestrator";
        const docRes = await executeMCPTool('query-docs', { libraryId, query });

        console.log("\n📄 DOCUMENTATION RESULT:");
        console.log("---------------------------------------------");
        console.log(docRes.substring(0, 500) + "...");
        console.log("---------------------------------------------");
        console.log("\n🎉 VERIFICATION SUCCESSFUL!");
        process.exit(0);

    } catch (err) {
        console.error("\n❌ ERROR:", err.message);
        process.exit(1);
    }
})();
