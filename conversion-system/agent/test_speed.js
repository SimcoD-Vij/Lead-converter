// conversion-system/agent/test_speed.js
const { generateResponse } = require('./salesBot');

async function runSpeedTest() {
    console.log("🚀 STARTING BRAIN SPEED TEST...");
    console.log("------------------------------------------------");

    // Test 1: Simple Greeting
    console.log("🗣️  USER: 'Hello, who is this?'");
    let start = Date.now();
    let reply = await generateResponse({ userMessage: "Hello, who is this?" });
    let time1 = Date.now() - start;
    
    if (time1 > 2000) console.log("⚠️  SLOW: > 2 Seconds");
    else console.log("✅  FAST");
    console.log("------------------------------------------------");

    // Test 2: Product Question
    console.log("🗣️  USER: 'How much does the charger cost?'");
    start = Date.now();
    reply = await generateResponse({ userMessage: "How much does the charger cost?" });
    let time2 = Date.now() - start;

    if (time2 > 2000) console.log("⚠️  SLOW: > 2 Seconds");
    else console.log("✅  FAST");
    console.log("------------------------------------------------");

    // Test 3: Rejection
    console.log("🗣️  USER: 'I am not interested.'");
    start = Date.now();
    reply = await generateResponse({ userMessage: "I am not interested." });
    let time3 = Date.now() - start;

    if (time3 > 2000) console.log("⚠️  SLOW: > 2 Seconds");
    else console.log("✅  FAST");
    console.log("------------------------------------------------");

    console.log("📊 AVERAGE RESPONSE TIME:", Math.round((time1 + time2 + time3) / 3) + "ms");
    console.log("NOTE: For Voice, this MUST be under 1500ms.");
}

runSpeedTest();