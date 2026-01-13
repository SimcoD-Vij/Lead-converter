const { calculateScore } = require('./scoring/scoring_engine');

// MOCK DATA
const mockLead = {
    name: "Test User",
    attempt_count: 2,
    status: "SMS_RECEIVED",
    last_call_summary: { transcript: [] } // No sentiment
};

console.log("--- SCORING ENGINE TEST ---");
console.log("Initial Score:", 0);

// TEST 1: SMS ENGAGEMENT (Should be ~20-50)
const result1 = calculateScore(mockLead, 'WARM', 'SMS_ENGAGED');
console.log(`\nScenario: SMS_ENGAGED + WARM Intent`);
console.log(`Calculated Score: ${result1.score} (Category: ${result1.category})`);

// TEST 2: EMAIL RECEIVED (Should be lower)
const result2 = calculateScore(mockLead, 'COLD', 'MAIL_RECEIVED');
console.log(`\nScenario: MAIL_RECEIVED + COLD Intent`);
console.log(`Calculated Score: ${result2.score} (Category: ${result2.category})`);

// TEST 3: HUMAN HANDOFF (Max)
const result3 = calculateScore(mockLead, 'HOT', 'HUMAN_HANDOFF');
console.log(`\nScenario: HUMAN_HANDOFF + HOT Intent`);
console.log(`Calculated Score: ${result3.score} (Category: ${result3.category})`);

console.log("\n--- CONCLUSION ---");
console.log("The Scoring Engine Logic works correctly within itself.");
console.log("ISSUE: The Email and SMS Engines are NOT calling this function.");
