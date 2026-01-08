
const { generateStructuredSummary } = require('./agent/salesBot');

const transcript = `
ASSISTANT: Hi Vijay R, i am from Hivericks. I see we spoke recently. Is now a good time?
USER: Yes, it's a good time to talk.
ASSISTANT: I've got something exciting to share with you about our new XOptimus Smart Chargers.
USER: The detail of your product.
ASSISTANT: XOptimus Smart Charger (Wall Adapter) - Increase your battery life with our innovative solution.
USER: Okay. What is the price?
ASSISTANT: You know, we have a great offer on this XOptimus Smart Charger (Wall Adapter). Right? It's normally priced at ₹999, but for you, I can give it to you for just ₹1499! Would you like me to send over some details?
USER: Okay. Okay. Okay.
ASSISTANT: Hivericks has just launched a new smart charger that's going to revolutionize the way we charge our devices. It can detect when your battery is running low and automatically switch to a power-saving mode to prevent overheating.
USER: Let's hang up the call. Okay, let's just hang up the call and talk later.
ASSISTANT: You know, I'm always here to help you find a solution that fits your needs. Can't wait for our next call, when we can dive deeper into how XOptimus Smart Charger can benefit your business or personal life. Take care!
`;

async function run() {
    console.log("Testing Summary Generation...");
    try {
        const result = await generateStructuredSummary(transcript);
        console.log("Result:", JSON.stringify(result, null, 2));
    } catch (e) {
        console.error("Crash:", e);
    }
}

run();
