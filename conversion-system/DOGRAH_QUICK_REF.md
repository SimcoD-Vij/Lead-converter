# ✅ Dograh Setup Complete - Quick Reference

## What's Ready

✅ **Docker Compose** - No API keys needed (Dograh provides free ones)  
✅ **Orchestrator** - Updated to use `DOGRAH_AGENT_ID`  
✅ **Environment** - `.env` configured for Dograh  

---

## Quick Start (10 minutes)

### 1. Start Dograh

```powershell
cd D:\Hivericks\conversion-system
docker compose -f docker-compose.dograh.yml up -d
```

Wait 2-3 minutes. Then verify:
```powershell
docker compose -f docker-compose.dograh.yml ps
```

### 2. Create Agent

1. Open **http://localhost:3010**
2. Create account (local, any email)
3. Click **"New Agent"** or **"Create Agent"**
4. Configure:
   - **Name**: Sales Bot
   - **Type**: Outbound
   - **System Prompt**:
     ```
     You are Vijay from Hivericks selling XOptimus chargers (₹1499).
     Extract: customer_name, pain_points, budget_range, timeline, call_disposition
     ```
   - **First Message**:
     ```
     Hi {customer_name}, this is Vijay from Hivericks. 
     We spoke about XOptimus chargers. Do you have a minute?
     ```
5. **Save**
6. **Test** with "Web Call" button

### 3. Get Agent ID

Look at browser URL:
```
http://localhost:3010/agents/abc123def456...
                               ^^^^^^^^^^^^^ Copy this
```

### 4. Update .env

Edit `D:\Hivericks\conversion-system\.env`:

```env
DOGRAH_AGENT_ID=abc123def456...  # Paste your agent ID here
```

### 5. Restart Orchestrator

```powershell
# Stop current (Ctrl+C)
cd D:\Hivericks\conversion-system\router
node orchestrator.js
```

Look for: `🤖 Using Dograh AI for voice calls`

### 6. Test

```powershell
cd D:\Hivericks\conversion-system
node unlock_lead.js
```

---

## Monitoring

- **Dograh UI**: http://localhost:3010
- **Calls Tab**: See all calls with transcripts
- **Logs**: `docker compose -f docker-compose.dograh.yml logs -f api`

---

## Troubleshooting

**Dograh won't start:**
```powershell
docker compose -f docker-compose.dograh.yml pull
docker compose -f docker-compose.dograh.yml up -d
```

**Can't access UI:**
```powershell
docker compose -f docker-compose.dograh.yml restart ui
```

**Orchestrator not using Dograh:**
- Check `.env` has `USE_DOGRAH_AI=true`
- Check `DOGRAH_AGENT_ID` is set
- Restart orchestrator

---

## What You Get

✅ **Free LLM** - Dograh's built-in GPT  
✅ **Free TTS** - Dograh's text-to-speech  
✅ **Free STT** - Dograh's speech-to-text  
✅ **Visual Builder** - No coding needed  
✅ **Real-time Monitoring** - See calls live  
✅ **Auto Data Extraction** - Variables saved automatically  

**Only cost: Twilio** (~$0.01/min for calls)

---

## Full Documentation

- **Complete Setup**: `DOGRAH_SETUP_FREE.md`
- **Integration Guide**: `DOGRAH_INTEGRATION.md`
- **Quick Start**: `DOGRAH_QUICKSTART.md`
