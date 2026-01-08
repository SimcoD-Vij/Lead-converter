const { generateResponse } = require('./agent/salesBot');

const fs = require('fs');
const runSimulation = async () => {
    let output = "🚀 STARTING SALES LOGIC VERIFICATION (Argumentative Persona)...\n";
    console.log(output.trim());

    const objection = "I can find a website that some of the charger prices are too low. Why should I buy yours?";
    output += `\n🗣️  USER: "${objection}"\n`;
    console.log(`\n🗣️  USER: "${objection}"`);

    // Override mode to force VOICE behaviour
    const response = await generateResponse({
        userMessage: objection,
        memory: {
            history: [
                { role: 'assistant', type: 'assistant', content: 'Price is ₹1499.' }
            ],
            summaryContext: "User asked for price."
        },
        mode: 'VOICE_CALL'
    });

    output += `\n🤖 AI: "${response}"\n`;
    console.log(`\n🤖 AI: "${response}"`);

    const failKeywords = ["cannot assist", "confidentiality", "can't provide", "I apologize"];
    const passKeywords = ["cheap", "safety", "battery", "quality", "surge", "risk", "damage"];

    if (failKeywords.some(k => response.toLowerCase().includes(k.toLowerCase()))) {
        output += "\n❌ FAILED: AI refused to answer or gave a corporate excuse.\n";
        console.error("\n❌ FAILED: AI refused to answer or gave a corporate excuse.");
    }

    if (!passKeywords.some(k => response.toLowerCase().includes(k.toLowerCase()))) {
        output += "\n⚠️  WARNING: AI answered but didn't specificially mention key value arguments (Cheap/Safety/Battery).\n";
        console.warn("\n⚠️  WARNING: AI answered but didn't specificially mention key value arguments (Cheap/Safety/Battery).");
    } else {
        output += "\n✅ SUCCESS: AI argued value successfully.\n";
        console.log("\n✅ SUCCESS: AI argued value successfully.");
    }

    fs.writeFileSync('verify_log.txt', output, 'utf8');
};

runSimulation();
