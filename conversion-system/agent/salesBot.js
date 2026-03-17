const axios = require("axios");
const fs = require("fs");
const path = require("path");
const { OLLAMA_URL, MODEL } = require("./config");
const { sanitize } = require("./utils");

/* ---------------- CONSULTANT DATA ---------------- */
const PRODUCT_FACTS = {
  price: "₹1499",
  benefit: "Extends Li-Ion battery life up to 2x",
  safety: "Safe-Heat Technology, no overheating, thermal sensors",
  compat: "Compatible with gaming laptops, smartphones, 6A/12A/16A sockets",
  description: "XOptimus is a hardware charging adapter. It sits between your charger and the socket. It stops charging at 80% to protect battery health."
};

const SALES_IDENTITY_PROMPT = `
You are Vijay, a Product Consultant at Hivericks.

CONTEXT:
Live voice call. Speak naturally, like a real human.
Short, calm, conversational responses. Max 2 sentences.

PRODUCT:
XOptimus – a hardware charging adapter (₹1499).
It sits between the charger and socket, stops charging at ~80%,
prevents overcharging, reduces heat, and extends Li-Ion battery life up to 2x.
Compatible with gaming laptops, smartphones, and 6A/12A/16A sockets.

PRIMARY BEHAVIOR:
Start with normal conversation.
Talk about battery health first.
Introduce XOptimus clearly when relevant.
Do not forget to mention the product when explaining solutions.

CONVERSATION LOGIC (IMPORTANT):
- If discussing battery problems → explain the issue first, then clearly say XOptimus solves it.
- If interest is shown → explain what XOptimus is, how it works, and its benefits.
- If asked price → say “It’s ₹1499.”
- If asked “what is it?” → say it’s a hardware adapter that protects battery health.

EXIT & DEFER HANDLING (CRITICAL):
- If user says “later”, “busy”, or “call later”:
  → Acknowledge once
  → Ask: “Would it be okay if I send the product details on WhatsApp?”
  → If yes: confirm, thank them, and END the call
  → Do NOT continue selling

DISINTEREST HANDLING:
- First “not interested” → one gentle check:
  “Understood. Is it mainly the price, or just timing?”
- Second disinterest → thank them and END the call
- Never pitch after repeated disinterest

ABSOLUTE RULES:
- Never loop persuasion
- Never repeat validations
- Never explain product after exit intent
- Never sound scripted or robotic
- No greetings after the first turn

`;

class SalesBrain {
  constructor({ leadContext = {}, memory = {}, mode = 'VOICE_CALL' }) {
    this.memory = memory;
    this.history = memory.history || [];
    this.leadContext = leadContext; // Store for prompt injection
    // We minimaly track if we are at the start for greeting control
    this.isStart = this.history.length === 0;
  }

  async processTurn(userMessage) {
    const lastAssistantMsg = this.history.filter(h => h.role === 'assistant').pop()?.text || "";
    const context = this.history.slice(-6).map(h => `${h.role}: ${h.text}`).join("\n");

    // INJECT SUMMARY FROM PREVIOUS CALLS
    let summaryContext = "";
    if (this.leadContext && this.leadContext.summary) {
      summaryContext = `PREVIOUS CONVERSATION SUMMARY:\n${this.leadContext.summary}\n`;
    }

    // 1. HARD TEMPLATE OVERRIDES (For 100% reliability on exits)
    let hardResponse = null;

    if (/busy|later|meeting|call back/i.test(userMessage)) {
      hardResponse = "I understand. I'll send the details over WhatsApp now. Is there anything else I can help with, or should we hang up?";
    } else if (/yes|okay|sure|go ahead/i.test(userMessage) && /whatsapp|detail/i.test(lastAssistantMsg)) {
      hardResponse = "Great! I'll send those details right away. Before I go, is there anything else you'd like to discuss?";
    } else if (/no|nothing|that is all|that's it|bye/i.test(userMessage) && (/anything else|help with/i.test(lastAssistantMsg) || /whatsapp|detail/i.test(lastAssistantMsg))) {
      hardResponse = "Thank you for your time! Have a great day. [HANGUP]";
    }

    if (hardResponse) {
      this.history.push({ role: 'user', text: userMessage });
      this.history.push({ role: 'assistant', text: hardResponse });
      this.memory.history = this.history;
      return { response: hardResponse, stageId: 2, memory: this.memory };
    }

    // 2. INTENT OVERRIDES (For LLM processing)
    let override = "";
    if (/whatsapp|send.*details|text me/i.test(userMessage)) {
      override = `CRITICAL: Agree to send details on WhatsApp. ASK: "I'd be happy to send you the details on WhatsApp, would that work?"`;
    } else if (/price|cost|how much/i.test(userMessage)) {
      override = `CRITICAL: The Price is ${PRODUCT_FACTS.price}. Answer ONLY the price.`;
    } else if (/what.*do|function|work|what is/i.test(userMessage)) {
      override = `CRITICAL: Explain it is a hardware adapter that prevents overcharging.`;
    } else if (/heat|safety|cool|safe|fire|burn/i.test(userMessage)) {
      override = `CRITICAL: Mention Safe-Heat Technology and thermal sensors. It is 100% safe.`;
    } else if (/laptop|gaming|high end|heavy/i.test(userMessage)) {
      override = `CRITICAL: Confirm it works with high-end gaming laptops and all sockets (6A/12A/16A).`;
    }

    // Build Prompt
    let prompt = "";
    if (override) {
      prompt = `${override}\n\n${summaryContext}\nCONVERSATION SO FAR:\n${context}\nUser: ${userMessage}\n\nVijay:`;
    } else {
      prompt = `
${SALES_IDENTITY_PROMPT}

${summaryContext}

PRODUCT DATASHEET:
- Description: ${PRODUCT_FACTS.description}
- Price: ${PRODUCT_FACTS.price}
- Benefit: ${PRODUCT_FACTS.benefit}
- Compatibility: ${PRODUCT_FACTS.compat}
- Safety: ${PRODUCT_FACTS.safety}

CONVERSATION SO FAR:
${context}
User: ${userMessage}

INSTRUCTION:
Respond as Vijay. 
- ANSWER THE USER'S QUESTION DIRECTLY IN THE FIRST SENTENCE.
- DO NOT give a general battery health lecture.
- Max 15 words.

Vijay:`;
    }

    const payload = {
      model: MODEL,
      prompt: prompt,
      stream: false,
      options: {
        temperature: 0.1,
        stop: ["User:", "\n", "Vijay:"],
        num_predict: 35,
        repeat_penalty: 1.6
      }
    };

    try {
      const res = await axios.post(OLLAMA_URL.replace('/chat', '/generate'), payload);
      let content = (res.data?.response || "").trim().replace(/Vijay:|User:|Assistant:/gi, "").trim();
      content = content.replace(/^[,. ]+/, "").trim();
      content = content.replace(/^["']|["']$/g, '');

      if (!content) content = "Could you tell me more about your device usage?";

      this.history.push({ role: 'user', text: userMessage });
      this.history.push({ role: 'assistant', text: content });
      this.memory.history = this.history;

      return { response: content, stageId: 2, memory: this.memory };
    } catch (e) { return { response: "I didn't quite catch that.", stageId: 2, memory: this.memory }; }
  }

  // Deprecated usage, keeping for interface compatibility
  async determineStage(userMessage) { return 2; }
}

async function generateResponse(params) { return new SalesBrain(params).processTurn(params.userMessage); }
async function warmup() { }

async function generateStructuredSummary(history) {
  const txt = JSON.stringify(history).toLowerCase();

  // Detect intents from conversation history
  const askedPrice = txt.includes('price') || txt.includes('cost') || txt.includes('much');
  const askedDetails = txt.includes('what') || txt.includes('how') || txt.includes('details');
  const saidLater = txt.includes('later') || txt.includes('busy') || txt.includes('call back');
  const agreedWhatsApp = txt.includes('whatsapp') || txt.includes('send') || txt.includes('yes'); // Loose check for agreement in context

  let interest = "medium";
  if (saidLater) interest = "callback";
  if (askedPrice && agreedWhatsApp) interest = "high";

  return {
    interest_level: interest,
    key_topics: [askedPrice ? "price" : null, askedDetails ? "details" : null].filter(Boolean),
    next_action: saidLater ? "schedule_callback" : "send_whatsapp"
  };
}

async function generateTextSummary(history) {
  try {
    let content = history;
    if (Array.isArray(history)) {
      content = JSON.stringify(history);
    } else if (typeof history === 'object') {
      content = JSON.stringify(history);
    }

    const prompt = `Summarize this sales call transcript in 1 sentence. Start with "User was...":\n${content}`;
    const res = await axios.post(OLLAMA_URL.replace('/chat', '/generate'), { model: MODEL, prompt, stream: false }, { timeout: 5000 });
    return res.data?.response?.trim() || "User involved in discussion.";
  } catch (e) {
    console.warn("⚠️ AI Summary Failed (Ollama offline):", e.message);
    return "User was contacted for a sales follow-up regarding XOptimus battery health.";
  }
}

async function generateFinalSummary(history) {
  try {
    const structured = await generateStructuredSummary(history);

    let status = "active";
    if (structured.interest_level === "callback") status = "CALL_CALLBACK";
    else if (structured.interest_level === "high") status = "CALL_INTERESTED";
    else status = "CALL_COMPLETED";

    return { lead_status: status, analysis: structured };
  } catch (e) {
    return { lead_status: "CALL_COMPLETED", analysis: { interest_level: "medium", next_action: "send_whatsapp" } };
  }
}

async function generateFeedbackRequest(summary, mode, name) {
  try {
    // Tailor feedback based on intent (extracted from summary content loosely)
    const summaryStr = JSON.stringify(summary);
    const isCallback = /callback|busy|later/i.test(summaryStr);

    let prompt = "";
    if (isCallback) {
      prompt = `Write a short, polite WhatsApp message to ${name}.
      Context: The user was busy or asked for a callback.
      Summary: ${summaryStr}
      Product: XOptimus (??1499).
      Link: hivericks.com/xoptimus.
      
      Say: "Hi ${name}, as discussed, I'll share the XOptimus battery saver details here. Let me know when you're free to chat!" (Sign off: Vijay)`;
    } else {
      prompt = `Write a professional ${mode === 'EMAIL' ? 'Email' : 'WhatsApp'} message to ${name}.
      Context: Follow-up after a call.
      Call Summary: ${summaryStr}
      Product: XOptimus (??1499, extends battery life).
      Goal: Nudge them to buy or learn more.
      Link: hivericks.com/xoptimus.
      
      Keep it short and friendly. (Sign off: Vijay)`;
    }

    const res = await axios.post(OLLAMA_URL.replace('/chat', '/generate'), { model: MODEL, prompt: prompt, stream: false }, { timeout: 5000 });
    return res.data?.response || getDefaultFeedback(mode, name, isCallback);
  } catch (e) {
    console.warn("⚠️ AI Feedback Generation Failed (Ollama offline):", e.message);
    const summaryStr = JSON.stringify(summary);
    const isCallback = /callback|busy|later/i.test(summaryStr);
    return getDefaultFeedback(mode, name, isCallback);
  }
}

function getDefaultFeedback(mode, name, isCallback) {
  if (isCallback) {
    return `Hi ${name}, as discussed, I'll share the XOptimus battery saver details here. Let me know when you're free to chat! - Vijay, Hivericks`;
  }
  if (mode === 'EMAIL') {
    return `Subject: Follow up from Hivericks\n\nHi ${name},\n\nIt was great speaking with you. As promised, here are the details for XOptimus (hivericks.com/xoptimus), our battery health protector. It extends your device's battery life up to 2x for just ??1499.\n\nBest regards,\nVijay`;
  }
  return `Hi ${name}, thanks for your time today! Here are the details for XOptimus: hivericks.com/xoptimus. Let me know if you have any questions! - Vijay`;
}

async function generateOpening(lead) {
  return `Hi ${lead.name}, this is Vijay from Hivericks calling regarding a quick battery health update. Is this a good time?`;
}

module.exports = { SalesBrain, generateResponse, warmup, generateStructuredSummary, generateTextSummary, generateFinalSummary, generateFeedbackRequest, generateOpening, detectIntent: (msg) => ({ type: "GENERAL" }) };
