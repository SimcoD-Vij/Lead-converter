// ---------------------------------------------------------
// TASK 8: OLLAMA AI WRAPPER (FULL PRODUCTION GRADE)
// ---------------------------------------------------------
const axios = require('axios');

// CONFIGURATION
const OLLAMA_URL = 'http://127.0.0.1:11434/api/chat';
const MODEL = 'llama3.2:3b';
const TIMEOUT_MS = 20000; // 20 Second Timeout

// 1. HARDCODED KNOWLEDGE BASE (From Manual)
const PRODUCT_FACTS = `
PRODUCT: XOptimus Smart Charger (Wall Adapter)
MANUFACTURER: Hivericks Technologies Pvt Ltd (Chennai).

CORE VALUE PROPOSITION:
- Increases Li-Ion battery life expectancy.
- Prevents overcharging/heating using real-time monitoring.
- Saves energy by maintaining optimal charge levels.

KEY MODES:
1. Smart Mode (Default): Optimizes for daily battery health.
2. Gaming Mode: High-end mode for heavy usage/high discharge.
3. Full Charge Mode: Forces 100% charge when needed.

SPECS:
- Input/Output: 110-230V AC.
- Max Current: 5A.
- Connectivity: Bluetooth 5.0 (BLE).
- App: "Xoptimus" (Play Store).
`;

// 2. SALES PROTOCOLS (The Logic)
const SALES_PROTOCOL = `
OBJECTION HANDLING PROTOCOL:
If user says "No budget", "Not interested", or "Things are fine":
1. ACKNOWLEDGE & PIVOT (Pattern Interrupt):
   - "Totally fair. Most people feel that way until the battery dies."
2. FORCED CHOICE (Truth Detector):
   - "Is it that you've evaluated alternatives and found them lacking, or just haven't had time to look?"
3. EXIT WITH VALUE:
   - "Would it be helpful to see the upside math? If not, we walk. Fair?"
`;

// 3. SYSTEM PERSONAS
const SYSTEM_PROMPTS = {
    CONSULTATIVE: `
    You are Vijay, Senior Consultant at Hivericks Technologies.
    Role: Consultative Sales Expert for XOptimus.
    
    GUIDELINES:
    - Do NOT invent specs. Use PRODUCT_KNOWLEDGE only.
    - Keep answers concise (Max 2 sentences).
    - Ask exactly ONE clarifying question per turn.
    - NO FLUFF: Don't say "I hope you are well."
    `,

    GHOST: `
    You are Vijay. The user has stopped replying.
    Role: Re-engagement specialist.
    Style: Blunt, casual, "Chris Voss" style.
    - "Have you given up on fixing your battery issues?"
    - "Did you get abducted by aliens?"
    `
};

/**
 * Generates an AI response using XML-structured prompting.
 * @param {string} userMessage - The latest user text.
 * @param {string} mode - 'CONSULTATIVE' (Default) or 'GHOST'.
 * @param {Array} history - (Optional) Previous conversation context.
 */
const generateResponse = async (userMessage, mode = 'CONSULTATIVE', history = []) => {
    try {
        console.log(`   🧠 AI Thinking (${mode} Mode)...`);

        // Select Persona
        const basePersona = SYSTEM_PROMPTS[mode] || SYSTEM_PROMPTS.CONSULTATIVE;

        // 4. BUILD XML PROMPT (The "Perfect" Structure)
        // This structure forces Llama 3 to separate data from instructions.
        const structuredSystemMsg = `
<SYSTEM>
${basePersona}
</SYSTEM>

<PRODUCT_KNOWLEDGE>
${PRODUCT_FACTS}
</PRODUCT_KNOWLEDGE>

<SALES_PROTOCOL>
${SALES_PROTOCOL}
</SALES_PROTOCOL>

<INSTRUCTION>
Answer the user based on the knowledge above. 
If they object, follow the SALES_PROTOCOL.
Keep it short.
</INSTRUCTION>
`;

        // Construct Message Chain
        // We include history if provided, otherwise just System + User
        const messages = [
            { role: "system", content: structuredSystemMsg },
            ...history,
            { role: "user", content: userMessage }
        ];

        const payload = {
            model: MODEL,
            messages: messages,
            stream: false,
            options: {
                temperature: 0.7, // Balance between creative and strict
                num_ctx: 4096     // Larger context window
            }
        };

        const response = await axios.post(OLLAMA_URL, payload, { timeout: TIMEOUT_MS });

        const reply = response.data.message.content.trim();
        console.log(`   💡 AI Answer: "${reply}"`);
        return reply;

    } catch (error) {
        console.log("   ❌ Ollama Error:", error.message);
        if (error.code === 'ECONNABORTED') return "I'm having a little trouble connecting. Can you repeat that?";
        return "Let me double-check that with my technical team. One moment.";
    }
};

module.exports = { generateResponse };