# Dograh Setup - Using Free Built-in API Keys

## What You Need

✅ **Only Twilio credentials** (you already have these)  
✅ **No OpenAI API key needed**  
✅ **No Deepgram API key needed**  

Dograh provides **free built-in API keys** for LLM, TTS, and STT services!

---

## Step 1: Start Dograh (2 minutes)

```powershell
cd D:\Hivericks\conversion-system

# Start Dograh platform
docker compose -f docker-compose.dograh.yml up -d
```

**Wait 2-3 minutes** for all services to download and start.

### Verify it's running:

```powershell
# Check all containers are up
docker compose -f docker-compose.dograh.yml ps

# Should show:
# dograh_api        Up
# dograh_ui         Up
# dograh_postgres   Up
# dograh_redis      Up
# dograh_minio      Up
```

---

## Step 2: Access Dograh UI

Open your browser: **http://localhost:3010**

1. **Create Account**
   - Email: anything@example.com (local only, not verified)
   - Password: your choice
   - Click "Sign Up"

2. **You're in!** You'll see the Dograh dashboard

---

## Step 3: Create Voice Agent (5 minutes)

### 3.1 Create New Agent

1. Click **"New Agent"** or **"Create Agent"**
2. Fill in:
   - **Name**: Sales Bot
   - **Type**: Outbound Call
   - **Description**: AI sales agent for XOptimus chargers

3. Click **"Create"**

### 3.2 Configure Agent

You'll see the agent configuration page:

**System Prompt:**
```
You are Vijay, a sales representative from Hivericks selling XOptimus phone chargers.

Your goal is to:
1. Greet the customer warmly
2. Understand their charging needs
3. Present the XOptimus charger (₹1499, 1-year warranty)
4. Handle objections professionally
5. Close the sale or schedule follow-up

Be conversational, helpful, and professional.
Extract: customer_name, pain_points, budget_range, timeline, call_disposition
```

**First Message:**
```
Hi {customer_name}, this is Vijay from Hivericks. We spoke about XOptimus chargers. Do you have a minute?
```

**Voice Settings:**
- **Provider**: Use default (Dograh's free TTS)
- **Voice**: Select any available voice
- **Speed**: 1.0

**LLM Settings:**
- **Provider**: Use default (Dograh's free LLM)
- **Model**: Use default
- **Temperature**: 0.7

**STT Settings:**
- **Provider**: Use default (Dograh's free STT)

4. Click **"Save"**

### 3.3 Test Your Agent

1. Click **"Test Call"** or **"Web Call"** button
2. Allow microphone access
3. Talk to your AI agent!
4. Verify it responds correctly

---

## Step 4: Get Agent ID

After creating the agent:

1. Look at the URL in your browser:
   ```
   http://localhost:3010/agents/abc123...
                                 ^^^^^^^^ This is your Agent ID
   ```

2. Or find it in the agent settings page

3. **Copy this ID** - you'll need it for the orchestrator

---

## Step 5: Update .env

Edit `D:\Hivericks\conversion-system\.env`:

```env
# Dograh AI Configuration
USE_DOGRAH_AI=true
DOGRAH_API_URL=http://localhost:8000
DOGRAH_AGENT_ID=abc123...  # Paste your agent ID here

# Twilio (you already have these)
TWILIO_SID=YOUR_TWILIO_ACCOUNT_SID
TWILIO_AUTH=YOUR_TWILIO_AUTH_TOKEN
TWILIO_PHONE=YOUR_TWILIO_PHONE_NUMBER
```

**Remove or comment out** (not needed):
```env
# OPENAI_API_KEY=...  # Not needed!
# DEEPGRAM_API_KEY=...  # Not needed!
```

---

## Step 6: Update Orchestrator

The orchestrator needs a small update to use Agent ID instead of Workflow ID:

Edit `router/orchestrator.js` line ~640:

**Change from:**
```javascript
const call = await dograh.initiateCall(
    process.env.DOGRAH_WORKFLOW_ID || 1,  // ← Old
    lead.phone,
    { ... }
);
```

**To:**
```javascript
const call = await dograh.initiateCall(
    process.env.DOGRAH_AGENT_ID,  // ← New
    lead.phone,
    { ... }
);
```

---

## Step 7: Restart Orchestrator

```powershell
# Stop current orchestrator (Ctrl+C)

cd D:\Hivericks\conversion-system\router
node orchestrator.js
```

**Look for:**
```
🤖 Using Dograh AI for voice calls
```

---

## Step 8: Test with a Lead

```powershell
cd D:\Hivericks\conversion-system

# Unlock a lead
node unlock_lead.js +917604896187

# Or unlock all
node unlock_lead.js
```

The orchestrator will automatically call via Dograh when it's a voice day!

---

## What You'll See

**In Orchestrator:**
```
☎️ Processing 1 Calls...
🤖 Using Dograh AI for voice calls
   🤖 Initiating Dograh AI call to +917604896187...
   ✓ Dograh call initiated: call_abc123
   ⏳ Waiting for call completion...
```

**In Dograh UI (http://localhost:3010):**
- Go to "Calls" or "History"
- See your call in real-time
- View transcript as it happens
- See extracted variables

---

## Monitoring

### View Logs

```powershell
# All Dograh services
docker compose -f docker-compose.dograh.yml logs -f

# Just API
docker compose -f docker-compose.dograh.yml logs -f api
```

### Check Call History

1. Open http://localhost:3010
2. Go to "Calls" or "History" tab
3. Click on any call to see:
   - Full transcript
   - Extracted variables
   - Audio recording
   - Call duration and status

---

## Troubleshooting

### Dograh won't start

```powershell
# Check Docker is running
docker ps

# Pull latest images
docker compose -f docker-compose.dograh.yml pull

# Start again
docker compose -f docker-compose.dograh.yml up -d
```

### Can't access UI

```powershell
# Check if UI container is running
docker compose -f docker-compose.dograh.yml ps ui

# Check logs
docker compose -f docker-compose.dograh.yml logs ui

# Restart UI
docker compose -f docker-compose.dograh.yml restart ui
```

### Agent not working

1. Check agent configuration in UI
2. Test with "Web Call" first
3. Verify Twilio credentials in .env
4. Check Dograh API logs

---

## Stopping Dograh

```powershell
# Stop all services
docker compose -f docker-compose.dograh.yml down

# Stop and remove all data (fresh start)
docker compose -f docker-compose.dograh.yml down -v
```

---

## Summary

✅ **No API keys needed** - Dograh provides free LLM/TTS/STT  
✅ **Only Twilio required** - for actual phone calls  
✅ **Visual agent builder** - no coding needed  
✅ **Real-time monitoring** - see calls as they happen  
✅ **Automatic data extraction** - variables saved automatically  

**Total setup time: ~10 minutes**

---

## Next Steps

1. ✅ Start Dograh
2. ✅ Create agent in UI
3. ✅ Update .env with agent ID
4. ✅ Restart orchestrator
5. ✅ Test with a lead
6. 🎯 Monitor calls in Dograh UI
7. 🎯 Refine agent based on results
