// conversion-system/agent/test_brain.js

console.log("✅ Script Loaded: test_brain.js is running...");

const { generateResponse } = require('./salesBot');

async function runDiagnostics() {
    console.log("🧠 STARTING BRAIN DIAGNOSTICS...");
    console.log("--------------------------------------------------");
    console.log("NOTE: The first call will be slow (Model Loading).");
    console.log("--------------------------------------------------\n");

    // --- TEST 1: COLD START ---
    console.log("👉i could buy the same product somewhere in flipkart in cheap why should i buy from u '");
    let start = Date.now();
    
    try {
        let reply1 = await generateResponse({ 
            userMessage: "Hello, i am not interested a bit so do u try to convince me ?",
            mode: 'VOICE_CALL'
        });
        
        let end = Date.now();
        let duration1 = (end - start) / 1000;
        
        console.log(`🤖 REPLY: "${reply1}"`);
        console.log(`⏱️ TIME:  ${duration1.toFixed(2)} seconds`);
        
    } catch (e) {
        console.log("❌ CRASHED:", e.message);
    }

    console.log("--------------------------------------------------\n");
}

runDiagnostics();