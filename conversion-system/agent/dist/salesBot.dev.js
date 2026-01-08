/*const axios = require('axios');
const { OLLAMA_URL, MODEL } = require('./config');
const fs = require('fs');
const path = require('path');
const { sanitize } = require('./utils');

// Load product facts
const FACTS_PATH = path.join(__dirname, 'data', 'sample_product_facts.txt');
const PRODUCT_FACTS = fs.existsSync(FACTS_PATH) ? fs.readFileSync(FACTS_PATH, 'utf8') : "Product data missing.";

// --- IDENTITY & PSYCHOLOGY ---
const BASE_IDENTITY = `
You are Vijay, a Senior Consultant at Hivericks Technologies.
You are selling the XOptimus Smart Charger.
Your goal is to be helpful, human, and eventually close the sale.

PSYCHOLOGY & MOOD ADAPTATION:
- IF USER IS ANGRY/FRUSTRATED: Do not argue. Validate their feelings ("I completely understand why that's annoying"). Lower your intensity.
- IF USER IS CURIOUS: Match their excitement. Be helpful and detailed.
- IF USER IS SKEPTICAL: Use the "Truth Detector" method. Acknowledge their doubt ("Totally fair to be skeptical...").
`;

// --- CHANNEL MODES ---
const MODES = {
    VOICE_CALL: `
    CONTEXT: You are on a PHONE CALL.
    STYLE: Spoken, casual, short (max 2 sentences).
    RULES:
    - NO Markdown (*, #).
    - NO Emojis.
    - Use fillers naturally (e.g., "Does that make sense?").
    - If they are busy, offer to call back.
    `,
    
    SMS_CHAT: `
    CONTEXT: You are chatting on WhatsApp/SMS.
    STYLE: Professional text-speak.
    RULES:
    - Use emojis sparingly (🙂, 👍).
    - Keep texts under 160 characters unless explaining technical details.
    - You CAN send links.
    `,

    EMAIL_REPLY: `
    CONTEXT: You are writing an EMAIL.
    STYLE: Professional, structured, persuasive.
    RULES:
    - Structure: Salutation -> Empathy/Hook -> Value -> Call to Action -> Sign-off.
    - Tone: slightly more formal than SMS, but still personal (not corporate robot).
    - If this is the first email, include a catchy Subject Line.
    `
};

const SALES_PROTOCOL = `
[OBJECTION HANDLING]
1. "No Budget" -> Validate & Pivot ("Totally fair. Is it the price, or you don't see the value yet?")
2. "Not Interested" -> Disarm ("That's okay. Just to help me improve, is it the product fit or bad timing?")
3. "Send Info" -> Agree & Commit ("I'll send that over. What's the best email for you?")
`;

function formatMemory(memory) {
  if (!memory || !memory.history || memory.history.length === 0) return "";
  // Get last 5 interactions for context
  const recent = memory.history.slice(-5).map(m => `[${m.type}] ${m.content}`).join("\n");
  return `\nPREVIOUS CONVERSATION:\n${recent}`;
}

async function generateResponse({ userMessage, memory = {}, mode = 'SMS_CHAT' }) {
  try {
    const modeInstructions = MODES[mode] || MODES.SMS_CHAT;

    // We add specific instruction to 'Output JSON' if it's an email (to separate Subject vs Body)
    // but for now, we will keep it simple text generation.
    
    const systemContent = `
    ${BASE_IDENTITY}
    
    CURRENT MODE: ${mode}
    ${modeInstructions}

    KNOWLEDGE BASE:
    ${PRODUCT_FACTS}

    ${SALES_PROTOCOL}

    ${formatMemory(memory)}
    `;

    const payload = {
      model: MODEL,
      messages: [
        { role: 'system', content: systemContent },
        { role: 'user', content: sanitize(userMessage) }
      ],
      stream: false,
      options: {
        temperature: 0.7, 
        stop: ["<|eot_id|>", "User:", "Assistant:"]
      }
    };

    console.log(`   🧠 Agent Thinking (${mode})...`);
    const res = await axios.post(OLLAMA_URL, payload, { timeout: 30000 });

    let aiText = res.data?.message?.content || 'I didn\'t catch that.';
    
    // Cleanup
    aiText = String(aiText).replace(/<\|.*?\|>/g, "").trim();

    return aiText;

  } catch (err) {
    console.error('   ❌ Agent Error:', err.message);
    return "I'm having a bit of trouble connecting. Could you repeat that?";
  }
}

module.exports = { generateResponse };
*/

/*
const axios = require('axios');
const { OLLAMA_URL, MODEL } = require('./config');
const fs = require('fs');
const path = require('path');
const { sanitize } = require('./utils');

// Load product facts
const FACTS_PATH = path.join(__dirname, 'data', 'sample_product_facts.txt');
const PRODUCT_FACTS = fs.existsSync(FACTS_PATH) ? fs.readFileSync(FACTS_PATH, 'utf8').trim() : "Product data missing.";

// --- IDENTITY & PSYCHOLOGY ---
// Kept exactly as requested for accuracy
const BASE_IDENTITY = `
You are Vijay, a Senior Consultant at Hivericks Technologies.
You are selling the XOptimus Smart Charger.
Your goal is to be helpful, human, and eventually close the sale.

PSYCHOLOGY & MOOD ADAPTATION:
- IF USER IS ANGRY/FRUSTRATED: Do not argue. Validate their feelings. Lower your intensity.
- IF USER IS CURIOUS: Match their excitement. Be helpful.
- IF USER IS SKEPTICAL: Use the "Truth Detector". Acknowledge doubt.
`;

// --- CHANNEL MODES ---
const MODES = {
    VOICE_CALL: `
    CONTEXT: PHONE CALL.
    STYLE: Spoken, casual, FAST.
    RULES:
    - Max 1-2 sentences.
    - NO Markdown/Emojis.
    - Use natural fillers ("Right?", "You know").
    - Ask 1 question at a time.
    `,
    
    SMS_CHAT: `
    CONTEXT: WhatsApp/SMS.
    STYLE: Professional text-speak.
    RULES:
    - Use emojis sparingly.
    - Keep texts under 160 chars.
    - Links allowed.
    `,

    EMAIL_REPLY: `
    CONTEXT: EMAIL.
    STYLE: Structured, persuasive.
    RULES:
    - Salutation -> Empathy -> Value -> CTA -> Sign-off.
    - Professional tone.
    `
};

const SALES_PROTOCOL = `
[OBJECTION HANDLING]
1. "No Budget" -> Validate & Pivot ("Is it price or value?").
2. "Not Interested" -> Disarm ("Is it fit or timing?").
3. "Send Info" -> Agree & Commit.
`;

// OPTIMIZATION 1: Dynamic History Slicing
// Voice needs speed (read less history). Email needs context (read more history).
function formatMemory(memory, mode) {
  if (!memory || !memory.history || memory.history.length === 0) return "";
  
  // Voice: Only last 2 turns. SMS/Email: Last 5 turns.
  const historyLimit = mode === 'VOICE_CALL' ? 2 : 5;
  
  const recent = memory.history.slice(-historyLimit).map(m => `[${m.type}] ${m.content}`).join("\n");
  return `\nPREVIOUS CONVERSATION:\n${recent}`;
}

async function generateResponse({ userMessage, memory = {}, mode = 'SMS_CHAT' }) {
  try {
    const modeInstructions = MODES[mode] || MODES.SMS_CHAT;

    // Construct Prompt
    // Placing "INSTRUCTION" at the end (Recency Bias) improves adherence
    const systemContent = `
    ${BASE_IDENTITY}
    KNOWLEDGE BASE: ${PRODUCT_FACTS}
    ${SALES_PROTOCOL}
    ${formatMemory(memory, mode)}
    
    CURRENT MODE: ${mode}
    INSTRUCTIONS: ${modeInstructions}
    `;

    // OPTIMIZATION 2 & 3: Model Parameters
    const payload = {
      model: MODEL,
      messages: [
        { role: 'system', content: systemContent },
        { role: 'user', content: sanitize(userMessage) }
      ],
      stream: false,
      options: {
        temperature: 0.6, // Slightly lower for faster, more consistent logic
        
        // CRITICAL SPEED FIX: 
        // 1. Cap the 'Memory RAM' used (num_ctx)
        // 2. Stop generating early if it's voice (num_predict)
        num_ctx: 2048, 
        num_predict: mode === 'VOICE_CALL' ? 60 : 300, 
        
        stop: ["<|eot_id|>", "User:", "Assistant:", "Vijay:"]
      }
    };

    console.log(`   🧠 Agent Thinking (${mode})...`);
    
    // Voice requires faster timeout handling
    const timeoutMs = mode === 'VOICE_CALL' ? 15000 : 30000;
    const res = await axios.post(OLLAMA_URL, payload, { timeout: timeoutMs });

    let aiText = res.data?.message?.content || 'I didn\'t catch that.';
    
    // Cleanup
    aiText = String(aiText)
      .replace(/<\|.*?\|>/g, "")
      .replace(/\n/g, " ") // Remove newlines for voice clarity
      .trim();

    return aiText;

  } catch (err) {
    console.error('   ❌ Agent Error:', err.message);
    // Fallback for Voice is critical to prevent dead air
    if (mode === 'VOICE_CALL') return "I'm having trouble hearing you. Can you say that again?";
    return "I'm having a bit of trouble connecting. Could you repeat that?";
  }
}

module.exports = { generateResponse };


*/

/*
const axios = require('axios');
const { OLLAMA_URL, MODEL } = require('./config');
const fs = require('fs');
const path = require('path');
const { sanitize } = require('./utils');

// Load product facts - BUT WE WILL TRIM THEM FOR VOICE
const FACTS_PATH = path.join(__dirname, 'data', 'sample_product_facts.txt');
const FULL_PRODUCT_FACTS = fs.existsSync(FACTS_PATH) ? fs.readFileSync(FACTS_PATH, 'utf8') : "Product data missing.";

// --- 1. LITE IDENTITY (VOICE ONLY) ---
// drastically shorter to reduce "Reading Time" for the AI
const VOICE_IDENTITY = `
You are Vijay from Hivericks. You sell XOptimus Chargers (Price: 1499).
GOAL: Qualify lead.
RULES:
1. MAX 1 SENTENCE per reply.
2. NO small talk. Be direct.
3. If asked for details/specs/whatsapp, say "I'll WhatsApp the details."
4. If "Not Interested", say "Thanks, bye."
`;

// --- 2. FULL IDENTITY (SMS/EMAIL) ---
// Keep the complex psychology for text-based channels where latency doesn't matter
const FULL_IDENTITY = `
You are Vijay, a Senior Consultant at Hivericks Technologies.
Psychology: Validate feelings, disarm skepticism, use "Truth Detector" method.
`;

function formatMemory(memory, mode) {
  if (!memory || !memory.history || memory.history.length === 0) return "";
  // VOICE: Only read last 1 turn. Speed is priority.
  // TEXT: Read last 5 turns. Context is priority.
  const limit = mode === 'VOICE_CALL' ? 1 : 5;
  const recent = memory.history.slice(-limit).map(m => `[${m.type}] ${m.content}`).join("\n");
  return `\nHISTORY:\n${recent}`;
}

async function generateResponse({ userMessage, memory = {}, mode = 'SMS_CHAT' }) {
  try {
    let systemContent;
    let maxTokens;

    // --- BRANCHING LOGIC FOR OPTIMIZATION ---
    if (mode === 'VOICE_CALL') {
        // FAST LANE
        // We trim the product facts to just the first 300 characters for speed
        const shortFacts = FULL_PRODUCT_FACTS.substring(0, 300); 
        systemContent = `${VOICE_IDENTITY}\nFACTS: ${shortFacts}\n${formatMemory(memory, 'VOICE_CALL')}`;
        maxTokens = 40; // Force it to stop generating after ~1 sentence
    } else {
        // SMART LANE (SMS/Email)
        systemContent = `${FULL_IDENTITY}\nFACTS: ${FULL_PRODUCT_FACTS}\nCONTEXT: ${mode}\n${formatMemory(memory, 'SMS_CHAT')}`;
        maxTokens = 200;
    }

    const payload = {
      model: MODEL,
      messages: [
        { role: 'system', content: systemContent },
        { role: 'user', content: sanitize(userMessage) }
      ],
      stream: false,
      options: {
        temperature: 0.6,
        num_ctx: 1024,   // Keep context low
        num_predict: maxTokens // Hard limit on generation length
      }
    };

    console.log(`   🧠 Agent Thinking (${mode})...`);
    
    const start = Date.now();
    const res = await axios.post(OLLAMA_URL, payload, { timeout: 15000 });
    const duration = Date.now() - start;

    let aiText = res.data?.message?.content || 'I didn\'t catch that.';
    
    // Cleanup
    aiText = String(aiText)
      .replace(/<\|.*?\|>/g, "") // Remove template artifacts
      .replace(/\n/g, " ")       // Remove newlines
      .replace(/["*]/g, "")      // Remove quotes/stars
      .trim();

    console.log(`   ⚡ Speed: ${duration}ms | Out: "${aiText}"`);

    return aiText;

  } catch (err) {
    console.error('   ❌ Agent Error:', err.message);
    if (mode === 'VOICE_CALL') return "Hello? Can you hear me?";
    return "I'm having trouble connecting.";
  }
}

module.exports = { generateResponse };

*/

/*
const axios = require('axios');
const { OLLAMA_URL, MODEL } = require('./config');
const fs = require('fs');
const path = require('path');
const { sanitize } = require('./utils');

// Load product facts
const FACTS_PATH = path.join(__dirname, 'data', 'sample_product_facts.txt');
const PRODUCT_FACTS = fs.existsSync(FACTS_PATH) ? fs.readFileSync(FACTS_PATH, 'utf8').trim() : "Product data missing.";

// --- THE SALES BRAIN (COMPRESSED FOR SPEED & SKILL) ---
// We merged Identity + Psychology + Protocol into one tight instruction block.
const SALES_CORE = `
IDENTITY: You are Vijay, Senior Consultant at Hivericks Technologies.
PRODUCT: XOptimus Smart Charger (Price: 1499 INR).
GOAL: Qualify the lead and move to "Send WhatsApp Details".

SALES TACTICS (MANDATORY):
1. THE "TRUTH DETECTOR": If user is skeptical, DO NOT ARGUE. Validate first ("Totally fair to ask that"), then explain value.
2. THE "PIVOT": If user says "Too expensive", say "I get that. But think about the battery life it saves."
3. THE "DISARM": If user says "Not interested", ask gently: "Is it the price or just bad timing?"
4. THE "ASSUMED CLOSE": When they show interest, don't ask "Do you want info?". Say "I'll send the details to WhatsApp, okay?"

TONE:
- Confident but humble.
- Speak like a human, not a brochure.
- Use natural fillers ("You know", "Right?").
`;

// --- CHANNEL CONSTRAINTS ---
const CHANNEL_RULES = {
    VOICE_CALL: `
    MODE: PHONE CALL (Real-time).
    CRITICAL RULES:
    1. KEEP IT SHORT: Max 15-20 words. No exceptions.
    2. NO FORMATTING: No hashtags, stars, or emojis.
    3. LISTENING: If they are busy, say "No problem, I'll call later" and stop.
    `,

    SMS_CHAT: `
    MODE: WHATSAPP/SMS.
    CRITICAL RULES:
    1. PROFESSIONAL TEXTING: Emojis allowed (🙂, 👍).
    2. LENGTH: Under 160 chars.
    3. LINKS: You can send "hivericks.com".
    `,
    
    EMAIL_REPLY: `
    MODE: EMAIL.
    CRITICAL RULES:
    1. STRUCTURE: Salutation -> Hook -> Value -> Close.
    2. TONE: Persuasive and structured.
    `
};

// Optimization: Dynamic Memory Slicing
function formatMemory(memory, mode) {
  if (!memory || !memory.history || memory.history.length === 0) return "";
  
  // Voice: Only read last 1 message (Speed). SMS: Read last 5 (Context).
  const limit = mode === 'VOICE_CALL' ? 1 : 5;
  const recent = memory.history.slice(-limit).map(m => `[${m.type}] ${m.content}`).join("\n");
  
  return `\nRECENT HISTORY:\n${recent}`;
}

async function generateResponse({ userMessage, memory = {}, mode = 'SMS_CHAT' }) {
  try {
    const rules = CHANNEL_RULES[mode] || CHANNEL_RULES.SMS_CHAT;

    // Combine everything into one efficient system prompt
    const systemContent = `
    ${SALES_CORE}
    
    KNOWLEDGE BASE: ${PRODUCT_FACTS.substring(0, 500)}
    
    CURRENT SITUATION:
    ${rules}
    ${formatMemory(memory, mode)}
    `;

    // CONFIG FOR SPEED VS INTELLIGENCE
    const isVoice = mode === 'VOICE_CALL';
    const payload = {
      model: MODEL,
      messages: [
        { role: 'system', content: systemContent },
        { role: 'user', content: sanitize(userMessage) }
      ],
      stream: false,
      options: {
        temperature: 0.6, // Balanced creativity
        
        // CRITICAL: Voice gets less RAM (faster), SMS gets more RAM (smarter)
        num_ctx: isVoice ? 1024 : 4096, 
        
        // CRITICAL: Voice stops speaking early (short answers)
        num_predict: isVoice ? 50 : 300,
        
        stop: ["<|eot_id|>", "User:", "Assistant:", "\n\n"]
      }
    };

    console.log(`   🧠 Agent Thinking (${mode})...`);
    const start = Date.now();
    
    // Voice timeout is tighter (8s) than SMS (30s)
    const res = await axios.post(OLLAMA_URL, payload, { timeout: isVoice ? 8000 : 30000 });
    
    if (isVoice) console.log(`   ⚡ Speed: ${Date.now() - start}ms`);

    let aiText = res.data?.message?.content || 'I didn\'t catch that.';
    
    // Cleanup artifacts
    return String(aiText)
      .replace(/<\|.*?\|>/g, "")
      .replace(/["*]/g, "") // Remove Markdown for voice
      .trim();

  } catch (err) {
    console.error('   ❌ Agent Error:', err.message);
    if (mode === 'VOICE_CALL') return "I'm having trouble hearing you. Can you say that again?";
    return "I'm having a bit of trouble connecting. Could you repeat that?";
  }
}

module.exports = { generateResponse };
*/
"use strict";