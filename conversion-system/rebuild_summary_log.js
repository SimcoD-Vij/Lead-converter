
const fs = require('fs');
const path = require('path');
const { generateTextSummary } = require('./agent/salesBot');

const CALL_LOGS_FILE = path.join(__dirname, 'voice', 'call_logs.json');
const SUMMARY_LOGS_FILE = path.join(__dirname, 'voice', 'summary_calls.json');

// Helper
const readJSON = (file, def) => {
    try {
        if (fs.existsSync(file)) return JSON.parse(fs.readFileSync(file, 'utf8'));
    } catch (e) { console.error("Read Error:", e); }
    return def;
};
const writeJSON = (file, data) => fs.writeFileSync(file, JSON.stringify(data, null, 2));

async function run() {
    console.log("🚀 STARTING SUMMARY BACKFILL...");

    const logs = readJSON(CALL_LOGS_FILE, []);
    const summaries = readJSON(SUMMARY_LOGS_FILE, []);
    const existingSids = new Set(summaries.map(s => s.sid));

    console.log(`   📂 Found ${logs.length} Total Call Logs.`);
    console.log(`   📘 Found ${summaries.length} Existing Summaries.`);

    for (const log of logs) {
        if (!log.sid) continue;
        if (existingSids.has(log.sid)) {
            process.stdout.write('.'); // Skip visual
            continue;
        }

        console.log(`\n   ⚡ Processing: ${log.sid} (${log.lead_id})`);

        // Build Transcript
        const transcript = log.conversation
            .filter(m => m.role) // simple check
            .map(m => `${m.role.toUpperCase()}: ${m.message}`)
            .join('\n');

        if (transcript.length < 50) {
            console.log("      ⚠️ Transcript too short/empty. Skipping.");
            continue;
        }

        // Generate
        const text = await generateTextSummary(transcript);
        console.log(`      📝 Summary: "${text.substring(0, 60)}..."`);

        // Save
        summaries.push({
            event_id: log.event_id || `evt_${Date.now()}`,
            lead_id: log.lead_id,
            sid: log.sid,
            generated_at: new Date().toISOString(),
            summary_text: text
        });

        // Write immediately to be safe
        writeJSON(SUMMARY_LOGS_FILE, summaries);
    }

    console.log("\n✅ BACKFILL COMPLETE.");
}

run();
