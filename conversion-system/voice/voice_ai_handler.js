/**
 * Voice Call Handler with AI Agent Integration
 * Example showing how to integrate AI agent into existing call flow
 */

const AIAgentClient = require('./ai_agent_client');
const fs = require('fs').promises;
const path = require('path');

// Initialize AI client
const aiClient = new AIAgentClient(process.env.AI_AGENT_SERVICE_URL);

/**
 * Handle incoming voice call with AI agent
 * @param {string} callSid - Twilio call SID
 * @param {string} from - Caller phone number
 * @param {string} to - Called phone number
 * @param {object} additionalContext - Additional context data
 */
async function handleIncomingCallWithAI(callSid, from, to, additionalContext = {}) {
    console.log(`[${callSid}] Handling incoming call from ${from} with AI agent`);

    try {
        // 1. Initialize AI agent for this call
        const initResult = await aiClient.initializeCall(callSid, from, {
            callerName: additionalContext.callerName || 'Customer',
            context: {
                source: additionalContext.source || 'phone',
                campaign: additionalContext.campaign,
                ...additionalContext
            }
        });

        console.log(`[${callSid}] AI agent initialized:`, initResult);

        // 2. Connect WebSocket for real-time communication
        const ws = await aiClient.connectWebSocket(callSid);

        // 3. Listen for AI responses
        aiClient.on('message', async (id, message) => {
            if (id !== callSid) return;

            console.log(`[${callSid}] AI message:`, message);

            // Handle different message types
            switch (message.type) {
                case 'status':
                    console.log(`[${callSid}] Status: ${message.message}, Node: ${message.node}`);
                    break;

                case 'response':
                    console.log(`[${callSid}] AI response: ${message.text}`);
                    // In production, send this to TTS and play to caller
                    break;

                case 'node_transition':
                    console.log(`[${callSid}] Transitioned to node: ${message.node}`);
                    break;
            }
        });

        // 4. Handle WebSocket errors
        aiClient.on('error', (id, error) => {
            if (id !== callSid) return;
            console.error(`[${callSid}] AI WebSocket error:`, error);
        });

        // 5. Handle WebSocket close
        aiClient.on('close', async (id) => {
            if (id !== callSid) return;
            console.log(`[${callSid}] AI WebSocket closed`);

            // Get final call status and save
            try {
                const finalStatus = await aiClient.getCallStatus(callSid);
                await saveCallSummary(callSid, finalStatus);
            } catch (error) {
                console.error(`[${callSid}] Failed to get final status:`, error);
            }
        });

        return {
            success: true,
            callSid,
            aiInitialized: true
        };

    } catch (error) {
        console.error(`[${callSid}] Failed to initialize AI agent:`, error);
        return {
            success: false,
            callSid,
            error: error.message
        };
    }
}

/**
 * End call and get AI-gathered context
 * @param {string} callSid - Call SID
 */
async function endCallWithAI(callSid) {
    console.log(`[${callSid}] Ending call with AI agent`);

    try {
        const result = await aiClient.endCall(callSid);

        console.log(`[${callSid}] Call ended. Gathered context:`, result.gathered_context);

        // Save call summary
        await saveCallSummary(callSid, result);

        return result;
    } catch (error) {
        console.error(`[${callSid}] Failed to end call:`, error);
        throw error;
    }
}

/**
 * Save call summary to JSON file
 * @param {string} callSid - Call SID
 * @param {object} callData - Call data including gathered context
 */
async function saveCallSummary(callSid, callData) {
    try {
        const summaryPath = path.join(__dirname, 'summary_calls.json');

        // Read existing summaries
        let summaries = [];
        try {
            const data = await fs.readFile(summaryPath, 'utf8');
            summaries = JSON.parse(data);
        } catch (error) {
            // File doesn't exist or is empty
            summaries = [];
        }

        // Add new summary
        const summary = {
            callSid,
            timestamp: new Date().toISOString(),
            status: callData.status,
            currentNode: callData.current_node,
            gatheredContext: callData.gathered_context || {},
            disposition: callData.gathered_context?.call_disposition || 'unknown'
        };

        summaries.push(summary);

        // Save back to file
        await fs.writeFile(summaryPath, JSON.stringify(summaries, null, 2));

        console.log(`[${callSid}] Call summary saved`);
    } catch (error) {
        console.error(`[${callSid}] Failed to save call summary:`, error);
    }
}

/**
 * Check AI service health
 */
async function checkAIServiceHealth() {
    try {
        const health = await aiClient.healthCheck();
        console.log('AI Service Health:', health);
        return health;
    } catch (error) {
        console.error('AI Service is not available:', error.message);
        return null;
    }
}

// Export functions
module.exports = {
    handleIncomingCallWithAI,
    endCallWithAI,
    saveCallSummary,
    checkAIServiceHealth,
    aiClient
};
