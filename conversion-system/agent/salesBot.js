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
async function callLLM(systemPrompt, userMessage, isVoice, jsonMode = false, enableTools = true) {
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
    tools: (tools.length > 0 && enableTools) ? tools : undefined,
    options: {
      temperature: 0.6,
      num_ctx: isVoice ? 2048 : 4096,
      num_predict: isVoice ? 60 : 600,
      stop: ["User:", "Assistant:"]
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
  console.log("   🔍 DEBUG: Using Robust Parser v3 (Surgical) in generateStructuredSummary");
  const systemPrompt = `
You are a Senior Sales Intelligence Engine.

INPUT: A raw call transcript.
OUTPUT: ONLY a valid JSON object. No prose. No explanations.

RULES:
- Be factual, not polite.
- Infer intent conservatively.
- If information is missing, use null or "unknown".
- Do NOT exceed requested length limits.

RETURN THIS EXACT JSON STRUCTURE:
{
  "interest_level": "high" | "medium" | "low" | "unknown",
  "user_intent": "snake_case_sales_intent",
  "objections": "short phrase or null",
  "next_action": "single concrete action",
  "conversation_summary": "Max 35 words. Exactly 2 sentences. No filler."
}

DEFINITIONS:
- interest_level:
  high = explicit buying signals or urgency
  medium = curiosity or evaluation
  low = vague interest or disengaged
- user_intent examples:
  request_pricing, request_demo, comparison, follow_up_later, not_interested
  `;

  try {
    // 1. Call LLM with JSON Mode
    const response = await callLLM(systemPrompt, transcript, false, true, false);
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
You generate SALES-READY summaries for internal teams.

INPUT: Assistant–User call transcript.

OUTPUT RULES:
- EXACTLY 2 sentences.
- Max 25 words total.
- No greetings. No background. No meta language.
- Start immediately with the user's intent.

FORMAT:
Sentence 1: User interest + sentiment (Hot/Warm/Cold).
Sentence 2: Call outcome + next step.

EXAMPLES:
"Interested in enterprise CRM pricing, Warm. Requested demo link; follow-up scheduled tomorrow."
"Evaluated basic plan features, Cold. No commitment; re-engage next quarter."

TRANSCRIPT:
${transcript}
  `;

  try {
    const response = await callLLM(prompt, transcript, false, false, false);
    // STRICT CLEANING: Remove "Here is...", quotes, and leading newlines
    let clean = response.trim().replace(/^"|"$/g, '');
    clean = clean.replace(/^Here is (the|a) (summary|generated).*/i, '').trim();
    if (clean.includes(":")) clean = clean.split(":").pop().trim(); // Remove "Summary:" label if present
    return clean;
  } catch (e) {
    console.error("   ❌ Text Summary Failed:", e);
    return "Summary unavailable.";
  }
}

async function generateFinalSummary(allSummaries) {
  const prompt = `
You are aggregating a sales lead history.

INPUT: Chronological interaction summaries (JSON array).

TASK:
Condense the entire history into a single decision snapshot.
Focus on CURRENT state only.

OUTPUT: ONLY valid JSON.

RETURN THIS STRUCTURE:
{
  "lead_status": "new" | "engaged" | "qualified" | "stalled" | "lost",
  "confidence_level": "high" | "medium" | "low",
  "key_interests": ["concise noun phrases"],
  "main_objections": ["concise noun phrases"],
  "recommended_next_step": "single concrete action"
}

RULES:
- Do NOT repeat old details unless still relevant.
- Max 5 words per array item.
- If uncertain, downgrade confidence.

INPUT DATA:
${JSON.stringify(allSummaries)}
  `;

  try {
    const response = await callLLM(prompt, "History Analysis", false, true, false);
    return JSON.parse(response);
  } catch (e) {
    return { lead_status: "UNKNOWN", confidence_level: "low", key_interests: [], main_objections: [], recommended_next_step: "manual_review" };
  }
}

async function generateFeedbackRequest(summaryText, mode = 'SMS', leadName = "Customer", attemptCount = 0) {
  const isEmail = mode === 'EMAIL';

  // Dynamic Context & Example
  let contextType = "GENERAL FOLLOW-UP";
  let contextInstruction = "Write a professional follow-up based on the previous interaction.";
  let dynamicExample = "";

  if (!summaryText || summaryText.includes("previous attempts")) {
    if (attemptCount <= 2) {
      contextType = "INITIAL OUTREACH (COLD)";
      contextInstruction = "This is a FIRST-TIME introductions. You are reaching out to a new prospect. Introduce XOptimus charging solutions. DO NOT say 'follow up' or 'previous conversation'.";
      dynamicExample = `
### REFERENCE EXAMPLE (COLD / INTRO) ###
Subject: Optimizing your EV Fleet costs
Dear [Prospect Name],

We noticed your company is expanding its logistics fleet and wanted to introduce XOptimus.

Our smart charging technology typically reduces battery degradation by 15% and cuts energy costs. Are you open to a brief chat about your current charging infrastructure?

Best regards,
Vijay
Hivericks Team
### END EXAMPLE ###`;
    } else {
      contextType = "PERSISTENT FOLLOW-UP";
      contextInstruction = "We have tried to reach this lead multiple times. politely ask if they are still interested.";
      dynamicExample = `
### REFERENCE EXAMPLE (FOLLOW-UP) ###
Subject: Re: Our previous discussion on EV Chargers
Dear [Client Name],

I am writing to follow up on my previous note. We are still holding the bulk pricing quote for you.

Do you have any questions I can answer before you make a decision?

Best regards,
Vijay
Hivericks Team
### END EXAMPLE ###`;
    }
  } else {
    // WARM LEAD WITH SUMMARY
    contextType = "CONTEXTUAL REPLY";
    contextInstruction = "Reply to the specific points in the summary. Handle objections or provide requested info.";
    dynamicExample = `
### REFERENCE EXAMPLE (CONTEXTUAL) ###
Subject: XOptimus Specs and Pricing
Dear [Client Name],

Thank you for the call earlier.

Regarding your question about heat management: Yes, our chargers use active thermal regulation to keep battery temps under 40°C.

I have attached the spec sheet below. Let me know if this works for your team.

Best regards,
Vijay
Hivericks Team
### END EXAMPLE ###`;
  }

  const systemPrompt = `
You are a B2B Sales Operations Assistant writing client-facing messages.

TO: ${leadName}
CONTEXT_TYPE: ${contextType}
INSTRUCTION: ${contextInstruction}

PRODUCT CONTEXT:
${PRODUCT_KNOWLEDGE}

${dynamicExample}
MODE: ${isEmail ? 'FORMAL EMAIL' : 'SMS / WHATSAPP'}

ABSOLUTE RULES:
- DO NOT mention systems, templates, platforms, tools, or technical limitations.
- DO NOT explain what you are doing.
- DO NOT include placeholders or commentary.
- Output ONLY the final message content.
- CRITICAL: You MUST include a "Subject:" line for emails.
- CRITICAL: You MUST include a salutation like "Dear <Name>," or "Hi <Name>," immediately after the Subject.
- CRITICAL: DO NOT start with "Here is...", "Subject: ...", or repeat the user command. Start directly with the "Subject:".
If sufficient details are unavailable, write a neutral professional follow-up requesting clarification.
DO NOT explain limitations or tools.

${isEmail ? `
EMAIL REQUIREMENTS:
- Tone: Professional, formal, concise.
- Audience: Business client.
- Grammar must be corporate-grade.

### STYLE GUIDE (STRICT TEMPLATE) ###
Subject: <Write a subject relevant to the context>

Dear <Lead Name>,

<Opening: Polite and context-aware (Intro or Follow-up)>

<Body: Value proposition or specific question>

<Closing: Professional sign-off>
Best regards,
Vijay
Hivericks Team

### END STYLE GUIDE ###

EMAIL FORMAT (STRICT):
Dear <Customer>,

<2–3 short paragraphs>
- Paragraph 1: Polite opening + reference to discussion.
- Paragraph 2: Value recap or outcome from the call.
- Paragraph 3: Clear next step or action request.

Closing line (professional):
"Kind regards,"

<Company / Team Name>
` : `
SMS REQUIREMENTS:
- Tone: Polite, concise, professional.
- Max 2 sentences.
- No emojis.
- No greetings beyond one short line.
`}

INPUT SUMMARY:
"${summaryText}"
  `;

  return await callLLM(
    systemPrompt,
    `SYSTEM_COMMAND: GENERATE_BODY_ONLY`,
    false,
    false,
    false
  );
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
