// Simplified salesBot for verification
const HARDCODED_VOICE_RESPONSES = {
    1: (name) => `Hi ${name}, this is Vijay from Hivericks regarding the XOptimus charger. Do you have a minute?`,
    2: (name) => `Great. XOptimus is a smart charger that can double your battery life. Have you heard of it?`,
    4: (name) => `XOptimus is our smart wall adapter that prevents overcharging and heating, effectively doubling your battery's lifespan. What devices do you usually charge?`,
    7: (name) => `Thank you for your time, ${name}. Have a great day ahead. Goodbye!`
};

const CONVERSATION_STAGES = {
    1: { name: "Call Opening", goal: "Confirm availability" },
    2: { name: "Good Time Confirmed", goal: "Intro" },
    4: { name: "Product Pitch", goal: "Explain value" }
};

async function determineConversationStage(userMessage, memory = {}) {
    const lastUserMsg = userMessage.toLowerCase();
    const currentStage = memory.conversation_stage_id || 1;
    let nextStage = currentStage;

    if (lastUserMsg.includes("yes") || lastUserMsg.includes("have a minute")) {
        if (currentStage === 1) nextStage = 2;
    } else if (lastUserMsg.includes("detail") || lastUserMsg.includes("what is it")) {
        nextStage = 4;
    }

    if (nextStage < currentStage) nextStage = currentStage;
    return nextStage;
}

async function generateResponse({ userMessage, memory = {}, mode = 'SMS_CHAT', leadContext = {} }) {
    const isVoice = mode === 'VOICE_CALL';
    let stageId = memory.conversation_stage_id || 1;

    if (isVoice) {
        stageId = await determineConversationStage(userMessage, memory);
        memory.conversation_stage_id = stageId;
    }

    if (isVoice && HARDCODED_VOICE_RESPONSES[stageId]) {
        const resp = HARDCODED_VOICE_RESPONSES[stageId](leadContext.name || "there");
        return {
            response: resp,
            stageId: stageId
        };
    }

    return { response: "LLM fallback", stageId: stageId };
}

module.exports = { generateResponse };
