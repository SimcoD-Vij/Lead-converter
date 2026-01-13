const { generateStructuredSummary, generateFeedbackRequest } = require('./agent/salesBot');

async function verifyPostCallRecovery() {
    console.log("🧪 SIMULATION: Can Post-Call Logic recover a 'Send WhatsApp' request?");

    const transcript = `
    ASSISTANT: Hi, this is Vijay from Hivericks. Do you have a moment?
    USER: Yes.
    ASSISTANT: We have a new XOptimus Charger that saves your battery life. It's 1499 rupees.
    USER: That sounds interesting. Can you send me the details on WhatsApp?
    ASSISTANT: Absolutely, I will send them right over. Is there anything else?
    USER: No, just send it. Bye.
    `;

    console.log("\n1️⃣  GENERATING SUMMARY...");
    try {
        const summaryJSON = await generateStructuredSummary(transcript);
        console.log("   📝 SUMMARY RESULT:", JSON.stringify(summaryJSON, null, 2));

        const nextAction = summaryJSON.next_action?.toLowerCase() || "";
        const summaryText = summaryJSON.conversation_summary?.toLowerCase() || "";

        if (nextAction.includes("send") || nextAction.includes("whatsapp") || summaryText.includes("whatsapp")) {
            console.log("   ✅ SUCCESS: Summary captured the request.");
        } else {
            console.log("   ❌ FAILURE: Summary missed the specific channel request.");
        }

        console.log("\n2️⃣  GENERATING FOLLOW-UP CONTENT (SMS)...");
        const smsDraft = await generateFeedbackRequest(summaryJSON.conversation_summary, 'SMS');
        console.log(`   📱 DRAFT SMS: "${smsDraft}"`);

        if (smsDraft.toLowerCase().includes("detail") || smsDraft.toLowerCase().includes("link")) {
            console.log("   ✅ SUCCESS: SMS Content seems relevant.");
        }

    } catch (e) {
        console.error("   ❌ CRASH:", e.message);
    }
}

verifyPostCallRecovery();
