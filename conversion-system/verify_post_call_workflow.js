const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const LEADS_FILE = path.join(__dirname, 'processed_leads/clean_leads.json');
const SMS_QUEUE_FILE = path.join(__dirname, 'sms/inbound_sms_queue.json');
const ORCHESTRATOR_PATH = path.join(__dirname, 'router/orchestrator.js');

async function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function runTest() {
    console.log("🚀 STARTING POST-CALL WORKFLOW SIMULATION...");

    // 1. SETUP: Reset Lead State
    console.log("   📝 PHASE 1: Flagging Lead for Post-Call Action...");
    const leads = JSON.parse(fs.readFileSync(LEADS_FILE, 'utf8'));
    // Find Vijay or create mock
    let lead = leads.find(l => l.phone.includes("7604896187")) || leads[0];
    lead.post_call_action_pending = true;
    lead.last_call_summary = JSON.stringify({ conversation_summary: "Discussed XOptimus durability." });
    fs.writeFileSync(LEADS_FILE, JSON.stringify(leads, null, 2));
    console.log("   ✅ Lead flagged.");

    // 2. START ORCHESTRATOR
    console.log("   🔌 PHASE 2: Launching Orchestrator...");
    const orchestrator = spawn('node', [ORCHESTRATOR_PATH], { stdio: 'pipe', shell: true });

    let feedbackSent = false;
    let replyQueued = false;
    let replyProcessed = false;

    orchestrator.stdout.on('data', (data) => {
        const log = data.toString();
        // verbose: process.stdout.write(log);

        // CHECK 1: Did it send feedback?
        if (log.includes("Sent SMS Feedback Req") && !feedbackSent) {
            console.log("   ✅ PHASE 3 PASS: Orchestrator sent Feedback Request.");
            feedbackSent = true;

            // TRIGGER PHASE 4: Simulated Reply (AFTER feedback sent)
            setTimeout(simulateUserReply, 2000);
        }

        // CHECK 2: Did it process the queue?
        if (log.includes("QUEUE MANAGER: Processing") || log.includes("Interrupted Outbound")) {
            console.log("   ⚡ Orchestrator noticed the queue!");
        }

        if (log.includes("AI Speed:") && feedbackSent && replyQueued) {
            console.log("   ✅ PHASE 5 PASS: AI Responded to queued message.");
            replyProcessed = true;
            cleanUp(orchestrator);
        }
    });

    orchestrator.stderr.on('data', (data) => console.error(`[ERR] ${data}`));

    function simulateUserReply() {
        console.log("   📨 PHASE 4: Simulating User Reply to Queue...");
        const queue = [];
        queue.push({
            lead_id: lead.phone,
            message: "I received your feedback text. But the price is still high.",
            timestamp: new Date().toISOString()
        });
        fs.writeFileSync(SMS_QUEUE_FILE, JSON.stringify(queue, null, 2));
        replyQueued = true;
        console.log("   ✅ User Reply Queued.");
    }

    // Safety Timeout
    setTimeout(() => {
        if (!replyProcessed) {
            console.error("   ❌ TEST TIMEOUT: Orchestrator took too long.");
            cleanUp(orchestrator);
        }
    }, 40000);
}

function cleanUp(proc) {
    console.log("\n🛑 TEST COMPLETE. Stopping Orchestrator...");
    proc.kill();
    process.exit(0);
}

runTest();
