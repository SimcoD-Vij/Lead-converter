# Voice AI Agent Service

Python-based AI agent service for handling voice conversations using the Pipecat framework.

## Features

- **AI-Powered Conversations**: Uses LLM (GPT-4) for natural language understanding and generation
- **Workflow-Based**: 8-stage sales conversation flow (greeting, qualification, pitch, objection handling, closing, etc.)
- **Multi-Provider Support**: OpenAI for LLM/TTS, Deepgram for STT
- **Real-Time Communication**: WebSocket support for bidirectional audio streaming
- **Variable Extraction**: Automatically extracts customer information during conversation
- **RESTful API**: HTTP endpoints for call management

## Architecture

```
┌─────────────────┐      HTTP/WS      ┌──────────────────┐
│   Node.js       │ ◄──────────────► │   Python AI      │
│   Voice Server  │                   │   Service        │
│   (call_server) │                   │   (FastAPI)      │
└─────────────────┘                   └──────────────────┘
        │                                      │
        │                                      ├─ PipecatEngine
        │                                      ├─ WorkflowManager
        │                                      ├─ ServiceFactory
        ▼                                      └─ LLM/TTS/STT
   ┌─────────┐
   │  Twilio │
   └─────────┘
```

## Installation

1. **Install Python dependencies**:
   ```bash
   cd voice/ai_agent
   pip install -r requirements.txt
   ```

2. **Configure environment**:
   ```bash
   cp .env.example .env
   # Edit .env and add your API keys
   ```

3. **Required API Keys**:
   - OpenAI API key (for LLM and TTS)
   - Deepgram API key (for STT)

## Usage

### Start the AI Service

```bash
cd voice/ai_agent
python voice_ai_service.py
```

The service will start on `http://localhost:8001`

### API Endpoints

- `GET /` - Health check
- `GET /health` - Detailed health status
- `POST /call/init` - Initialize a new call
- `GET /call/{call_id}/status` - Get call status
- `POST /call/{call_id}/end` - End a call
- `WS /ws/call/{call_id}` - WebSocket for real-time communication

### Example: Initialize a Call

```javascript
const AIAgentClient = require('./ai_agent_client');

const client = new AIAgentClient('http://localhost:8001');

// Initialize call
const result = await client.initializeCall('call-123', '+1234567890', {
    callerName: 'John Doe',
    context: { source: 'website' }
});

// Connect WebSocket
const ws = await client.connectWebSocket('call-123');

// Listen for AI responses
client.on('message', (callId, message) => {
    console.log('AI said:', message);
});

// Send text (for testing)
client.sendText('call-123', 'Hello, I need help with...');

// End call
await client.endCall('call-123');
```

## Workflow Stages

The AI agent follows an 8-stage sales workflow:

1. **Greeting** - Warm introduction and initial engagement
2. **Qualification** - Gather customer information (name, company, needs, budget, timeline)
3. **Pitch** - Present solution based on customer needs
4. **Objection Handling** - Address concerns and questions
5. **Closing** - Secure next steps (demo, proposal, meeting)
6. **Follow-up Scheduled** - End with follow-up commitment
7. **Qualified Lead** - Successful conversion
8. **Disqualified Lead** - Polite exit for non-fits

## Configuration

Edit `config.py` or set environment variables:

```env
# LLM
LLM_PROVIDER=openai
LLM_MODEL=gpt-4
OPENAI_API_KEY=sk-...

# TTS
TTS_PROVIDER=openai
TTS_VOICE=alloy

# STT
STT_PROVIDER=deepgram
DEEPGRAM_API_KEY=...
```

## Logs

Logs are written to:
- Console (INFO level)
- `voice_ai_service.log` (DEBUG level, rotated daily)

## Development

### Project Structure

```
voice/ai_agent/
├── voice_ai_service.py    # FastAPI application
├── pipecat_engine.py      # AI conversation engine
├── workflow_manager.py    # Workflow definitions
├── service_factory.py     # LLM/TTS/STT factory
├── config.py              # Configuration management
├── requirements.txt       # Python dependencies
└── .env.example          # Example environment file
```

### Testing

```bash
# Test health endpoint
curl http://localhost:8001/health

# Initialize a test call
curl -X POST http://localhost:8001/call/init \
  -H "Content-Type: application/json" \
  -d '{"call_id": "test-123", "phone_number": "+1234567890"}'

# Check call status
curl http://localhost:8001/call/test-123/status
```

## Integration with Node.js

The `ai_agent_client.js` provides a Node.js client for easy integration:

```javascript
const AIAgentClient = require('./voice/ai_agent_client');
const client = new AIAgentClient();

// Use in your call handling logic
app.post('/voice/incoming', async (req, res) => {
    const callId = req.body.CallSid;
    
    // Initialize AI agent
    await client.initializeCall(callId, req.body.From);
    
    // Connect WebSocket for real-time processing
    const ws = await client.connectWebSocket(callId);
    
    // Handle AI responses
    client.on('message', (id, msg) => {
        // Process AI response
    });
});
```

## Troubleshooting

**Service won't start**:
- Check that all API keys are set in `.env`
- Verify Python version (3.9+)
- Check port 8001 is not in use

**No AI responses**:
- Verify OpenAI API key is valid
- Check logs for errors
- Ensure LLM model is accessible

**WebSocket connection fails**:
- Ensure call was initialized first
- Check firewall settings
- Verify WebSocket URL format

## License

Part of the conversion-system project.
