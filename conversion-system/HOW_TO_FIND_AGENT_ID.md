# How to Find Your Agent ID in Dograh

## Quick Answer

The **Agent ID** is in the **browser URL** when you open your agent!

---

## Step-by-Step Guide

### 1. Open Dograh UI

Go to: **http://localhost:3010**

You'll see your dashboard with a list of agents.

### 2. Click on Your Agent

Find your agent in the list (e.g., "Sales Bot") and click **"View"** button.

### 3. Look at the Browser URL

The URL will look like this:

```
http://localhost:3010/workflow/123
                                ^^^
                            This is your Agent ID!
```

**Examples:**
- `http://localhost:3010/workflow/1` → Agent ID is `1`
- `http://localhost:3010/workflow/42` → Agent ID is `42`
- `http://localhost:3010/workflow/789` → Agent ID is `789`

### 4. Copy the ID

Just copy the number at the end of the URL.

---

## Alternative Method: Using Browser Developer Tools

If you want to see the ID without opening the agent:

1. Open Dograh UI: http://localhost:3010
2. Press **F12** to open Developer Tools
3. Go to **Network** tab
4. Click on your agent
5. Look for API call to `/api/v1/workflow/fetch/{id}`
6. The `{id}` is your Agent ID

---

## Using the ID in Your .env

Once you have the ID, update your `.env` file:

```env
# Example: If your URL is http://localhost:3010/workflow/5
DOGRAH_AGENT_ID=5
```

**Full example:**
```env
USE_DOGRAH_AI=true
DOGRAH_API_URL=http://localhost:8000
DOGRAH_AGENT_ID=5  # ← Your agent ID here
```

---

## Troubleshooting

### "I don't see any agents"

1. Make sure you created an agent:
   - Click **"New Agent"** or **"Create Agent"**
   - Fill in name and configuration
   - Click **"Save"**

2. Check if you're logged in:
   - You should see your email in the top right
   - If not, log in or create an account

### "The URL doesn't show a number"

If the URL looks like:
```
http://localhost:3010/workflow/create
```

This means you're on the "create new agent" page, not viewing an existing agent.

**Solution:**
1. Go back to the main dashboard
2. Find your saved agent in the list
3. Click **"View"** button
4. Now the URL will show the ID

### "I see multiple numbers in the URL"

If you see:
```
http://localhost:3010/workflow/5/run/123
```

The **first number** is your Agent ID (in this case, `5`).

---

## Quick Test

To verify you have the right ID:

```powershell
# Replace 5 with your agent ID
curl http://localhost:8000/api/v1/workflow/fetch/5
```

If it returns agent details, you have the correct ID!

---

## Visual Example

```
┌─────────────────────────────────────────────────────────┐
│  Dograh Dashboard                                       │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  Agent Name       Created At      Total Runs  Actions  │
│  ───────────────────────────────────────────────────── │
│  Sales Bot        Feb 11, 2026    0           [View]   │ ← Click here
│  Support Bot      Feb 10, 2026    5           [View]   │
│                                                         │
└─────────────────────────────────────────────────────────┘

                        ↓ Click "View"

┌─────────────────────────────────────────────────────────┐
│  Browser URL:                                           │
│  http://localhost:3010/workflow/1                       │
│                                     ^                   │
│                                     └─ This is your ID! │
└─────────────────────────────────────────────────────────┘
```

---

## Summary

✅ **Agent ID** = Number in URL after `/workflow/`  
✅ **Where to find**: Click "View" on your agent  
✅ **Where to use**: Put in `.env` as `DOGRAH_AGENT_ID=...`  

That's it! 🎉
