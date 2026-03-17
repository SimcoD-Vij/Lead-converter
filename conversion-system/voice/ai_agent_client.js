/**
 * AI Agent Client - Node.js client for communicating with Python AI service
 * Provides methods to initialize calls, send audio, and receive AI responses
 */

const axios = require('axios');
const WebSocket = require('ws');
const { EventEmitter } = require('events');

class AIAgentClient extends EventEmitter {
    constructor(serviceUrl = process.env.AI_AGENT_SERVICE_URL || 'http://localhost:8001') {
        super();
        this.serviceUrl = serviceUrl;
        this.wsUrl = serviceUrl.replace('http', 'ws');
        this.activeConnections = new Map();
    }

    /**
     * Initialize a new AI voice call
     * @param {string} callId - Unique call identifier
     * @param {string} phoneNumber - Customer phone number
     * @param {object} options - Additional options (caller_name, context)
     * @returns {Promise<object>} Initialization response
     */
    async initializeCall(callId, phoneNumber, options = {}) {
        try {
            const response = await axios.post(`${this.serviceUrl}/call/init`, {
                call_id: callId,
                phone_number: phoneNumber,
                caller_name: options.callerName,
                context: options.context
            });

            console.log(`[${callId}] AI call initialized:`, response.data);
            return response.data;
        } catch (error) {
            console.error(`[${callId}] Failed to initialize AI call:`, error.message);
            throw error;
        }
    }

    /**
     * Get current status of a call
     * @param {string} callId - Call identifier
     * @returns {Promise<object>} Call status
     */
    async getCallStatus(callId) {
        try {
            const response = await axios.get(`${this.serviceUrl}/call/${callId}/status`);
            return response.data;
        } catch (error) {
            console.error(`[${callId}] Failed to get call status:`, error.message);
            throw error;
        }
    }

    /**
     * End an active call
     * @param {string} callId - Call identifier
     * @returns {Promise<object>} End call response with gathered context
     */
    async endCall(callId) {
        try {
            const response = await axios.post(`${this.serviceUrl}/call/${callId}/end`);

            // Remove from active connections if exists
            if (this.activeConnections.has(callId)) {
                const ws = this.activeConnections.get(callId);
                ws.close();
                this.activeConnections.delete(callId);
            }

            console.log(`[${callId}] AI call ended:`, response.data);
            return response.data;
        } catch (error) {
            console.error(`[${callId}] Failed to end call:`, error.message);
            throw error;
        }
    }

    /**
     * Connect to AI agent via WebSocket for real-time communication
     * @param {string} callId - Call identifier
     * @returns {Promise<WebSocket>} WebSocket connection
     */
    async connectWebSocket(callId) {
        return new Promise((resolve, reject) => {
            const wsUrl = `${this.wsUrl}/ws/call/${callId}`;
            console.log(`[${callId}] Connecting to WebSocket:`, wsUrl);

            const ws = new WebSocket(wsUrl);

            ws.on('open', () => {
                console.log(`[${callId}] WebSocket connected`);
                this.activeConnections.set(callId, ws);
                resolve(ws);
            });

            ws.on('message', (data) => {
                try {
                    const message = JSON.parse(data);
                    console.log(`[${callId}] AI message:`, message);
                    this.emit('message', callId, message);
                } catch (error) {
                    console.error(`[${callId}] Failed to parse message:`, error);
                }
            });

            ws.on('error', (error) => {
                console.error(`[${callId}] WebSocket error:`, error);
                this.emit('error', callId, error);
                reject(error);
            });

            ws.on('close', () => {
                console.log(`[${callId}] WebSocket closed`);
                this.activeConnections.delete(callId);
                this.emit('close', callId);
            });
        });
    }

    /**
     * Send text message to AI agent (for testing)
     * @param {string} callId - Call identifier
     * @param {string} text - Text message
     */
    sendText(callId, text) {
        const ws = this.activeConnections.get(callId);
        if (!ws) {
            throw new Error(`No active WebSocket connection for call ${callId}`);
        }

        ws.send(JSON.stringify({
            type: 'text',
            text: text
        }));
    }

    /**
     * Send audio data to AI agent
     * @param {string} callId - Call identifier
     * @param {Buffer} audioData - Audio data buffer
     */
    sendAudio(callId, audioData) {
        const ws = this.activeConnections.get(callId);
        if (!ws) {
            throw new Error(`No active WebSocket connection for call ${callId}`);
        }

        ws.send(JSON.stringify({
            type: 'audio',
            data: audioData.toString('base64')
        }));
    }

    /**
     * Check if AI service is healthy
     * @returns {Promise<object>} Health status
     */
    async healthCheck() {
        try {
            const response = await axios.get(`${this.serviceUrl}/health`);
            return response.data;
        } catch (error) {
            console.error('AI service health check failed:', error.message);
            throw error;
        }
    }
}

module.exports = AIAgentClient;
