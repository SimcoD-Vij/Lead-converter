/**
 * Dograh API Client - Integration with Dograh AI Platform
 * Handles workflow creation, call initiation, and data retrieval
 */

const axios = require('axios');
const { EventEmitter } = require('events');
const Minio = require('minio');
const fs = require('fs');
const path = require('path');

class DograhClient extends EventEmitter {
    constructor(apiUrl = process.env.DOGRAH_API_URL || 'http://localhost:8000', apiKey = process.env.DOGRAH_API_KEY) {
        super();
        this.apiUrl = apiUrl;
        this.apiKey = apiKey;
        this.baseUrl = `${apiUrl}/api/v1`;

        // Initialize MinIO Client (for artifacts)
        this.minioClient = new Minio.Client({
            endPoint: process.env.MINIO_ENDPOINT || 'localhost',
            port: parseInt(process.env.MINIO_PORT || '9000'),
            useSSL: process.env.MINIO_USE_SSL === 'true',
            accessKey: process.env.MINIO_ACCESS_KEY || 'minioadmin',
            secretKey: process.env.MINIO_SECRET_KEY || 'minioadmin'
        });
        this.bucketName = process.env.MINIO_BUCKET || 'voice-audio';
    }

    /**
     * Get request headers with authentication
     */
    _getHeaders() {
        const headers = {
            'Content-Type': 'application/json'
        };

        if (this.apiKey) {
            const masked = this.apiKey.substring(0, 5) + '...' + this.apiKey.substring(this.apiKey.length - 5);
            console.log(`[Dograh] Auth Header: X-API-Key=${masked}`);
            headers['X-API-Key'] = this.apiKey.trim();
        }

        return headers;
    }

    // ... (healthCheck, createWorkflow, getWorkflow, listWorkflows, initiateCall methods remain unchanged) ...

    /**
     * Check Dograh API health
     */
    async healthCheck() {
        try {
            const response = await axios.get(`${this.apiUrl}/api/v1/health`);
            return response.data;
        } catch (error) {
            console.error('Dograh health check failed:', error.message);
            throw error;
        }
    }

    async createWorkflow(config) {
        try {
            const response = await axios.post(
                `${this.baseUrl}/workflows`,
                config,
                { headers: this._getHeaders() }
            );
            console.log(`[Dograh] Workflow created: ${response.data.id}`);
            return response.data;
        } catch (error) {
            console.error('[Dograh] Failed to create workflow:', error.message);
            throw error;
        }
    }

    async getWorkflow(workflowId) {
        try {
            const response = await axios.get(
                `${this.baseUrl}/workflows/${workflowId}`,
                { headers: this._getHeaders() }
            );
            return response.data;
        } catch (error) {
            console.error(`[Dograh] Failed to get workflow ${workflowId}:`, error.message);
            throw error;
        }
    }

    async listWorkflows() {
        try {
            const response = await axios.get(
                `${this.baseUrl}/workflows`,
                { headers: this._getHeaders() }
            );
            return response.data;
        } catch (error) {
            console.error('[Dograh] Failed to list workflows:', error.message);
            throw error;
        }
    }

    async initiateCall(triggerUuid, phoneNumber, context = {}) {
        try {
            // Preference: Use direct telephony initiation if workflow ID is available
            const workflowId = process.env.DOGRAH_WORKFLOW_ID;

            if (workflowId) {
                console.log(`[Dograh] Initiating call to ${phoneNumber} via direct Workflow ID ${workflowId}...`);
                const response = await axios.post(
                    `${this.baseUrl}/telephony/initiate-call`,
                    {
                        workflow_id: parseInt(workflowId),
                        phone_number: phoneNumber
                    },
                    {
                        headers: this._getHeaders(),
                        timeout: 60000
                    }
                );

                console.log(`[Dograh] Call initiation message: ${response.data.message}`);

                // The API returns an object like { runs: [], total_count: ... }.
                try {
                    const runsResponse = await axios.get(
                        `${this.baseUrl}/workflow/${workflowId}/runs`,
                        { headers: this._getHeaders() }
                    );

                    const latestRun = runsResponse.data.runs?.[0]; // Access the runs array
                    if (latestRun) {
                        console.log(`[Dograh] Identified Run ID: ${latestRun.id} (${latestRun.name})`);
                        return {
                            call_id: latestRun.id,
                            ...latestRun
                        };
                    }
                } catch (runError) {
                    console.warn('[Dograh] Failed to fetch run ID, using fallback string parsing', runError.message);
                }

                return {
                    call_id: response.data.message?.split(' ').pop() || 'unknown',
                    ...response.data
                };
            }

            // Fallback: Public trigger UUID method
            const payload = {
                phone_number: phoneNumber,
                initial_context: context
            };

            console.log(`[Dograh] Initiating call to ${phoneNumber} with trigger ${triggerUuid}`);

            const response = await axios.post(
                `${this.baseUrl}/public/agent/${triggerUuid}`,
                payload,
                {
                    headers: this._getHeaders(),
                    timeout: 60000
                }
            );

            console.log(`[Dograh] Call initiated successfully`);
            return {
                call_id: response.data.workflow_run_id,
                ...response.data
            };
        } catch (error) {
            console.error('[Dograh] Failed to initiate call:', error.response?.data || error.message);
            throw error;
        }
    }

    async getCallStatus(workflowRunId, workflowId) {
        try {
            const response = await axios.get(
                `${this.baseUrl}/workflow/${workflowId}/runs/${workflowRunId}`,
                { headers: this._getHeaders() }
            );
            const run = response.data;
            return {
                status: run.is_completed ? 'completed' : (run.status || 'in-progress'),
                duration: run.cost_info?.call_duration_seconds || 0,
                workflow_run_id: run.id,
                ...run
            };
        } catch (error) {
            console.error(`[Dograh] Failed to get status for run ${workflowRunId}:`, error.message);
            throw error;
        }
    }

    /**
     * Download artifact (transcript/recording) from MinIO
     */
    async downloadArtifact(runId, type) {
        const ext = type === 'transcript' ? 'txt' : 'wav';
        const folder = type === 'transcript' ? 'transcripts' : 'recordings';
        const objectName = `${folder}/${runId}.${ext}`;

        // Ensure local directory exists
        const localDir = path.join(__dirname, `../voice/${folder}`);
        if (!fs.existsSync(localDir)) fs.mkdirSync(localDir, { recursive: true });

        const localPath = path.join(localDir, `${runId}.${ext}`);

        try {
            await this.minioClient.fGetObject(this.bucketName, objectName, localPath);
            // console.log(`[Dograh] Downloaded ${type} to ${localPath}`);
            return localPath;
        } catch (err) {
            console.warn(`[Dograh] Failed to download ${type} for run ${runId}: ${err.message}`);
            return null;
        }
    }

    /**
     * Get call transcript from workflow run
     */
    async getCallTranscript(workflowRunId, workflowId) {
        try {
            const response = await axios.get(
                `${this.baseUrl}/workflow/${workflowId}/runs/${workflowRunId}`,
                { headers: this._getHeaders() }
            );

            const run = response.data;
            let transcript = '';
            let messages = [];

            // 1. Try to get from logs 
            if (run.logs) {
                if (run.logs.transcript) transcript = run.logs.transcript;
                if (run.logs.messages) messages = run.logs.messages;
            }

            // 2. If no logs, try downloading from MinIO
            if (!transcript && run.transcript_url) {
                const localPath = await this.downloadArtifact(workflowRunId, 'transcript');
                if (localPath && fs.existsSync(localPath)) {
                    transcript = fs.readFileSync(localPath, 'utf8');
                }
            }

            // Always try to download recording too
            if (run.recording_url) {
                this.downloadArtifact(workflowRunId, 'recording').catch(() => { });
            }

            return {
                transcript: transcript || 'No transcript available',
                summary: run.logs?.summary || '',
                messages: messages
            };
        } catch (error) {
            console.error(`[Dograh] Failed to get transcript for run ${workflowRunId}:`, error.message);
            throw error;
        }
    }

    async getCallVariables(workflowRunId, workflowId) {
        try {
            const response = await axios.get(
                `${this.baseUrl}/workflow/${workflowId}/runs/${workflowRunId}`,
                { headers: this._getHeaders() }
            );
            const run = response.data;
            return run.gathered_context || run.initial_context || {};
        } catch (error) {
            console.error(`[Dograh] Failed to get variables for run ${workflowRunId}:`, error.message);
            throw error;
        }
    }

    async getCallRecording(callId) {
        // Deprecated in favor of direct download, but kept for compatibility
        return this.downloadArtifact(callId, 'recording');
    }

    /**
     * Wait for call completion and get final data
     * @param {string} callId - Call ID
     * @param {string} workflowId - Workflow ID
     * @param {number} maxWaitMs - Maximum wait time in milliseconds
     */
    async waitForCallCompletion(callId, workflowId, maxWaitMs = 600000) {
        const startTime = Date.now();
        const pollInterval = 5000; // Poll every 5 seconds

        while (Date.now() - startTime < maxWaitMs) {
            try {
                const status = await this.getCallStatus(callId, workflowId);

                // Check if call is in terminal state
                if (status.is_completed || ['completed', 'failed', 'no-answer', 'busy'].includes(status.status)) {
                    console.log(`[Dograh] Call ${callId} completed with status: ${status.status}`);

                    // Get final data
                    const [transcript, variables] = await Promise.all([
                        this.getCallTranscript(callId, workflowId).catch(() => null),
                        this.getCallVariables(callId, workflowId).catch(() => null)
                    ]);

                    return {
                        status: status.status,
                        transcript,
                        variables,
                        duration: status.duration,
                        call_id: callId
                    };
                }

                // Wait before next poll
                await new Promise(resolve => setTimeout(resolve, pollInterval));
            } catch (error) {
                console.error(`[Dograh] Error polling call status:`, error.message);
                await new Promise(resolve => setTimeout(resolve, pollInterval));
            }
        }

        throw new Error(`Call ${callId} did not complete within ${maxWaitMs}ms`);
    }
}

module.exports = DograhClient;
