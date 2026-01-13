const { detectIntent } = require('./agent/salesBot');

const testCases = [
    "Give me the product details",
    "I want to buy",
    "Send me bank details",
    "Tell me about the specs",
    "give me details",
    "details please"
];

console.log("--- INTENT DETECTION TEST ---");
testCases.forEach(msg => {
    const intent = detectIntent(msg, 'EMAIL_REPLY');
    console.log(`"${msg}" -> ${intent ? intent.type : 'NULL'}`);
});
