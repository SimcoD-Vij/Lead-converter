# Quick Start Guide - AI Voice Agent

## Prerequisites

- Python 3.9+ installed
- Node.js installed
- OpenAI API key
- Deepgram API key

## Setup (5 minutes)

### 1. Install Python Dependencies

```bash
cd D:\Hivericks\conversion-system\voice\ai_agent
pip install -r requirements.txt
```

### 2. Configure API Keys

Edit `D:\Hivericks\conversion-system\.env`:

```env
# Replace with your actual keys
OPENAI_API_KEY=sk-your-actual-openai-key-here
DEEPGRAM_API_KEY=your-actual-deepgram-key-here
```

### 3. Test the Service

```bash
cd D:\Hivericks\conversion-system\voice\ai_agent
python test_service.py
```

You should see:
```
✓ Configuration loaded
✓ LLM service created
✓ TTS service created
✓ STT service created
✓ Workflow created with 8 nodes
✓ Engine initialized
All tests passed! ✓
```

### 4. Start the AI Service

```bash
python voice_ai_service.py
```

Service will start on `http://localhost:8001`

### 5. Test from Node.js

In a new terminal:

```bash
cd D:\Hivericks\conversion-system
node
```

Then in Node REPL:

```javascript
const { aiClient, checkAIServiceHealth } = require('./voice/voice_ai_handler');

// Check health
checkAIServiceHealth().then(console.log);

// Initialize a test call
aiClient.initializeCall('test-123', '+1234567890', {
    callerName: 'Test User'
}).then(console.log);

// Get status
aiClient.getCallStatus('test-123').then(console.log);
```

## What You Get

✅ **8-Stage Sales Workflow**
- Greeting → Qualification → Pitch → Objection Handling → Closing → End States

✅ **Automatic Data Extraction**
- Customer name, company, pain points, budget, timeline

✅ **AI-Powered Conversations**
- Natural language understanding with GPT-4
- Context-aware responses

✅ **Easy Integration**
- HTTP REST API
- WebSocket for real-time
- Node.js client included

## Next Steps

1. **Integrate with Twilio**: Update `call_server.js` to use AI agent
2. **Customize Workflow**: Edit `workflow_manager.py` to match your sales process
3. **Add CRM Integration**: Connect to your CRM using gathered context
4. **Deploy**: Run service in production environment

## Troubleshooting

**"API key not set" error:**
- Make sure you edited `.env` with real API keys
- Restart the service after changing `.env`

**Service won't start:**
- Check Python version: `python --version` (need 3.9+)
- Try: `pip install -r requirements.txt --upgrade`

**No responses from AI:**
- Verify OpenAI API key is valid
- Check service logs: `voice_ai_service.log`

## Documentation

- Full walkthrough: See `walkthrough.md` artifact
- Implementation details: See `implementation_plan.md` artifact
- Service README: `voice/ai_agent/README.md`

## Support

Check logs at:
- `voice/ai_agent/voice_ai_service.log` (Python service)
- Console output (Node.js integration)
