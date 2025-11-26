// ---------------------------------------------------------
// TASK 3: VOICE ENGINE (FRESH BUILD)
// ---------------------------------------------------------
require('dotenv').config({ path: '../.env' });
const client = require('twilio')(process.env.TWILIO_SID, process.env.TWILIO_AUTH);
const fs = require('fs');
const path = require('path');

const LEADS_FILE = path.resolve(__dirname, '../processed_leads/clean_leads.json');
const SERVER_URL = process.env.SERVER_URL; // Ngrok URL

const runBatch = async () => {
    console.log("🚀 Starting Voice Engine...");

    // 1. Safety Checks
    if (!SERVER_URL) return console.log("❌ Missing SERVER_URL in .env");
    if (!fs.existsSync(LEADS_FILE)) return console.log("❌ Missing DB file");

    // 2. Load Leads
    let leads = JSON.parse(fs.readFileSync(LEADS_FILE, 'utf-8'));

    // 3. Filter: Find VERIFIED or CONTACTED leads
    const targets = leads.filter(l => 
        (l.status === "VERIFIED" || l.status === "CONTACTED") && 
        l.phone.length > 5
    );

    console.log(`📞 Found ${targets.length} leads to call.`);

    // 4. Call Loop
    for (const lead of targets) {
        try {
            console.log(`   ☎️ Dialing ${lead.name} (${lead.phone})...`);

            const call = await client.calls.create({
                url: `${SERVER_URL}/voice`,
                to: lead.phone,
                from: process.env.TWILIO_PHONE
            });

            console.log(`      ✅ Call Started! SID: ${call.sid}`);

            // --- CRITICAL: SAVE SID IMMEDIATELY ---
            // This links the Lead to the Call
            lead.status = "CALLED";
            lead.last_call_sid = call.sid; 
            lead.last_called = new Date().toISOString();

            // Write to disk NOW so the Brain can read it in 5 seconds
            fs.writeFileSync(LEADS_FILE, JSON.stringify(leads, null, 2));
            console.log("      💾 Database Updated (SID Saved).");

        } catch (error) {
            console.log(`      ❌ Error: ${error.message}`);
        }
    }
};

runBatch();