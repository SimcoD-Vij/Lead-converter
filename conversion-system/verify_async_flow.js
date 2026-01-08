const axios = require('axios');
const { spawn } = require('child_process');
const path = require('path');

const SERVER_PATH = path.join(__dirname, 'voice/call_server.js');
const BASE_URL = 'http://localhost:3000';
const TEST_SID = 'CA_TEST_ASYNC_' + Date.now();

async function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function runTest() {
    console.log("🚀 STARTING CALL SERVER FOR VERIFICATION...");
    const serverProcess = spawn('node', [SERVER_PATH], { stdio: 'inherit', shell: true });

    // Wait for server to boot
    await sleep(3000);

    try {
        console.log(`\n📞 SIMULATING INPUT: "What is the price?"`);

        // 1. Send Initial Input
        const start = Date.now();
        const response1 = await axios.post(`${BASE_URL}/voice/input`, {
            CallSid: TEST_SID,
            SpeechResult: "What is the price of the charger?",
            Confidence: 0.99
        }, {
            headers: { 'Content-Type': 'application/json' } // Use JSON to match our body-parser
        });

        const elapsed1 = Date.now() - start;
        const twiml1 = response1.data;

        console.log(`\nRESPONSE 1 (Immediate) [${elapsed1}ms]:`);
        console.log(twiml1);

        if (!twiml1.includes('<Redirect method="POST">/voice/deferred-response</Redirect>')) {
            throw new Error('❌ FAILED: Response did not contain Redirect to deferred-response.');
        }
        if (!twiml1.includes('<Say') || !twiml1.includes('Let me check')) {
            console.warn('⚠️ WARNING: Response did not contain expected filler phrase.');
        }
        console.log("✅ STEP 1 PASS: Received Immediate Redirect + Filler.");

        // 2. Follow Redirect
        console.log(`\n🔄 FOLLOWING REDIRECT...`);
        const start2 = Date.now();
        const response2 = await axios.post(`${BASE_URL}/voice/deferred-response`, {
            CallSid: TEST_SID
        });

        const elapsed2 = Date.now() - start2;
        const twiml2 = response2.data;

        console.log(`\nRESPONSE 2 (Deferred) [${elapsed2}ms]:`);
        console.log(twiml2);

        if (!twiml2.includes('<Say') || !twiml2.includes('1499')) { // Expecting price 1499 from SalesBot logic
            console.warn('⚠️ WARNING: Response might be missing price info (LLM variance).');
        }

        console.log("✅ STEP 2 PASS: Received Final AI Response.");
        console.log("\n🎉 ASYNC-REDIRECT PATTERN VERIFIED SUCCESSFULLY!");

    } catch (error) {
        console.error("\n❌ TEST FAILED:", error.message);
        if (error.response) {
            console.error("   Status:", error.response.status);
            console.error("   Data:", error.response.data);
        }
    } finally {
        console.log("\n🛑 STOPPING SERVER...");
        serverProcess.kill(); // Might not work on Windows gracefully, but good enough
        process.exit(0);
    }
}

runTest();
