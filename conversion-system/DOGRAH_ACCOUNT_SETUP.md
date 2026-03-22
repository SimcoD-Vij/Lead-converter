# How to Create a Dograh Account (Local Setup)

## 🎯 Quick Overview

Creating a local Dograh account takes **2 minutes**. No email verification needed!

---

## 📋 Step-by-Step Guide

### Step 1: Open Dograh UI

1. Make sure Dograh is running:
   ```powershell
   cd D:\Hivericks\dograh
   docker compose ps
   ```
   
   You should see services running (api, ui, postgres, redis, minio).

2. Open your browser and go to:
   ```
   http://localhost:3010
   ```

### Step 2: Sign Up

You'll see one of these screens:

#### Option A: Login/Sign Up Page

If you see a login page:
- Look for **"Sign Up"**, **"Create Account"**, or **"Register"** link
- Click on it

#### Option B: Direct Sign Up Form

If you see a sign-up form directly, proceed to fill it in.

### Step 3: Fill in Registration Form

Enter the following information:

```
Email: admin@local.dev
(or any email you prefer - no verification needed for local setup)

Password: admin123
(or any password you prefer)

Name: Admin User
(if required)
```

**Important Notes:**
- ✅ **No email verification** required for local setup
- ✅ **Any email works** - it's just an identifier
- ✅ **Password can be simple** - this is local only

### Step 4: Complete Registration

1. Click **"Sign Up"** or **"Create Account"**
2. You should be automatically logged in
3. You'll see the Dograh dashboard

---

## 🎨 What You'll See After Registration

### Dashboard Overview

After logging in, you'll see:

```
┌─────────────────────────────────────────────────────┐
│  Dograh Dashboard                                   │
├─────────────────────────────────────────────────────┤
│                                                     │
│  Welcome, Admin User!                               │
│                                                     │
│  ┌─────────────────┐  ┌─────────────────┐          │
│  │  Create Agent   │  │  View Agents    │          │
│  └─────────────────┘  └─────────────────┘          │
│                                                     │
│  Recent Activity:                                   │
│  - No agents yet                                    │
│                                                     │
└─────────────────────────────────────────────────────┘
```

---

## 🚀 Next Steps After Account Creation

### 1. Create Your First Agent

1. Click **"Create Agent"** or **"New Workflow"**
2. Choose **"Outbound"** call type
3. Fill in:
   - **Name**: `Sales Bot`
   - **Description**: `AI sales agent for lead conversion`
4. Click **"Create"**

### 2. Get Your Agent ID

After creating the agent:
1. Click on your agent to open it
2. Look at the browser URL:
   ```
   http://localhost:3010/workflow/1
                                   ^
                                   This is your Agent ID!
   ```
3. **Save this number** - you'll need it for `.env`

### 3. Configure Twilio

1. Go to **Settings** (gear icon, top right)
2. Click **"Organization"** or **"Telephony"**
3. Select **"Twilio"** as provider
4. Enter your credentials:
   ```
   Account SID: YOUR_TWILIO_ACCOUNT_SID
   Auth Token: YOUR_TWILIO_AUTH_TOKEN
   Phone Number: YOUR_TWILIO_PHONE_NUMBER
   ```
5. Click **"Save"**

### 4. Create API Key

1. Go to **Settings** → **"API Keys"** (or **"Developer"**)
2. Click **"Create New API Key"**
3. Name: `Conversion System Integration`
4. Click **"Create"**
5. **IMPORTANT**: Copy the key immediately!
   ```
   dgr_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
   ```
   You won't see it again!

### 5. Update Your `.env`

Edit `D:\Hivericks\conversion-system\.env`:

```env
# Dograh AI Configuration
USE_DOGRAH_AI=true
DOGRAH_API_URL=http://localhost:8000
DOGRAH_AGENT_ID=1  # Your agent ID from step 2
DOGRAH_API_KEY=dgr_xxxxxxxxxx  # Your API key from step 4
```

### 6. Test the Integration

```powershell
# Restart orchestrator
cd D:\Hivericks\conversion-system\router
node orchestrator.js

# In another terminal, unlock a lead
cd D:\Hivericks\conversion-system
node unlock_lead.js
```

Watch the orchestrator logs - you should see:
```
🤖 Using Dograh AI for voice calls
🤖 Initiating Dograh AI call to +917604896187...
[Dograh] Call initiated successfully
```

---

## 🔧 Troubleshooting

### "Cannot access http://localhost:3010"

**Problem**: Dograh UI is not running.

**Solution**:
```powershell
cd D:\Hivericks\dograh
docker compose up -d
# Wait 2-3 minutes for services to start
```

Check status:
```powershell
docker compose ps
```

All services should show "healthy" or "running".

### "Page loads but shows error"

**Problem**: Services are starting up.

**Solution**: Wait 2-3 minutes and refresh the page.

### "Sign up button doesn't work"

**Problem**: JavaScript error or service not ready.

**Solution**:
1. Open browser console (F12)
2. Check for errors
3. Refresh the page
4. Try a different browser

### "Already have an account but forgot password"

**Problem**: Need to reset local account.

**Solution**: Since this is local, you can:
1. Create a new account with a different email
2. Or reset the database:
   ```powershell
   cd D:\Hivericks\dograh
   docker compose down -v
   docker compose up -d
   ```
   ⚠️ **Warning**: This deletes all data!

---

## 📝 Summary Checklist

- [ ] Dograh services running (`docker compose ps`)
- [ ] Opened http://localhost:3010
- [ ] Created account (email: admin@local.dev)
- [ ] Logged in successfully
- [ ] Created agent (got ID from URL)
- [ ] Configured Twilio in settings
- [ ] Created API key (copied it!)
- [ ] Updated `.env` with agent ID and API key
- [ ] Restarted orchestrator
- [ ] Tested with `unlock_lead.js`

---

## 🎉 You're Done!

Once you complete these steps, your orchestrator will use Dograh for voice calls with:
- ✅ Free LLM (no OpenAI key needed)
- ✅ Free TTS (no ElevenLabs key needed)
- ✅ Free STT (no Deepgram key needed)
- ✅ Your Twilio account for actual calls

**Total cost**: Only Twilio charges (same as before)!

---

## 💡 Pro Tips

1. **Bookmark the UI**: http://localhost:3010
2. **Save your API key** in a password manager
3. **Monitor calls** in the Dograh UI under "Runs"
4. **Check logs** if calls fail:
   ```powershell
   cd D:\Hivericks\dograh
   docker compose logs -f api
   ```

5. **Customize your agent** in the Dograh UI:
   - Edit prompts
   - Add tools
   - Configure variables
   - Test with web calls

---

## 🆘 Need Help?

If you're stuck:
1. Check Docker logs: `docker compose logs -f`
2. Verify all services are healthy: `docker compose ps`
3. Restart services: `docker compose restart`
4. Check the Dograh documentation: https://docs.dograh.com

---

**Next**: Once your account is created, proceed to create your agent and get the API key!
