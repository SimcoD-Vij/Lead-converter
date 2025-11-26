// ---------------------------------------------------------
// UTILITY: MERGE CALL LOGS INTO MASTER DATA
// ---------------------------------------------------------
const fs = require('fs');
const path = require('path');

const LEADS_FILE = path.resolve(__dirname, '../processed_leads/clean_leads.json');
const LOGS_FILE = path.resolve(__dirname, '../processed_leads/call_logs.json');

const mergeData = () => {
    console.log("🔄 Starting Data Merge...");

    // 1. Check clean_leads.json (Target)
    if (!fs.existsSync(LEADS_FILE)) {
        console.log("❌ CRITICAL: clean_leads.json not found. Run Task 1 (Importer) first.");
        return;
    }

    // 2. Check call_logs.json (Source)
    if (!fs.existsSync(LOGS_FILE)) {
        console.log("ℹ️ No call logs found yet. Make some calls first!");
        return;
    }

    // 3. Load Data
    let leads = [];
    let logs = [];

    try {
        leads = JSON.parse(fs.readFileSync(LEADS_FILE, 'utf-8'));
        logs = JSON.parse(fs.readFileSync(LOGS_FILE, 'utf-8'));
    } catch (e) {
        console.log("❌ Error reading JSON files:", e.message);
        return;
    }

    console.log(`   Loaded ${leads.length} Leads and ${logs.length} Call Logs.`);

    let updatesCount = 0;

    // 4. Merge Logic
    logs.forEach(log => {
        // Find lead with matching phone 
        // (We normalize by removing spaces just in case)
        const lead = leads.find(l => {
            // Handle cases where l.phone might be null or undefined
            if (!l.phone) return false;
            return l.phone.replace(/\s/g, '') === log.phone.replace(/\s/g, '');
        });

        if (lead) {
            // Check if we actually have new info to add
            // We prioritized the latest log status
            if (lead.status !== log.status || lead.last_response_digit !== log.digit_pressed) {
                
                // UPDATE: Just the user preference and status
                lead.status = log.status;       // e.g., "INTERESTED"
                lead.interest = log.interest;   // e.g., "HIGH"
                lead.last_response_digit = log.digit_pressed; // e.g., "1", "2", "3"
                lead.last_updated = log.timestamp;

                updatesCount++;
                console.log(`   👉 Updated ${lead.name}: Pressed ${log.digit_pressed} (${log.status})`);
            }
        }
    });

    // 5. Save Result
    if (updatesCount > 0) {
        fs.writeFileSync(LEADS_FILE, JSON.stringify(leads, null, 2));
        console.log(`✅ Merge Complete. Updated ${updatesCount} leads in clean_leads.json`);
    } else {
        console.log("✅ No new updates found to merge.");
    }
};

mergeData();