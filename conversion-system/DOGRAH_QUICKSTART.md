# Dograh AI Platform - Quick Start Guide

## Overview

This guide helps you set up and run the full Dograh AI platform using Docker for AI-powered voice calls.

## Prerequisites

- Docker Desktop installed and running
- Node.js installed (for integration)
- API keys ready:
  - OpenAI API key (for LLM)
  - Deepgram API key (for STT)
  - Twilio credentials (already configured)

## Quick Start (5 minutes)

### 1. Start Dograh Platform

```bash
cd D:\Hivericks\conversion-system

# Start all Dograh services
docker compose -f docker-compose.dograh.yml up -d
```

**Wait 2-3 minutes** for all services to start. You'll see:
- PostgreSQL database
- Redis cache
- MinIO storage
- Dograh API
- Dograh UI

### 2. Verify Services

```bash
# Check all containers are running
docker compose -f docker-compose.dograh.yml ps

# Check API health
curl http://localhost:8000/api/v1/health

# Expected response: {"status": "healthy"}
```

### 3. Access Dograh UI

Open your browser: **http://localhost:3010**

- Create an account (local only, stored in PostgreSQL)
- You'll see the Dograh dashboard

### 4. Create Your First Workflow

1. Click **"New Workflow"**
2. Select **"Outbound Call"**
3. Name it: **"Sales Qualification"**
4. Description: **"Qualify leads for XOptimus chargers"**
5. Click **"Create"**

### 5. Configure Workflow

In the workflow builder:

1. **Add Greeting Node**
   - Prompt: "Hi {customer_name}, this is Vijay from Hivericks. We spoke about XOptimus chargers. Do you have a minute?"
   
2. **Add Qualification Node**
   - Prompt: "Great! Can you tell me about your current charging situation? How often does your phone battery die?"
   - Extract variables: `pain_points`, `usage_frequency`

3. **Add Pitch Node**
   - Prompt: "Based on what you said, our XOptimus charger at ₹1499 would be perfect. It includes a 1-year warranty. Interested?"

4. **Add Closing Node**
   - Prompt: "Excellent! I'll send you the order link via WhatsApp right now. Expect it in 5 minutes."

5. **Save Workflow** - Note the Workflow ID (e.g., `1`)

### 6. Test Workflow

In Dograh UI:
- Click **"Web Call"** button
- Talk to your AI agent
- Verify conversation flow
- Check extracted variables

### 7. Configure Integration

Update your `.env`:

```env
# Dograh Configuration
USE_DOGRAH_AI=true
DOGRAH_API_URL=http://localhost:8000
DOGRAH_WORKFLOW_ID=1  # Use your workflow ID

# These are already set, Dograh will use them
OPENAI_API_KEY=your_key_here
DEEPGRAM_API_KEY=your_key_here
TWILIO_SID=your_sid
TWILIO_AUTH=your_auth
TWILIO_PHONE=your_phone
```

### 8. Test Integration

```bash
cd D:\Hivericks\conversion-system
node voice/test_dograh.js
```

Expected output:
```
✓ Dograh API is healthy
✓ Workflow found: Sales Qualification
✓ Test call initiated: call_123
✓ Call completed successfully
✓ Variables extracted: {customer_name, pain_points, ...}
```

## Using Dograh for Voice Calls

### In Your Orchestrator

The orchestrator will automatically use Dograh for attempt 2 (voice day) calls:

```javascript
// router/orchestrator.js (already integrated)
const DograhClient = require('../voice/dograh_client');
const dograh = new DograhClient();

// When voice call is needed
const call = await dograh.initiateCall(
    process.env.DOGRAH_WORKFLOW_ID,
    lead.phone,
    {
        name: lead.name,
        attempt_count: lead.attempt_count,
        last_summary: lead.last_call_summary
    }
);

// Wait for completion
const result = await dograh.waitForCallCompletion(call.call_id);

// Use extracted data
console.log('Extracted:', result.variables);
// {customer_name, company_name, pain_points, budget_range, timeline}
```

## Services Overview

| Service | Port | Purpose |
|---------|------|---------|
| Dograh API | 8000 | REST API for workflows and calls |
| Dograh UI | 3010 | Web interface for workflow builder |
| PostgreSQL | 5433 | Database for workflows and call data |
| Redis | 6380 | Cache and job queue |
| MinIO | 9000 | Audio file storage |
| MinIO Console | 9001 | MinIO admin interface |

## Monitoring

### View Logs

```bash
# All services
docker compose -f docker-compose.dograh.yml logs -f

# Specific service
docker compose -f docker-compose.dograh.yml logs -f api
docker compose -f docker-compose.dograh.yml logs -f ui
```

### Check Call History

1. Open Dograh UI: http://localhost:3010
2. Go to **"Calls"** tab
3. See all calls with:
   - Transcripts
   - Extracted variables
   - Audio recordings
   - Workflow path taken

### Database Access

```bash
# Connect to PostgreSQL
docker exec -it dograh_postgres psql -U postgres -d dograh

# View workflows
SELECT id, name, created_at FROM workflows;

# View calls
SELECT id, phone_number, status, created_at FROM calls;
```

## Stopping Dograh

```bash
# Stop all services
docker compose -f docker-compose.dograh.yml down

# Stop and remove all data (fresh start)
docker compose -f docker-compose.dograh.yml down -v
```

## Troubleshooting

### Services won't start

```bash
# Check Docker is running
docker ps

# View error logs
docker compose -f docker-compose.dograh.yml logs

# Restart services
docker compose -f docker-compose.dograh.yml restart
```

### API not responding

```bash
# Check API container
docker compose -f docker-compose.dograh.yml logs api

# Restart API
docker compose -f docker-compose.dograh.yml restart api
```

### Port conflicts

If ports 8000, 3010, 5433, or 6380 are in use:

Edit `docker-compose.dograh.yml` and change the port mappings:
```yaml
ports:
  - "8001:8000"  # Change 8000 to 8001
```

### Database connection issues

```bash
# Check PostgreSQL is healthy
docker compose -f docker-compose.dograh.yml ps postgres

# Restart database
docker compose -f docker-compose.dograh.yml restart postgres
```

## Advanced Configuration

### Custom LLM Provider

Edit `docker-compose.dograh.yml`:

```yaml
environment:
  # Use Anthropic Claude instead
  ANTHROPIC_API_KEY: "${ANTHROPIC_API_KEY}"
  DEFAULT_LLM_PROVIDER: "anthropic"
  DEFAULT_LLM_MODEL: "claude-3-sonnet"
```

### Better TTS (ElevenLabs)

```yaml
environment:
  ELEVENLABS_API_KEY: "${ELEVENLABS_API_KEY}"
  DEFAULT_TTS_PROVIDER: "elevenlabs"
  DEFAULT_TTS_VOICE: "rachel"
```

### Production Deployment

For production, use:
```bash
docker compose -f docker-compose.dograh.yml --profile remote up -d
```

This enables:
- HTTPS with nginx
- TURN server for WebRTC
- Better security settings

## Next Steps

1. ✅ Start Dograh platform
2. ✅ Create sales workflow in UI
3. ✅ Test workflow with web call
4. ✅ Configure integration in `.env`
5. ✅ Test with orchestrator
6. 🎯 Deploy for production use

## Support

- **Dograh Docs**: https://docs.dograh.com
- **GitHub**: https://github.com/dograh-hq/dograh
- **Slack Community**: https://join.slack.com/t/dograh-community/...

## Cost Estimate

Per call (using OpenAI + Deepgram):
- LLM (GPT-4): ~$0.03
- STT (Deepgram): ~$0.02
- TTS (OpenAI): ~$0.01
- **Total: ~$0.06 per call**

With ElevenLabs TTS: ~$0.35 per call (better voice quality)
