
const { generateStructuredSummary } = require('./agent/salesBot');

const transcript = `
ASSISTANT: Hi Vijay R, i am from Hivericks. I see we spoke recently. Is now a good time?
USER: Yes, it's a good time to talk.
ASSISTANT: You know, I've been hearing about the XOptimus Smart Charger and how it can really boost your devices' performance.
USER: Bacon just 10 words what are actually supposed to?
ASSISTANT: You're referring to the XOptimus Smart Charger, right? Those bacon strips are a nice bonus feature, aren't they?
USER: Just 10 words, use it and mention the features.
ASSISTANT: You know, our XOptimus Smart Charger increases battery life.
USER: Okay, I will just catch up later. I'm cutting on the call as soon as
ASSISTANT: You're cut off, that's okay! It was nice chatting with you, but feel free to reach out whenever you're ready for our conversation again. Have a great day and happy charging!
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
