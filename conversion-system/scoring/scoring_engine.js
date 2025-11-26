// ---------------------------------------------------------
// TASK 5: LEAD SCORING ENGINE (DATA-AWARE VERSION)
// ---------------------------------------------------------
const fs = require('fs');
const path = require('path');

// DATA SOURCES
const LEADS_FILE = path.resolve(__dirname, '../processed_leads/clean_leads.json');
// We keep call logs as a backup source, but prioritize the lead file
const CALL_LOGS_FILE = path.resolve(__dirname, '../processed_leads/call_logs.json');

// SCORING RULES
const POINTS = {
    // BASELINE (Data Quality)
    VALID_EMAIL: 5,
    VALID_PHONE: 5,

    // ACTIVITY (Effort)
    SENT_EMAIL: 1,
    TRIED_CALL: 1,
    SENT_SMS: 1,

    // ENGAGEMENT (High Value)
    EMAIL_OPEN: 5,
    EMAIL_CLICK: 10,
    VOICE_INTERESTED: 40, // Pressed 1
    VOICE_CALLBACK: 10,   // Pressed 2
    REPLIED_ANY: 20       // SMS/WhatsApp/Email Reply
};

const THRESHOLD = { HOT: 50, WARM: 20 };

// ---------------------------------------------------------
// 1. HELPER: SAFE FILE READER
// ---------------------------------------------------------
const loadJSON = (filePath) => {
    if (!fs.existsSync(filePath)) return [];
    try {
        const content = fs.readFileSync(filePath, 'utf-8');
        if (!content.trim()) return []; 
        return JSON.parse(content);
    } catch (e) {
        return [];
    }
};

// ---------------------------------------------------------
// 2. HELPER: CALCULATE SCORE
// ---------------------------------------------------------
const scoreLead = (lead) => {
    let score = 0;
    let reasons = []; 

    // --- A. BASELINE SCORING ---
    if (lead.email) score += POINTS.VALID_EMAIL;
    if (lead.phone) score += POINTS.VALID_PHONE;

    // --- B. ACTIVITY SCORING ---
    if (lead.stage > 0) {
        score += POINTS.SENT_EMAIL;
    }
    if (lead.last_called) {
        score += POINTS.TRIED_CALL;
    }
    if (lead.last_sms_time) {
        score += POINTS.SENT_SMS;
    }

    // --- C. ENGAGEMENT SCORING (The Fix) ---
    
    // 1. Voice Interaction (Check 'last_response_digit' inside the lead object)
    if (lead.last_response_digit) {
        if (lead.last_response_digit === '1') {
            score += POINTS.VOICE_INTERESTED;
            reasons.push("Voice: Interested");
        } else if (lead.last_response_digit === '2') {
            score += POINTS.VOICE_CALLBACK;
            reasons.push("Voice: Call Later");
        }
    }

    // 2. Message Interaction (Check 'last_reply' timestamp)
    if (lead.last_reply) {
        score += POINTS.REPLIED_ANY;
        reasons.push("Msg Reply Received");
    }

    // 3. Email Tracking (Check 'opened' / 'clicked')
    if (lead.opened) {
        score += POINTS.EMAIL_OPEN;
        reasons.push("Opened Email");
    }
    if (lead.clicked) {
        score += POINTS.EMAIL_CLICK;
        reasons.push("Clicked Link");
    }

    // --- D. CATEGORIZE ---
    let category = "❄️ COLD";
    let action = "Nurture";

    if (score >= THRESHOLD.HOT) {
        category = "🔥 HOT";
        action = "CALL NOW (Human)";
    } else if (score >= THRESHOLD.WARM) {
        category = "🌤️ WARM";
        action = "Send SMS";
    }

    if (reasons.length === 0) reasons.push("Profiling Only");

    return { score, category, action, breakdown: reasons.join(", ") };
};

// ---------------------------------------------------------
// 3. MAIN PROCESS
// ---------------------------------------------------------
const runScoring = () => {
    console.log("🧠 Starting Scoring Engine...\n");

    const leads = loadJSON(LEADS_FILE);

    if (leads.length === 0) {
        console.log("❌ No leads found.");
        return;
    }

    console.log("-----------------------------------------------------------------------------------------");
    console.log(
        "NAME".padEnd(20) + 
        "SCORE".padEnd(8) + 
        "CATEGORY".padEnd(12) + 
        "ACTION".padEnd(20) +
        "REASONS"
    );
    console.log("-----------------------------------------------------------------------------------------");

    const scoredLeads = leads.map(lead => {
        const result = scoreLead(lead);
        
        console.log(
            lead.name.padEnd(20) + 
            result.score.toString().padEnd(8) + 
            result.category.padEnd(12) + 
            result.action.padEnd(20) +
            result.breakdown
        );

        return {
            ...lead,
            score: result.score,
            category: result.category,
            intelligence_action: result.action,
            last_scored: new Date().toISOString()
        };
    });

    fs.writeFileSync(LEADS_FILE, JSON.stringify(scoredLeads, null, 2));
    console.log("\n💾 Scoring Complete. Database updated.");
};

runScoring();