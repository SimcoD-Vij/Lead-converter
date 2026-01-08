// ---------------------------------------------------------
// TASK: CONSOLE CHAT FOR TESTING AGENT LOGIC
// ---------------------------------------------------------
const readline = require('readline');
const { v4: uuidv4 } = require('uuid');
const { generateResponse } = require('./salesBot');
const { getMemory, upsertMemory } = require('./memory');

// Setup Readline logic to type in terminal
const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

// Generate a random ID for this session so Memory works
const LEAD_ID = `console_user_${Date.now()}`;

console.log("\n=================================================");
console.log("🚀 XOPTIMUS SALES AGENT - CONSOLE MODE");
console.log("   (Type 'exit' or 'quit' to stop)");
console.log("-------------------------------------------------");
console.log(`🆔 Session ID: ${LEAD_ID}`);
console.log("=================================================\n");

// Helper to ask questions
const ask = (query) => new Promise((resolve) => rl.question(query, resolve));

const runChat = async () => {
    // 1. Initialize Memory
    let memory = await getMemory(LEAD_ID) || {};

    while (true) {
        // 2. Get User Input
        const userMessage = await ask("\n👤 YOU: ");

        // Exit condition
        if (['exit', 'quit', 'stop'].includes(userMessage.toLowerCase().trim())) {
            console.log("\n👋 Ending session. Memory saved.");
            rl.close();
            break;
        }

        try {
            // 3. Generate AI Response
            process.stdout.write("🤖 AI: Thinking..."); // Loading indicator
            
            const reply = await generateResponse({ 
                userMessage, 
                memory, 
                mode: 'CONSULTATIVE' 
            });

            // Clear "Thinking..." line
            readline.clearLine(process.stdout, 0);
            readline.cursorTo(process.stdout, 0);

            console.log(`🤖 AI: "${reply}"`);

            // 4. Update Memory
            // We mimic the logic from agent_server.js to track objections/pricing
            const lower = userMessage.toLowerCase();
            const patch = { last_user_message: userMessage };
            
            if (/no budget|not interested|stop/.test(lower)) {
                patch.status = 'OBJECTION';
            }
            if (/price|cost|how much/.test(lower)) {
                patch.pricing_inquiry = true;
            }

            memory = await upsertMemory(LEAD_ID, patch);

        } catch (error) {
            console.log(`\n❌ Error: ${error.message}`);
        }
    }
};

runChat();