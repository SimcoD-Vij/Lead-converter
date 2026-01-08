const axios = require('axios');
const fs = require('fs');

// MOCK DATA
const MOCK_SID = `SIM_${Date.now()}`;
const MOCK_PHONE = "+917604896187";

async function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function runSimulation() {
    console.log("🚀 STARTING E2E SIMULATION (INPUT ONLY)...");

    try {
        console.log("\n   📞 MOCK: Incoming Call...");
        await axios.post('http://localhost:8080/voice', { // Use Gateway Port or Internal? Gateway is 8080.
            // Gateway proxies to 3000. Let's use 3000 to be safe/direct.
            CallSid: MOCK_SID, Direction: 'inbound', From: MOCK_PHONE, To: '+15555555555'
        });

        await sleep(2000);

        console.log("\n   🗣️  MOCK: User Input (USD Request)...");
        // NOTE: call_server.js expects req.body.SpeechResult directly? 
        // No, Gateway strips parsing?
        // Let's use internal 3000.
        await axios.post('http://localhost:3000/voice/input', {
            CallSid: MOCK_SID, SpeechResult: "What is the price in USD?", Confidence: 0.99
        });

        await sleep(5000);

        console.log("\n   🛑 MOCK: Call Completed...");
        await axios.post('http://localhost:3000/voice/status', {
            CallSid: MOCK_SID, CallStatus: 'completed', Direction: 'inbound', From: MOCK_PHONE
        });

        console.log("\n   ✅ MOCK INPUTS SENT SUCCESSFULLY.");

    } catch (e) {
        console.error("   ❌ SIMULATION ERROR (Check if Orchestrator is running):", e.message);
    }
}

runSimulation();
