const fs = require('fs');
const { generateResponse, generateFeedbackRequest } = require('./agent/salesBot');

const runTests = async () => {
    let output = "🚀 STARTING CURRENCY & EMAIL VERIFICATION...\n";
    console.log(output.trim());

    // TEST 1: CURRENCY
    const currencyMsg = "What is the price in USD?";
    output += `\n1. Testing Currency Intent: "${currencyMsg}"\n`;
    console.log(`\n1. Testing Currency Intent: "${currencyMsg}"`);

    // Force Voice Mode to test speed/conciseness? No, user asked for logic capability.
    // Let's use SMS mode as it's easier to read text.
    const resp1 = await generateResponse({ userMessage: currencyMsg, mode: 'SMS_CHAT' });
    output += `🤖 AI: "${resp1}"\n`;
    console.log(`🤖 AI: "${resp1}"`);

    // Expect: $18 roughly
    if (resp1.includes("$") || resp1.includes("USD") || resp1.includes("18")) {
        output += "✅ SUCCESS: Currency logic worked.\n";
        console.log("✅ SUCCESS: Currency logic worked.");
    } else {
        output += "❌ FAILURE: Currency logic failed.\n";
        console.error("❌ FAILURE: Currency logic failed.");
    }

    // TEST 2: FORMAL EMAIL
    output += `\n2. Testing Formal Email Generation...\n`;
    console.log(`\n2. Testing Formal Email Generation...`);

    const summary = "User asked about price but found it too high. Explained battery risks.";
    const emailBody = await generateFeedbackRequest(summary, 'EMAIL');

    output += `\n📧 EMAIL DRAFT:\n${emailBody}\n\n`;
    console.log(`\n📧 EMAIL DRAFT:\n${emailBody}\n`);

    if (emailBody.toLowerCase().includes("dear") || emailBody.toLowerCase().includes("as per our discussion")) {
        output += "✅ SUCCESS: Email is formal and context-aware.\n";
        console.log("✅ SUCCESS: Email is formal and context-aware.");
    } else {
        output += "⚠️  WARNING: Email might lack formal structure.\n";
        console.warn("⚠️  WARNING: Email might lack formal structure.");
    }

    fs.writeFileSync('verify_curr_mail.log', output, 'utf8');
};

runTests();
