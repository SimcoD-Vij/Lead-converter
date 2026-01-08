const { generateResponse } = require('./agent/salesBot');

async function testLongCall() {
    console.log("🚀 STARTING LONG CALL SIMULATION (Mocking 20 mins)...");

    // 1. Generate Mock History (100 Turns)
    const mockHistory = [];
    for (let i = 0; i < 50; i++) {
        mockHistory.push({ role: 'user', content: `Question number ${i}: Is it durable?` });
        mockHistory.push({ role: 'assistant', content: `Answer number ${i}: Yes, extremely.` });
    }

    console.log(`   📝 Generated History: ${mockHistory.length} turns.`);

    // 2. Measure Response Time for the 101st Turn
    const userMessage = "That sounds good. What exactly is the price again?";
    console.log(`\n   🗣️  User (Turn 101): "${userMessage}"`);

    const start = Date.now();
    try {
        const response = await generateResponse({
            userMessage: userMessage,
            memory: { history: mockHistory, summaryContext: "User is interested but skeptical." },
            mode: 'VOICE_CALL'
        });
        const duration = Date.now() - start;

        console.log(`\n   🤖 AI Response: "${response}"`);
        console.log(`   ⚡ Response Time: ${duration}ms`);

        if (response && duration < 5000) {
            console.log("\n✅ SUCCESS: System handled context depth without degradation.");
        } else {
            console.error("\n❌ FAILURE: Response too slow or empty.");
        }

    } catch (e) {
        console.error("\n❌ CRASHED:", e);
    }
}

testLongCall();
