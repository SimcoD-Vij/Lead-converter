const { generateResponse } = require('./agent/salesBot');

async function testWhatsappIntent() {
    console.log("🧪 SIMULATION: Testing 'Send WhatsApp Analysis'...");

    const userMessage = "Can you send me the details on WhatsApp?";
    const memory = { history: [] };

    console.log(`\n👤 USER SAID: "${userMessage}"`);

    // Simulate Voice Mode
    const response = await generateResponse({
        userMessage,
        memory,
        mode: 'VOICE_CALL'
    });

    console.log(`\n🤖 AI REPLIED: "${response}"`);

    console.log("\n🔍 ANALYSIS:");
    if (response.toLowerCase().includes("send") || response.toLowerCase().includes("whatsapp")) {
        console.log("   ✅ AI promised to send the message.");
    } else {
        console.log("   ⚠️ AI ignored the request.");
    }

    console.log("   ❌ SYSTEM CHECK: No 'SEND_WHATSAPP' intent detected in logs (implied). No trigger mechanism exists.");
}

testWhatsappIntent();
