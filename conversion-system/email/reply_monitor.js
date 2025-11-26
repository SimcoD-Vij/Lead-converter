// ---------------------------------------------------------
// TASK 2 EXTENSION: INBOX REPLY MONITOR (FIXED SSL)
// ---------------------------------------------------------
require('dotenv').config({ path: '../.env' });
const imaps = require('imap-simple');
const { simpleParser } = require('mailparser');
const fs = require('fs');
const path = require('path');

// CONFIG
const LEADS_FILE = path.join(__dirname, '../processed_leads/clean_leads.json');
const CHECK_INTERVAL = 60000; 

const INTENTS = {
    INTERESTED: ['yes', 'sure', 'interested', 'call me', 'schedule', 'demo', 'time'],
    STOP: ['stop', 'unsubscribe', 'remove', 'spam', 'not interested', 'no thanks']
};

// 1. IMAP CONFIGURATION (Updated with SSL Fix)
const config = {
    imap: {
        user: process.env.EMAIL_USER,
        password: process.env.EMAIL_PASS,
        host: 'imap.gmail.com',
        port: 993,
        tls: true,
        authTimeout: 10000, // Increased timeout to 10s
        tlsOptions: { 
            rejectUnauthorized: false // <--- THE FIX: Allow self-signed certs (Antivirus/Proxy)
        }
    }
};

// 2. HELPER: UPDATE LEAD STATUS
const updateLead = (emailFrom, status, snippet) => {
    if (!fs.existsSync(LEADS_FILE)) return;
    
    const leads = JSON.parse(fs.readFileSync(LEADS_FILE, 'utf-8'));
    
    // Normalize email (case insensitive)
    const lead = leads.find(l => l.email.toLowerCase() === emailFrom.toLowerCase());

    if (lead) {
        console.log(`   🎯 MATCH FOUND: ${lead.name}`);
        
        // Only update if we haven't already marked them
        if (lead.status !== "STOPPED" && lead.status !== "INTERESTED") {
            
            lead.status = status;
            lead.last_reply = new Date().toISOString();
            lead.last_reply_snippet = snippet; 

            fs.writeFileSync(LEADS_FILE, JSON.stringify(leads, null, 2));
            console.log(`   💾 Updated Status to: ${status}`);
        }
    } else {
        console.log(`   ⚠️ Unknown Sender: ${emailFrom} (Not in lead list)`);
    }
};

// 3. ANALYZE EMAIL BODY
const analyzeIntent = (text) => {
    const lowerText = text.toLowerCase();
    
    if (INTENTS.STOP.some(word => lowerText.includes(word))) {
        return "STOPPED";
    }
    if (INTENTS.INTERESTED.some(word => lowerText.includes(word))) {
        return "INTERESTED";
    }
    
    return "REPLIED"; 
};

// 4. MAIN CHECKER FUNCTION
const checkInbox = async () => {
    console.log("\n📬 Checking Inbox for new replies...");

    try {
        const connection = await imaps.connect(config);
        await connection.openBox('INBOX');

        // Search for UNSEEN emails
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
            const all = item.parts.find(part => part.which === 'TEXT');
            const id = item.attributes.uid;
            const idHeader = "Imap-Id: "+id+"\r\n";
            
            const mail = await simpleParser(idHeader + all.body);
            
            const fromAddress = mail.from.value[0].address;
            const subject = mail.subject;
            const bodyText = mail.text; 

            console.log(`   📩 From: ${fromAddress} | Sub: ${subject}`);
            
            const sentiment = analyzeIntent(bodyText);
            const snippet = bodyText.substring(0, 100).replace(/\n/g, ' ');

            updateLead(fromAddress, sentiment, snippet);
        }

        connection.end();

    } catch (error) {
        console.log("❌ IMAP Error:", error.message);
        if (error.message.includes("AUTHENTICATIONFAILED")) {
            console.log("   👉 Tip: Check .env EMAIL_PASS (Must be App Password)");
        }
    }
};

checkInbox();