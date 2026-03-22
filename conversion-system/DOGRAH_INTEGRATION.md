# Quick Start: Using Dograh for Voice Calls

## What Changed

✅ **Orchestrator now uses Dograh AI** for voice calls when `USE_DOGRAH_AI=true`

## Before You Start

You need to:
1. Start Dograh platform
2. Create a workflow in Dograh UI
3. Restart orchestrator

---

## Step 1: Start Dograh Platform

```powershell
cd D:\Hivericks\conversion-system

# Start Dograh services
.\start_dograh.ps1

# Or manually:
docker compose -f docker-compose.dograh.yml up -d
```

Wait 2-3 minutes for services to start.

**Verify it's running:**
```powershell
# Check services
docker compose -f docker-compose.dograh.yml ps

# Test API
curl http://localhost:8000/api/v1/health
```

---

## Step 2: Create Workflow in Dograh UI

1. Open **http://localhost:3010** in your browser

2. Create account (local only)

3. Click **"New Workflow"**
   - Type: **Outbound Call**
   - Name: **Sales Qualification**
   - Description: **Qualify leads for XOptimus chargers**

4. **Add Nodes:**

   **Greeting Node:**
   ```
   Hi {customer_name}, this is Vijay from Hivericks. 
   We spoke about XOptimus chargers. Do you have a minute?
   ```

   **Qualification Node:**
   ```
   Great! Can you tell me about your current charging needs?
   
   Variables to extract:
   - pain_points
   - budget_range
   - timeline
   ```

   **Pitch Node:**
   ```
   Based on what you said, our XOptimus charger at ₹1499 
   would be perfect. It includes a 1-year warranty. Interested?
   ```

   **Closing Node:**
   ```
   Excellent! I'll send you the order link via WhatsApp 
   right now. Expect it in 5 minutes.
   ```

5. **Save workflow** - Note the Workflow ID (should be `1`)

6. **Test it** - Click "Web Call" to test the conversation

---

## Step 3: Configure .env

Your `.env` is already updated with:

```env
USE_DOGRAH_AI=true
DOGRAH_API_URL=http://localhost:8000
DOGRAH_WORKFLOW_ID=1
```

**Important:** Make sure you have valid API keys:
```env
OPENAI_API_KEY=sk-...  # Your actual OpenAI key
DEEPGRAM_API_KEY=...   # Your actual Deepgram key
```

---

## Step 4: Restart Orchestrator

**Stop current orchestrator:**
```powershell
# Press Ctrl+C in the terminal running orchestrator
```

**Start it again:**
```powershell
cd D:\Hivericks\conversion-system\router
node orchestrator.js
```

**You should see:**
```
🤖 Using Dograh AI for voice calls
```

---

## Step 5: Test with a Lead

**Unlock a lead for testing:**
```powershell
cd D:\Hivericks\conversion-system
node unlock_lead.js +917604896187
```

**Or unlock all leads:**
```powershell
node unlock_lead.js
```

The orchestrator will automatically:
1. Detect it's a voice day (attempt 2, 4, 6, 8)
2. Call Dograh API to initiate call
3. Wait for call completion
4. Extract variables from conversation
5. Update lead status
6. Trigger post-call actions

---

## What You'll See

**In Orchestrator Console:**
```
☎️ Processing 1 Calls...
🤖 Using Dograh AI for voice calls
   🤖 Initiating Dograh AI call to +917604896187...
   ✓ Dograh call initiated: call_abc123
   ⏳ Waiting for call completion...
   ✓ Call completed: completed
   📊 Extracted variables: ['customer_name', 'pain_points', 'budget_range']
   💾 Lead updated with Dograh results
```

**In Dograh UI (http://localhost:3010):**
- Go to "Calls" tab
- See your call with full transcript
- View extracted variables
- Listen to recording

---

## Troubleshooting

### Dograh not running

```powershell
# Check if containers are up
docker compose -f docker-compose.dograh.yml ps

# Start if needed
docker compose -f docker-compose.dograh.yml up -d
```

### Orchestrator still using old system

Check console output. If you see:
```
📞 Using legacy voice engine
```

Then `USE_DOGRAH_AI` is not set to `true`. Check `.env` file.

### Dograh API error

```powershell
# Check Dograh logs
docker compose -f docker-compose.dograh.yml logs -f api

# Test API manually
curl http://localhost:8000/api/v1/health
```

### No workflow found

Make sure you created a workflow in Dograh UI and the ID matches `DOGRAH_WORKFLOW_ID` in `.env`.

---

## Switching Back to Old System

To use the original voice engine:

```env
# In .env
USE_DOGRAH_AI=false
```

Restart orchestrator.

---

## Next Steps

1. ✅ Start Dograh platform
2. ✅ Create workflow in UI
3. ✅ Restart orchestrator
4. ✅ Test with a lead
5. 🎯 Monitor calls in Dograh UI
6. 🎯 Refine workflow based on results
