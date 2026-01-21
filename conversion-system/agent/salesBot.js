const axios = require("axios");
const fs = require("fs");
const path = require("path");
const { OLLAMA_URL, MODEL } = require("./config");
const { sanitize } = require("./utils");
const { initializeMCP, getMCPTools, executeMCPTool } = require("./mcp_manager");
const { logSystem } = require("../utils/logger");
const events = require("events");

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
}

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
// Keeping Regex as fallback and for tactical moves (Pivot/Disarm)
const detectIntent = (msg, mode) => {
  const m = msg.toLowerCase();
  const isVoice = mode === 'VOICE_CALL';

  if (!isVoice && ((m.includes("call") && (m.includes("schedule") || m.includes("discuss") || m.includes("later"))) || m.includes("number"))) {
    return { type: "SCHEDULE_REQUEST", instruction: "User wants to schedule. Use schedule_call tool if avail." };
  }
  if (!isVoice && m.includes("call") && (m.includes("now") || m.includes("immediately") || m.includes("ready"))) {
    return { type: "IMMEDIATE_CALL", instruction: "User wants immediate call. Use trigger_voice_call tool." };
  }
  if (isVoice && (m.includes("already on") || (m.includes("on") && m.includes("call")))) {
    return { type: "ALREADY_ON_CALL", instruction: "Acknowledge call state." };
  }
  if (m.includes("cheaper") || m.includes("lower") || m.includes("amazon")) {
    return { type: "COMPETITOR_OBJECTION", instruction: "Use Courtroom Logic to destroy competitor argument." };
  }
  if (m.includes("expensive") || m.includes("too")) {
    return { type: "PRICE_OBJECTION", instruction: "Pivot to battery savings." };
  }
  if (m.includes("buy") || m.includes("purchase")) {
    return { type: "PURCHASE_INTENT", instruction: "Use escalate_to_human tool to pass to specialist." };
  }
  return null;
};

/* ---------------- CHANNEL MODES ---------------- */
const CHANNEL_RULES = {
  VOICE_CALL: `
  *** MODE: VOICE CALL (SPEED CRITICAL) ***
  - LENGTH: MAX 1 sentence (approx 15 words).
  - STYLE: Fast, casual, punchy.
  - CONTEXT: YOU ARE CURRENTLY ON THE PHONE WITH THE USER.
  `,
  SMS_CHAT: `
  *** MODE: WHATSAPP/SMS ***
  - LENGTH: Short text (under 160 chars).
  - STYLE: Professional but friendly.
  - STRATEGY: Use Tools to Schedule/Call if requested.
  `,
  EMAIL_REPLY: `
  *** MODE: EMAIL ***
  - Structured, Persuasive, & Detailed.
  - LENGTH: Sufficient to explain product specs fully.
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
  return recentHistory ? `\nRECENT CONVERSATION:\n${recentHistory}` : "Conversation Start.";
}

/* ---------------- LLM CALLER (MCP ENABLED) ---------------- */
async function callLLM(systemPrompt, userMessage, isVoice, jsonMode = false) {
  console.log("   📝 LLM PROMPT (USER MSG):", JSON.stringify(userMessage));

  const tools = getMCPTools();
  console.log(`   🐛 DEBUG: Tools Available for LLM: ${tools.length}`);

  const payload = {
    model: MODEL,
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: sanitize(userMessage) }
    ],
    stream: false,
    format: jsonMode ? "json" : undefined,
    // Provide Tools
    tools: tools.length > 0 ? tools : undefined,
    options: {
      temperature: 0.6,
      num_ctx: isVoice ? 2048 : 4096,
      num_predict: isVoice ? 60 : 600,
      stop: ["User:", "Assistant:", "\n\n"]
    }
  };

  const timeoutMs = isVoice ? 20000 : 30000;

  try {
    const start = Date.now();
    const res = await axios.post(OLLAMA_URL, payload, { timeout: timeoutMs });
    const duration = Date.now() - start;
    if (isVoice) console.log(`   ⚡ AI Speed: ${duration}ms`);

    const message = res.data?.message;
    if (!message) return "I didn't catch that.";

    // TOOL CALL HANDLING
    if (message.tool_calls && message.tool_calls.length > 0) {
      console.log(`   🛠️  AI Wants to use Tools: ${message.tool_calls.length}`);
      for (const tool of message.tool_calls) {
        try {
          const result = await executeMCPTool(tool.function.name, tool.function.arguments);
          payload.messages.push(message);
          payload.messages.push({ role: "tool", content: result, name: tool.function.name });
        } catch (toolErr) {
          console.error(`      ❌ Tool Execution Failed: ${toolErr.message}`);
          payload.messages.push({ role: "tool", content: `Error: ${toolErr.message}`, name: tool.function.name });
        }
      }
      // Re-prompt after tool execution
      console.log("   🔄 Re-prompting AI with Tool Results...");
      const finalRes = await axios.post(OLLAMA_URL, payload, { timeout: timeoutMs });
      let finalContent = finalRes.data?.message?.content || "Action completed.";
      return finalContent.replace(/<\|.*?\|>/g, "").replace(/\*/g, "").replace(/"/g, "").trim();

    } else {
      return String(message.content || "I didn't catch that.").replace(/<\|.*?\|>/g, "").replace(/\*/g, "").replace(/"/g, "").trim();
    }
  } catch (err) {
    console.error("   ❌ LLM Error:", err.message);
    return isVoice ? "I'm having trouble hearing you." : "Connection error.";
  }
}

/* ---------------- MAIN EXPORT ---------------- */
async function generateResponse({ userMessage, memory = {}, mode = 'SMS_CHAT', leadContext = {} }) {
  if (userMessage === "SYSTEM_PREWARM_CONTEXT") {
    await callLLM("SYSTEM WARMUP", "Hello", true);
    return "I AM READY";
  }

  const channelInstructions = CHANNEL_RULES[mode] || CHANNEL_RULES.SMS_CHAT;
  const isVoice = mode === 'VOICE_CALL';
  const detectedIntent = detectIntent(userMessage, mode);

  let dynamicInstruction = "";
  if (detectedIntent) {
    console.log(`   🧭 ROUTER: Detected Intent [${detectedIntent.type}]`);
    dynamicInstruction = `*** INTENT HINT: ${detectedIntent.instruction} ***`;
  }

  const backgroundContext = memory.summaryContext ? `\nPREVIOUS INTERACTION SUMMARY:\n${memory.summaryContext}\n` : "";
  const userContext = leadContext.phone ? `USER_CONTEXT:\nName: ${leadContext.name || 'Unknown'}\nPhone: ${leadContext.phone}` : "";

  const systemPrompt = `
  ${SALES_IDENTITY}
  ${userContext}
  
  *** TOOL USAGE RULES(CRITICAL) ***
    1. When using tools (send_sms_message, trigger_voice_call, etc.), ONLY use the exact phone number listed in USER_CONTEXT.
  2. NEVER pass descriptions(e.g. "the user") as the phone number. 
  3. If USER_CONTEXT.phone is missing, ASK the user for it first.
  4. To send SMS: Call send_sms_message("${leadContext.phone || 'ASK_USER'}", "Your message here").

  PRODUCT INFO:
  ${PRODUCT_KNOWLEDGE}
  TECHNICAL KNOWLEDGE:
  - You have access to a Documentation Library via the 'resolve-library-id' tool.
  - IF the user asks a technical question NOT in the Product Info, USE 'resolve-library-id' with arguments: { "libraryName": "xoptimus-docs", "query": "user question" }.
  - DO NOT hallucinate technical specs.
    channel_instructions:
  ${channelInstructions}
  ${backgroundContext}
  context:
  ${buildContext(memory, mode)}
  ${dynamicInstruction}
  `;

  console.log(`   🧠 Vijay Thinking(${mode})...`);
  return await callLLM(systemPrompt, userMessage, isVoice);
}

/* ---------------- UTILITIES ---------------- */
async function warmup() {
  console.log("   🔥 System: Warming up SalesBot...");

  // INIT MCP
  try {
    await initializeMCP();
  } catch (e) {
    console.warn("   ⚠️ MCP Init Failed (Is Ollama Running?):", e.message);
  }

  // FORCE MODEL LOAD
  try {
    await axios.get(OLLAMA_URL.replace('/api/chat', '/api/tags'), { timeout: 5000 });
    console.log("   ✅ Ollama connection verified.");
    await callLLM("SYSTEM WARMUP", "Hello", true);
    console.log("   ✅ System: SalesBot Warm.");
  } catch (e) {
    console.error("   ❌ Ollama/LLM Startup Failed:", e.message);
  }
}

// Keep existing Summarization functions mostly as is, they don't need Tools usually.
/* ---------------- SUMMARIZATION ENGINE ---------------- */
async function generateStructuredSummary(transcript) {
  console.log("   🔍 DEBUG: Using Robust Parser v2 in generateStructuredSummary");
  const systemPrompt = `
  You are an expert Sales Analyst.
  Analyze the following conversation TRANSCRIPT.
  Return ONLY a raw JSON object summarizing the call.

    CRITICAL: You must use DOUBLE QUOTES for ALL KEYS and ALL STRINGS.Do not use single quotes.Do not omit quotes.
  
  STRICT OUTPUT FORMAT(JSON):
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
    console.log(`      🤖 RAW SUMMARY RESPONSE: ${response} `);

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
          const regex = new RegExp(`(?: ["']?${key}["']?\\s*:\\s*)([^,]+?)(?:\\s*,\\s*["'] ? [a - z_] + ["']?\\s*:|\\s*})`, 'i');
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
    return response.trim().replace(/^"|"$/g, '');
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
    return await callLLM(systemPrompt, `SUMMARY TO PROCESS:\n"${summaryText}"`, false, false);
  } catch (e) {
    return isEmail ? "Thank you for speaking with us. Please let us know if you have further questions." : "Thanks for the call! Let us know if you have any questions.";
  }
}

async function generateOpening(lead) {
  const systemPrompt = `
  You are Vijay, a Senior Consultant at Hivericks.
  Your goal is to start a Voice Call with a lead.
  
  TASK:
  Generate a single, short, friendly opening sentence.
  - Mention their name if known.
  - State the purpose: Following up on their interest in XOptimus.
  - End with a simple hook like "Do you have a minute?"
  
  CONTEXT:
  Name: ${lead.name || 'there'}
  Source: ${lead.source || 'Website'}
  
  OUTPUT RULES:
  - Max 20 words.
  - Natural, spoken style.
  - NO "Subject:", NO quotes.
  - IMPORTANT: DO NOT USE ANY TOOLS. JUST GENERATE TEXT.
  `;

  try {
    return await callLLM(systemPrompt, "Generate Opening", false, false);
  } catch (e) {
    return `Hi ${lead.name || 'there'}, this is Vijay from Hivericks regarding the XOptimus charger. Do you have a minute?`;
  }
}

module.exports = {
  detectIntent,
  generateResponse,
  warmup,
  generateStructuredSummary,
  generateTextSummary,
  generateFinalSummary,
  generateFeedbackRequest,
  generateOpening
};
