# How to Get Your Dograh API Key

## The Problem

You're getting **401 Unauthorized** because the API key in your `.env` is invalid or expired.

```
Error: { detail: 'Unauthorized' }
Status: 401
```

---

## Solution: Get a New API Key

### Step 1: Go to Dograh Cloud Dashboard

Open: **https://app.dograh.com**

### Step 2: Navigate to API Keys

1. Click on your **profile/avatar** (top right)
2. Look for one of these menu items:
   - **"API Keys"**
   - **"Settings"** → **"API Keys"**
   - **"Developer"** → **"API Keys"**
   - **"Organization"** → **"API Keys"**

### Step 3: Create a New API Key

1. Click **"Create API Key"** or **"Generate New Key"**
2. Give it a name: `Conversion System Integration`
3. Copy the key (it will look like: `dgr_xxxxxxxxxxxxxxxxxxxxx`)

### Step 4: Update Your .env

Edit `D:\Hivericks\conversion-system\.env`:

```env
DOGRAH_API_KEY=dgr_YOUR_NEW_KEY_HERE
```

Replace `dgr_YOUR_NEW_KEY_HERE` with the key you just copied.

### Step 5: Restart Orchestrator

```powershell
# Stop current orchestrator (Ctrl+C)
cd D:\Hivericks\conversion-system\router
node orchestrator.js
```

### Step 6: Test Again

```powershell
cd D:\Hivericks\conversion-system
node unlock_lead.js
```

---

## Current Configuration

Your `.env` currently has:
```env
DOGRAH_API_URL=https://app.dograh.com  ✅
DOGRAH_AGENT_ID=1582  ✅
DOGRAH_API_KEY=dgr_REDACTED_EXPIRED_KEY  ❌ (invalid/expired)
```

---

## Visual Guide

```
┌─────────────────────────────────────────┐
│  Dograh Dashboard                       │
│  https://app.dograh.com                 │
├─────────────────────────────────────────┤
│                                         │
│  Profile → Settings → API Keys          │
│                                         │
│  ┌───────────────────────────────────┐ │
│  │ API Keys                          │ │
│  │                                   │ │
│  │ [+ Create New API Key]            │ │
│  │                                   │ │
│  │ Name: Conversion System           │ │
│  │ Key: dgr_xxxxxxxxxxxxxxxx         │ │
│  │ Created: 2026-02-11               │ │
│  │ [Copy] [Revoke]                   │ │
│  └───────────────────────────────────┘ │
└─────────────────────────────────────────┘
```

---

## After Getting the Key

1. ✅ Copy the new API key
2. ✅ Update `.env` with `DOGRAH_API_KEY=dgr_new_key`
3. ✅ Restart orchestrator
4. ✅ Test with `node unlock_lead.js`

The 401 error will be resolved! 🎉

---

## Alternative: Check Existing Key

If you already have an API key in Dograh dashboard:
1. Go to **API Keys** section
2. Check if the key starting with `dgr_REDACTED...` is listed
3. If it's there and active, it should work
4. If not, create a new one

---

**Next Step:** Get the API key from https://app.dograh.com and update your `.env` file.
