// ---------------------------------------------------------
// TASK 2 EXTENSION: INBOX REPLY MONITOR (DEBUG MODE)
// ---------------------------------------------------------
require('dotenv').config({ path: '../.env' });
const imaps = require('imap-simple');
const { simpleParser } = require('mailparser');
const fs = require('fs');
const path = require('path');

// CONFIG
const LEADS_FILE = path.join(__dirname, '../processed_leads/clean_leads.json');

// KEYWORDS
const INTENTS = {
    INTERESTED: ['yes', 'sure', 'interested', 'call me', 'schedule', 'demo', 'time'],
    STOP: ['stop', 'unsubscribe', 'remove', 'spam', 'not interested', 'no thanks']
};

const config = {
    imap: {
        user: process.env.EMAIL_USER,
        password: process.env.EMAIL_PASS,
        host: 'imap.gmail.com',
        port: 993,
        tls: true,
        authTimeout: 10000,
        tlsOptions: { rejectUnauthorized: false }
    }
};

// HELPER: UPDATE LEAD
const updateLead = (emailFrom, status, snippet) => {
    console.log(`   🔎 Searching database for: ${emailFrom}`);
    
    if (!fs.existsSync(LEADS_FILE)) return console.log("   ❌ Error: DB File missing.");
    
    const leads = JSON.parse(fs.readFileSync(LEADS_FILE, 'utf-8'));
    
    // STRICTER MATCHING: Extract plain email from string like "John <john@gmail.com>"
    const cleanEmail = emailFrom.match(/([a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+\.[a-zA-Z0-9._-]+)/gi);
    const targetEmail = cleanEmail ? cleanEmail[0].toLowerCase() : emailFrom.toLowerCase();

    const lead = leads.find(l => l.email.toLowerCase() === targetEmail);

    if (lead) {
        console.log(`   ✅ FOUND: ${lead.name} (Current Status: ${lead.status})`);
        
        // UPDATE
        lead.status = status;
        lead.last_reply = new Date().toISOString();
        lead.last_reply_snippet = snippet; 

        fs.writeFileSync(LEADS_FILE, JSON.stringify(leads, null, 2));
        console.log(`   💾 SUCCESS: Updated status to "${status}"`);
    } else {
        console.log(`   ⚠️ FAILED: Could not find lead with email "${targetEmail}"`);
    }
};

// ANALYZE INTENT
const analyzeIntent = (text) => {
    const lowerText = (text || "").toLowerCase();
    console.log(`   🧠 Analyzing Text: "${lowerText.substring(0, 50)}..."`);
    
    if (INTENTS.STOP.some(word => lowerText.includes(word))) {
        console.log("      👉 Detected STOP intent");
        return "STOPPED";
    }
    if (INTENTS.INTERESTED.some(word => lowerText.includes(word))) {
        console.log("      👉 Detected INTERESTED intent");
        return "INTERESTED";
    }
    
    console.log("      👉 Detected NEUTRAL intent");
    return "REPLIED"; 
};

// MAIN CHECKER
const checkInbox = async () => {
    console.log("\n📬 Checking Inbox for new replies...");

    try {
        const connection = await imaps.connect(config);
        await connection.openBox('INBOX');

        const searchCriteria = ['UNSEEN'];
        const fetchOptions = { bodies: ['HEADER', 'TEXT'], markSeen: true }; 

        const messages = await connection.search(searchCriteria, fetchOptions);

        if (messages.length === 0) {
            console.log("   (No new unread emails found)");
            connection.end();
            return;
        }

        console.log(`   Found ${messages.length} new messages.`);

        for (const item of messages) {
            try {
                const all = item.parts.find(part => part.which === 'TEXT');
                const id = item.attributes.uid;
                const idHeader = "Imap-Id: "+id+"\r\n";
                
                const mail = await simpleParser(idHeader + all.body);
                
                // Safety Check
                if (!mail.from || !mail.from.value || !mail.from.value[0]) continue;

                const fromAddress = mail.from.value[0].address; // Use address property directly
                const subject = mail.subject;
                const bodyText = mail.text; 

                console.log(`\n   📩 NEW MAIL From: ${fromAddress}`);
                
                const sentiment = analyzeIntent(bodyText);
                const snippet = bodyText ? bodyText.substring(0, 100).replace(/\n/g, ' ') : "No Content";

                updateLead(fromAddress, sentiment, snippet);

            } catch (parseError) {
                console.log(`   ⚠️ Parse Error: ${parseError.message}`);
            }
        }

        connection.end();

    } catch (error) {
        console.log("❌ IMAP Error:", error.message);
    }
};

checkInbox();