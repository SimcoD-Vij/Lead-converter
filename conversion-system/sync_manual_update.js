const fs = require('fs');
const path = require('path');
const { calculateScore } = require('./scoring/scoring_engine');
const { generateFinalSummary } = require('./agent/salesBot');

const CALL_LOGS_FILE = path.join(__dirname, 'voice/call_logs.json');
const EVENTS_FILE = path.join(__dirname, 'processed_leads/LeadEvents.json');
const LEADS_FILE = path.join(__dirname, 'processed_leads/clean_leads.json');

const readJSON = (file) => {
    if (!fs.existsSync(file)) return [];
    return JSON.parse(fs.readFileSync(file, 'utf8'));
};

const writeJSON = (file, data) => fs.writeFileSync(file, JSON.stringify(data, null, 2));

const sync = async (quiet = false) => {
    if (!quiet) console.log("\n🔄 STARTING SYNC FROM CALL_LOGS.JSON...");

    // 1. Get Latst Log from call_logs.json (The one user edited)
    const logs = readJSON(CALL_LOGS_FILE);
    const lastLog = logs[logs.length - 1];

    if (!lastLog) {
        console.error("❌ No logs found.");
        return;
    }

    const { lead_id, event_id, summary } = lastLog;
    if (!quiet) {
        console.log(`   📄 Found Log: ${event_id} (${lead_id})`);
        console.log(`      Summary: ${summary.text_summary}`);
    }

    // 2. Update LeadEvents.json
    const events = readJSON(EVENTS_FILE);
    const leadRecord = events.find(l => l.lead_id === lead_id);

    if (!leadRecord) {
        console.error("❌ Lead record not found in LeadEvents.json for " + lead_id);
        return;
    }

    // Ensure array (it should be now)
    if (!Array.isArray(leadRecord.events)) {
        if (typeof leadRecord.events === 'object') leadRecord.events = Object.values(leadRecord.events);
        else leadRecord.events = [];
    }

    const eventIdx = leadRecord.events.findIndex(e => e.event_id === event_id);
    if (eventIdx !== -1) {
        leadRecord.events[eventIdx].summary = summary; // OVERWRITE with new summary
        if (!quiet) console.log("   ✅ Updated existing event in LeadEvents.json");
    } else {
        console.log("   ⚠️ Event ID not found in LeadEvents, adding it...");
        leadRecord.events.push({
            event_id: event_id,
            timestamp: lastLog.ended_at || new Date().toISOString(),
            summary: summary
        });
    }

    // Recompute Final Summary
    const allSummaries = leadRecord.events.map(e => ({ date: e.timestamp, summary: e.summary }));
    const finalSummary = await generateFinalSummary(allSummaries);
    leadRecord.final_summary = finalSummary;
    leadRecord.master_summary = summary.text_summary; // Update master context for next call

    writeJSON(EVENTS_FILE, events);
    if (!quiet) console.log("   💾 LeadEvents.json Saved.");

    // 3. Update clean_leads.json (Scoring)
    const leads = readJSON(LEADS_FILE);
    const leadIdx = leads.findIndex(l => l.phone === lead_id);

    if (leadIdx !== -1) {
        let updateStatus = 'CALL_COMPLETED';
        // Map Status based on new summary
        if (summary.interest_level === 'high' || summary.interest_level === 'medium') updateStatus = 'CALL_INTERESTED';
        if (summary.user_intent === 'explicit_refusal' || summary.interest_level === 'low') updateStatus = 'CALL_NOT_INTERESTED';

        const intentMap = { 'high': 'HOT', 'medium': 'WARM', 'low': 'COLD' };
        const leadIntent = intentMap[summary.interest_level] || 'COLD';

        console.log(`   🧮 Recalculating Score: Intent=${leadIntent}, Status=${updateStatus}`);

        const scoreResult = calculateScore(leads[leadIdx], leadIntent, updateStatus);

        leads[leadIdx].status = updateStatus;
        leads[leadIdx].score = scoreResult.score;
        leads[leadIdx].category = scoreResult.category;
        leads[leadIdx].last_call_summary = JSON.stringify(finalSummary);

        writeJSON(LEADS_FILE, leads);
        if (!quiet) console.log(`   💯 New Score: ${scoreResult.score} (${scoreResult.category})`);
    } else {
        if (!quiet) console.error("❌ Lead not found in clean_leads.json");
    }

    if (!quiet) console.log("✅ SYNC COMPLETE.\n");
};

if (require.main === module) {
    sync();
}

module.exports = { sync };
