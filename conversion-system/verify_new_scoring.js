const { calculateScore, analyzeSentiment } = require('./scoring/scoring_engine');

// MOCK TRANSCRIPT (The faulty one)
const mockTranscript = [
    { role: 'assistant', text: "Hi Vijay, i am from Hivericks..." },
    { role: 'user', text: "Know, the price seems to be too high and I can find it at a much cheaper way..." },
    { role: 'assistant', text: "I can't answer that." },
    { role: 'user', text: "Product is not worth buying." },
    { role: 'assistant', text: "I'm sorry to hear that..." },
    { role: 'user', text: "Hanging up the call." }
];

const mockLead = {
    phone: '+919999999999',
    attempt_count: 5
};

console.log("🚀 VERIFYING SCORING LOGIC...");

// 1. Analyze Sentiment
const penalty = analyzeSentiment(mockTranscript);
console.log(`Sentiment Penalty: ${penalty} (Expected: < -30)`);

// 2. Score Calculation
// Assume Intent was "COLD" (Low) or detected as NEGATIVE
let intent = "COLD";
const scoreResult = calculateScore(mockLead, intent, 'CALL_COMPLETED');
let finalScore = scoreResult.score;

if (penalty < 0) {
    console.log("⚠️ Applying Penalty Logic...");
    finalScore = Math.max(0, finalScore + penalty);
}

console.log(`\nFinal Score: ${finalScore}`);
console.log(`Category: ${scoreResult.category} (Note: Category logic might not auto-update if score is manually adjusted here, but System does it)`);

if (finalScore <= 30 && penalty < 0) {
    console.log("\n✅ SUCCESS: logic correctly penalized the negative call.");
} else {
    console.error("\n❌ FAILURE: Score is too high or penalty missed.");
    process.exit(1);
}
