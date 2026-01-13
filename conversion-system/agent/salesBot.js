const axios = require("axios");
const fs = require("fs");
const path = require("path");
const { OLLAMA_URL, MODEL } = require("./config");
const { sanitize } = require("./utils");

/* ---------------- CONFIG & DATA ---------------- */
/* ---------------- CONFIG & DATA ---------------- */
let PRODUCT_KNOWLEDGE = `
PRODUCT: XOptimus Smart Charger (Wall Adapter)
PRICE: ₹1499 INR (approx $18 USD).
KEY FEATURES:
- Advanced Surge Protection: Prevents voltage spikes.
- Battery Health Preservation: Unlike cheap chargers, XOptimus regulates current to extend Li-Ion battery lifespan.
- Smart Cut-off: Stops charging when full to prevent overheating.
- Universal Compatibility: Works with all USB-C devices (Android & iPhone).
COMPETITOR COMPARISON:
- Generic Chargers (₹300-500): Lack safety chips, cause micro-cycles that degrade battery health by 15-20% per year.
- XOptimus: Pays for itself by saving your phone's battery.
`;
const FACTS_PATH = path.join(__dirname, "data", "sample_product_facts.txt");
if (fs.existsSync(FACTS_PATH)) {
  PRODUCT_KNOWLEDGE = fs.readFileSync(FACTS_PATH, "utf8").trim();
} // DISABLED: Using Hardcoded Truth for Stability

/* ---------------- THE SALES BRAIN (INTENT-BASED) ---------------- */
const SALES_IDENTITY = `
You are Vijay, a Senior Consultant at Hivericks.
PRODUCT: XOptimus Smart Charger (Price: ₹1499)
IDENTITY: Persuasive, Logic-Driven, and Unyielding on Value.
SALES TACTICS (MANDATORY):
1. THE "TRUTH DETECTOR": If user is skeptical, DO NOT ARGUE. Validate first ("Totally fair to ask that"), then explain value.
2. THE "PIVOT": If user says "Too expensive", say "I get that. But think about the battery life it saves."
3. THE "DISARM": If user says "Not interested", ask gently: "Is it the price or just bad timing?"
4. THE "ASSUMED CLOSE": When they show interest, don't ask "Do you want info?". Say "I'll send the details to WhatsApp, okay?"
STYLE:
- Professional but debate-ready.
- Use "Courtroom Logic": Accept the user's premise ("Yes, they are cheaper"), then destroy the conclusion with a higher value fact ("But they damage your battery").
- NEVER refuse to answer. NEVER say "I cannot assist".
- Be concise.
`;

/* ---------------- HYBRID ROUTER (CODE-LEVEL LOGIC) ---------------- */
// Fast, Regex-based intent detection to guide the AI
const detectIntent = (msg, mode) => {
  const m = msg.toLowerCase();
  const isVoice = mode === 'VOICE_CALL';

  // 1. COMPLEXITY / SCHEDULE REQUEST
  // VOID in Voice Call unless specific "schedule later" phrasing
  if (!isVoice && ((m.includes("call") && (m.includes("schedule") || m.includes("discuss") || m.includes("later"))) || m.includes("number"))) {
    return {
      type: "SCHEDULE_REQUEST",
      instruction: "USER WANTS TO DISCUSS ON CALL.\nACTION: Agree enthusiastically. Ask for their preferred time for a 'Clarification Call'. Do NOT pitch product details in text."
    };
  }

  // 2. IMMEDIATE CALL (Escalation) -> ONLY FOR TEXT CHANNELS
  if (!isVoice && m.includes("call") && (m.includes("now") || m.includes("immediately") || m.includes("ready"))) {
    return {
      type: "IMMEDIATE_CALL",
      instruction: "USER WANTS CALL NOW.\nACTION: Say 'Available now! Calling you in 10 seconds...'."
    };
  }

  // 3. ALREADY ON CALL (Voice Specific Loop Breaker)
  if (isVoice && (m.includes("already on") || (m.includes("on") && m.includes("call")))) {
    return {
      type: "ALREADY_ON_CALL",
      instruction: "USER REMINDING THEY ARE ALREADY ON THE CALL.\nACTION: Acknowledge 'Yes, I am listening' and answer their previous question immediately."
    };
  }

  if (m.includes("cheaper") || m.includes("lower") || (m.includes("website") && m.includes("price")) || m.includes("other") || m.includes("amazon")) {
    return {
      type: "COMPETITOR_OBJECTION",
      instruction: "USER COMPARING WITH CHEAP COMPETITORS.\nACTION: ARGUE VALUE via COURTROOM LOGIC.\n1. Admit they are cheaper.\n2. Argue: 'Cheap chargers lack surge protection and degrade battery health by 20% in a year.'\n3. Ask: 'Is saving ₹500 worth risking your ₹1 Lakh phone?'"
    };
  }

  if (m.includes("expensive") || m.includes("high") || (m.includes("price") && m.includes("too"))) {
    return {
      type: "PRICE_OBJECTION",
      instruction: "USER OBJECTING TO PRICE.\nACTION: VALIDATE & PIVOT.\n1. Acknowledge briefly ('It is premium, yes.').\n2. Mention long-term battery savings (₹50k value in phone life).\n3. Re-state price ₹1499 is an investment, not a cost."
    };
  }

  if (m.includes("usd") || m.includes("dollar") || m.includes("$") || m.includes("convert")) {
    return {
      type: "PRICE_CURRENCY_CONVERSION",
      instruction: "USER WANTS USD PRICE. \nOVERRIDE DEFAULT PRICE. \nDO NOT QUOTE INR ONLY.\nACTION: Say 'The price is approx $18 USD (₹1499 INR).'"
    };
  }

  if (m.includes("price") && (m.includes("what") || m.includes("tell") || m.includes("give"))) {
    return {
      type: "PRICE_QUESTION",
      instruction: "USER ASKING PRICE.\nACTION: Answer ₹1499. Then ask: 'Should we discuss how it fits your usage?'"
    };
  }

  if (m.includes("who are you") || m.includes("call me") || m.includes("waited") || m.includes("random") || m.includes("what?") || m.includes("throwing")) {
    return {
      type: "CONFUSION",
      instruction: "USER IS CONFUSED.\nACTION: DE-ESCALATE.\n1. 'Apologies, I am Vijay from Hivericks.'\n2. 'Is this a good time?'"
    };
  }

  if (m.includes("not interested") || m.includes("busy") || m.includes("don't want")) {
    return {
      type: "DISINTEREST",
      instruction: "USER NOT INTERESTED.\nACTION: Say: 'No problem. Have a great day.'\nAPPEND: '[HANGUP]'" // Signal for system
    };
  }

  if (m.includes("hang up") || m.includes("bye") || /\bend\b/i.test(m)) {
    return {
      type: "HANGUP_REQUEST",
      instruction: "USER WANTS TO END.\nACTION: Say 'Goodbye'.\nAPPEND: '[HANGUP]'"
    };
  }

  // 4. PURCHASE INTENT / EARLY ACCEPTANCE
  // Detects: "buy", "purchase", "send bank details", "ready to pay"
  // REMOVED: generic "details" (triggered by "product details")
  if (m.includes("buy") || m.includes("purchase") || m.includes("ready to pay") || m.includes("price is fine") || (m.includes("details") && (m.includes("bank") || m.includes("pay") || m.includes("account")))) {
    return {
      type: "PURCHASE_INTENT",
      instruction: "USER WANTS TO BUY. \nACTION: Congratulate them. \nTell them a Human Specialist will call them shortly to finalize the order. \nSay: 'Great choice! I have marked your order. A specialist will call you shortly to wrap this up.'"
    };
  }

  return null; // Default: Proceed with normal flow
};

/* ---------------- CHANNEL MODES ---------------- */
const CHANNEL_RULES = {
  VOICE_CALL: `
  *** MODE: VOICE CALL (SPEED CRITICAL) ***
  - LENGTH: MAX 1 sentence (approx 15 words).
  - STYLE: Fast, casual, punchy.
  - LOGIC: LOGIC-FIRST. If challenged, hit back with facts. Do not be submissive.
  - CONTEXT: YOU ARE CURRENTLY ON THE PHONE WITH THE USER. DO NOT SUGGEST A CALL.
  `,
  SMS_CHAT: `
  *** MODE: WHATSAPP/SMS ***
  - LENGTH: Short text (under 160 chars).
  - STYLE: Professional but friendly.
  - STRATEGY: If query is complex, suggest a 'Clarification Call'.
  `,
  EMAIL_REPLY: `
  *** MODE: EMAIL ***
  - Structured, Persuasive, & Detailed.
  - LENGTH: Sufficient to explain product specs fully. Do not be artificially brief.
  - CONTEXT RULE: You have access to previous history (SMS/Voice). USE it to be informed, but DO NOT reference the distinct channel.
  - STRATEGY: Provide value. If specifications are asked, list them clearly.
  `
};

/* ---------------- CONTEXT BUILDER ---------------- */
function buildContext(memory = {}, mode) {
  const depth = mode === 'VOICE_CALL' ? 5 : 8;
  const recentHistory = (memory.history || [])
    .slice(-depth)
    .map(m => `${m.type}: ${m.content}`)
    .filter(line => !line.includes('system:') && !line.includes('CALL START') && !line.includes('CALL END'))
    .join("\n");

  if (!recentHistory) return "Conversation Start.";
  return `\nRECENT CONVERSATION:\n${recentHistory}`;
}

/* ---------------- LLM CALLER ---------------- */
async function callLLM(systemPrompt, userMessage, isVoice, jsonMode = false) {
  console.log("   📝 LLM PROMPT (USER MSG):", JSON.stringify(userMessage));
  const payload = {
    model: MODEL,
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: sanitize(userMessage) }
    ],
    stream: false,
    format: jsonMode ? "json" : undefined,
    options: {
      temperature: 0.6,
      num_ctx: isVoice ? 1024 : 4096,
      num_predict: isVoice ? 60 : 600,
      stop: ["User:", "Assistant:", "\n\n"]
    }
  };

  // CRITICAL: Reduced timeout for voice calls - must be LESS than outer timeout (3s)
  // Set to 2.5s to ensure it fails before the Promise.race timeout in call_server.js
  const timeoutMs = isVoice ? 10000 : 30000;

  // #region agent log
  const llmRequestStart = Date.now();
  fetch('http://127.0.0.1:7242/ingest/9a7cfcbb-92ab-4e23-8e2c-dd5be07531c4', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ location: 'salesBot.js:139', message: 'OLLAMA_REQUEST_START', data: { isVoice, timeoutMs, model: MODEL, requestStart: llmRequestStart }, timestamp: llmRequestStart, sessionId: 'debug-session', runId: 'run1', hypothesisId: 'A' }) }).catch(() => { });
  // #endregion

  try {
    const start = Date.now();
    const res = await axios.post(OLLAMA_URL, payload, { timeout: timeoutMs });
    const duration = Date.now() - start;

    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/9a7cfcbb-92ab-4e23-8e2c-dd5be07531c4', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ location: 'salesBot.js:143', message: 'OLLAMA_REQUEST_COMPLETE', data: { duration, isVoice, responseReceived: !!res.data }, timestamp: Date.now(), sessionId: 'debug-session', runId: 'run1', hypothesisId: 'A' }) }).catch(() => { });
    // #endregion

    if (isVoice) console.log(`   ⚡ AI Speed: ${duration}ms`);
    let text = String(res.data?.message?.content || "I didn't catch that.");
    return text.replace(/<\|.*?\|>/g, "").replace(/\*/g, "").replace(/"/g, "").trim();
  } catch (err) {
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/9a7cfcbb-92ab-4e23-8e2c-dd5be07531c4', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ location: 'salesBot.js:147', message: 'OLLAMA_REQUEST_ERROR', data: { error: err.message, isVoice, timeout: err.code === 'ECONNABORTED' }, timestamp: Date.now(), sessionId: 'debug-session', runId: 'run1', hypothesisId: 'A' }) }).catch(() => { });
    // #endregion

    console.error("   ❌ LLM Error:", err.message);
    return isVoice ? "I'm having trouble hearing you." : "Connection error.";
  }
}

/* ---------------- SYSTEM LOGGING ---------------- */
const LOG_FILE = path.join(__dirname, 'sales_bot_logs.json');

const logSystemInteraction = (input, output, context) => {
  const logs = fs.existsSync(LOG_FILE) ? JSON.parse(fs.readFileSync(LOG_FILE, 'utf8')) : [];
  logs.push({
    type: 'SYSTEM_HANDSHAKE',
    timestamp: new Date().toISOString(),
    input,
    output,
    context
  });
  fs.writeFileSync(LOG_FILE, JSON.stringify(logs, null, 2));
};

/* ---------------- MAIN EXPORT ---------------- */
async function generateResponse({ userMessage, memory = {}, mode = 'SMS_CHAT' }) {

  // 1. SYSTEM HANDSHAKE (PRE-WARM)
  if (userMessage === "SYSTEM_PREWARM_CONTEXT") {
    await callLLM("SYSTEM WARMUP", "Hello", true);
    console.log("   🤖 SalesBot: Model Forced into Memory.");
    return "I AM READY";
  }

  const channelInstructions = CHANNEL_RULES[mode] || CHANNEL_RULES.SMS_CHAT;
  const isVoice = mode === 'VOICE_CALL';

  // 2. DETECT INTENT (The "Router" Logic)
  const detectedIntent = detectIntent(userMessage, mode);

  let dynamicInstruction = "";
  if (detectedIntent) {
    console.log(`   🧭 ROUTER: Detected Intent [${detectedIntent.type}] -> Injecting Override.`);
    dynamicInstruction = `
      *** CRITICAL OVERRIDE INSTRUCTIONS ***
      ${detectedIntent.instruction}
      **************************************
      `;
  }

  // 3. CONSTRUCT THE "BRAIN" PROMPT
  // Inject Summary Context into System Prompt (Background Knowledge)
  const backgroundContext = memory.summaryContext ? `\nPREVIOUS INTERACTION SUMMARY:\n${memory.summaryContext}\n` : "";

  const systemPrompt = `
  ${SALES_IDENTITY}

  PRODUCT INFO (Reference Only):
  ${PRODUCT_KNOWLEDGE}

  channel_instructions:
  ${channelInstructions}

  ${backgroundContext}

  context:
  ${buildContext(memory, mode)}

  ${dynamicInstruction}
  `;

  console.log(`   🧠 Vijay Thinking (${mode})...`);

  // 4. EXECUTE
  return await callLLM(systemPrompt, userMessage, isVoice);
}

/* ---------------- WARMUP UTILITY ---------------- */
async function warmup() {
  console.log("   🔥 System: Warming up SalesBot...");
  // Force load with a dummy request
  await callLLM("SYSTEM_WARMUP", "Hello", true);
  console.log("   ✅ System: SalesBot Warm.");
}

/* ---------------- SUMMARIZATION ENGINE ---------------- */
async function generateStructuredSummary(transcript) {
  console.log("   🔍 DEBUG: Using Robust Parser v2 in generateStructuredSummary");
  const systemPrompt = `
  You are an expert Sales Analyst.
  Analyze the following conversation TRANSCRIPT.
  Return ONLY a raw JSON object summarizing the call.
  
  CRITICAL: You must use DOUBLE QUOTES for ALL KEYS and ALL STRINGS. Do not use single quotes. Do not omit quotes.
  
  STRICT OUTPUT FORMAT (JSON):
  {
    "interest_level": "high" | "medium" | "low" | "unknown",
    "user_intent": "snake_case_intent_code",
    "objections": "key objections or null",
    "next_action": "recommended next step",
    "conversation_summary": "REQUIRED. A minimum of 2 complete sentences summarizing the conversation naturally."
  }
  `;

  try {
    // 1. Call LLM with JSON Mode
    const response = await callLLM(systemPrompt, transcript, false, true);
    console.log(`      🤖 RAW SUMMARY RESPONSE: ${response}`);

    if (!response || typeof response !== 'string') {
      throw new Error("Empty or invalid response from LLM");
    }

    // 2. Parse (with Retry/Repair/Extraction)
    try {
      return JSON.parse(response);
    } catch (parseErr) {
      console.log("      ⚠️ Invalid JSON. Attempting Robust Extraction (Regex Mode)...");

      // Strategy: Regex match for each known field
      const extractField = (key, type = 'string') => {
        try {
          const regex = new RegExp(`(?:["']?${key}["']?\\s*:\\s*)([^,]+?)(?:\\s*,\\s*["']?[a-z_]+["']?\\s*:|\\s*})`, 'i');
          const match = response.match(regex);
          if (!match) return null;

          let val = match[1].trim();
          // Remove surrounding quotes if present
          if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
            val = val.slice(1, -1);
          }
          // Remove lingering braces if regex overshot
          val = val.replace(/}+$/, '').trim();

          if (type === 'null' && (val === 'null' || val === 'undefined')) return null;
          return val;
        } catch (e) { return null; }
      };

      const structured = {
        interest_level: extractField('interest_level') || "unknown",
        user_intent: extractField('user_intent') || "manual_review",
        objections: extractField('objections', 'null'),
        next_action: extractField('next_action') || "check",
        conversation_summary: extractField('conversation_summary')
      };

      // Fallback for summary
      if (!structured.conversation_summary) {
        try {
          const summaryMatch = response.match(/conversation_summary["']?\s*:\s*(["']?[\s\S]*[^}])/i);
          if (summaryMatch) {
            let s = summaryMatch[1].trim();
            s = s.replace(/\s*}$/, '');
            if ((s.startsWith('"') && s.endsWith('"')) || (s.startsWith("'") && s.endsWith("'"))) {
              s = s.slice(1, -1);
            }
            structured.conversation_summary = s;
          } else {
            structured.conversation_summary = "Summary extraction failed.";
          }
        } catch (e) { structured.conversation_summary = "Extraction Logic Failed"; }
      }

      console.log("      ✅ Robost Extraction Result:", JSON.stringify(structured));
      return structured;
    }
  } catch (e) {
    console.error("   ❌ Summary Generation Failed:", e);
    return {
      interest_level: "unknown",
      user_intent: "error_parsing",
      objections: "unknown",
      next_action: "manual_review",
      conversation_summary: "Summary generation failed."
    };
  }
}

async function warmup() {
  // Enhanced warmup: Use actual voice call configuration to properly load model
  console.log("   🔥 System: Warming up SalesBot with voice call configuration...");

  // Check Ollama connection first
  try {
    await axios.get(OLLAMA_URL.replace('/api/chat', '/api/tags'), { timeout: 30000 });
    console.log("   ✅ Ollama connection verified.");
  } catch (connErr) {
    console.error("   ❌ WARNING: Cannot connect to Ollama. Is it running?", connErr.message);
    console.log("   ⚠️ Warmup skipped. First call may be slow.");
    return; // Don't fail startup if Ollama is not ready
  }

  // Warm up with a realistic voice call scenario to ensure full context is loaded
  const warmupPrompt = "Hi, I'm interested in learning more.";
  try {
    const response = await generateResponse({
      userMessage: warmupPrompt,
      memory: { history: [], summaryContext: null },
      mode: "VOICE_CALL"
    });
    if (response && response.length > 0) {
      console.log("   ✅ System: SalesBot warm with voice configuration.");
    } else {
      throw new Error("Empty response from warmup");
    }
  } catch (e) {
    // Fallback to simple warmup if full warmup fails
    console.log(`   ⚠️ Full warmup failed (${e.message}), trying simple warmup...`);
    try {
      await callLLM("SYSTEM WARMUP", "Hello", true);
      console.log("   ✅ System: SalesBot warm (simple mode).");
    } catch (simpleErr) {
      console.error("   ❌ Simple warmup also failed:", simpleErr.message);
      console.log("   ⚠️ Model may not be loaded. First call will be slower.");
    }
  }
}

async function generateTextSummary(transcript) {
  const prompt = `
  You are an expert Sales Analyst.
  Read the following conversation transcript between an ASSISTANT and a USER.
  
  TASK:
  Write a STRICTLY CONCISE summary (Max 2 sentences).
  - Sentence 1: Clearly state the user's specific product interest and current sentiment (Hot/Warm/Cold).
  - Sentence 2: State the final outcome of the call and the immediate next step.
  - No fluff. No meta-context (e.g., "The user contacted..."). Jump straight to facts.
  `;

  try {
    const response = await callLLM(prompt, transcript, false, false);
    return response.trim().replace(/^"|"$/g, ''); // Clean quotes if any
  } catch (e) {
    console.error("   ❌ Text Summary Failed:", e);
    return "Summary unavailable.";
  }
}

async function generateFinalSummary(allSummaries) {
  const prompt = `
  Analyze this timeline of interaction summaries:
  ${JSON.stringify(allSummaries)}

  Generate a MASTER SUMMARY of the lead's journey so far.
  - Current status?
  - Main objections?
  - Next recommended step?
  RETURN JSON: { "lead_status": "...", "confidence_level": "...", "key_interests": [], "main_objections": [], "recommended_next_step": "..." }
  `;

  try {
    const response = await callLLM(prompt, "History Analysis", false, true);
    return JSON.parse(response);
  } catch (e) {
    return { lead_status: "UNKNOWN", confidence_level: "low", key_interests: [], main_objections: [], recommended_next_step: "manual_review" };
  }
}

async function generateFeedbackRequest(summaryText, mode = 'SMS') {
  const isEmail = mode === 'EMAIL';

  const systemPrompt = `
  You are an expert Sales Communication AI.
  Your task is to draft a follow-up message for a client based on a call summary.
  
  MODE: ${isEmail ? 'FORMAL EMAIL' : 'SMS/WHATSAPP'}
  
  ${isEmail ? `
  EMAIL STRUCTURE:
  1. Subject: Summary of Discussion
  2. Salutation: "Dear Customer,"
  3. Body:
     - "As per our discussion regarding [Key Topic]..."
     - Recap value.
  4. Closing: "Best Regards, Vijay, Senior Consultant, Hivericks."
  
  CONSTRAINTS:
  - Do NOT include placeholders like [Subject]. Fill them based on summary.
  - Tone: Professional, Consultant-like.
  ` : `
  SMS STRUCTURE:
  - Max 25 words.
  - Casual but professional.
  `}
  
  CRITICAL OUTPUT RULES:
  - RETURN ONLY THE FINAL MESSAGE TEXT.
  - DO NOT start with "Here is the email", "Here is the message", or "Subject:".
  - DO NOT include conversational filler or meta-commentary.
  - START DIRECTLY with the body content (e.g., "Hi [Name], ...").
  - JUST the message body.
  `;

  try {
    // Pass strictly: System (Rules) -> User (Content to process)
    return await callLLM(systemPrompt, `SUMMARY TO PROCESS:\n"${summaryText}"`, false, false);
  } catch (e) {
    return isEmail ? "Thank you for speaking with us. Please let us know if you have further questions." : "Thanks for the call! Let us know if you have any questions.";
  }
}

module.exports = {
  detectIntent,
  generateResponse,
  warmup,
  generateStructuredSummary,
  generateTextSummary,
  generateFinalSummary,
  generateFeedbackRequest
};

