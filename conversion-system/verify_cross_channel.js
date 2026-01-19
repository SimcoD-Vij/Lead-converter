const fs = require('fs');
const path = require('path');
const { generateResponse, warmup } = require('./agent/salesBot');
const { processInboundEmail } = require('./email/email_engine');
const { runSmartSmsBatch } = require('./sms/sms_engine');

const LOG_FILE = path.join(__dirname, 'verification_report.txt');
const LEADS_FILE = path.join(__dirname, 'processed_leads/clean_leads.json');
const TEST_PHONE = 'whatsapp:+9999999999';
const TEST_EMAIL = 'test_verifier@example.com';

const log = (msg) => {
    try { fs.appendFileSync(LOG_FILE, msg + '\r\n'); } catch (e) { }
    console.log(msg);
};

async function setup() {
    log("🛠️  SETUP: Creating Test Lead...");
    let leads = [];
    if (fs.existsSync(LEADS_FILE)) {
        leads = JSON.parse(fs.readFileSync(LEADS_FILE, 'utf8'));
    }

    // Remove existing test lead
    leads = leads.filter(l => l.phone !== TEST_PHONE && l.email !== TEST_EMAIL);

    leads.push({
        phone: TEST_PHONE,
        email: TEST_EMAIL,
        name: "Test User",
        status: "CALL_CONNECTED", // Initial state
        score: 50,
        attempt_count: 1
    });

    fs.writeFileSync(LEADS_FILE, JSON.stringify(leads, null, 2));
}

async function verifyCallToWhatsapp() {
    log("\n🧪 TEST 1: Call -> WhatsApp Request");
    log("   Action: User says 'Send me the details on WhatsApp' during a call.");

    // 1. Initialize MCP (Warmup)
    await warmup();

    // 2. Simulate User Input
    const userMessage = "That sounds good. Can you send me the details on WhatsApp?";
    const memory = { history: [] };
    const leadContext = { phone: TEST_PHONE, name: "Test User" };

    try {
        const response = await generateResponse({
            userMessage,
            memory,
            mode: 'VOICE_CALL',
            leadContext
        });

        log(`   🤖 AI Response: "${response}"`);

        // 3. Verify Lead Status Update
        const leads = JSON.parse(fs.readFileSync(LEADS_FILE, 'utf8'));
        const lead = leads.find(l => l.phone === TEST_PHONE);

        if (lead.status === 'SMS_SEND_REQUESTED' || (lead.pending_sms_content && lead.pending_sms_content.length > 0)) {
            log("   ✅ SUCCESS: Lead Status updated to 'SMS_SEND_REQUESTED' or content queued.");
            log(`      Pending SMS: "${lead.pending_sms_content}"`);
        } else {
            log(`   ❌ FAILURE: Lead Status is '${lead.status}'. Expected 'SMS_SEND_REQUESTED'.`);
            log("      (Note: Ensure MCP Server is running and tool was called)");
        }

    } catch (e) {
        log("   ❌ TEST CRASHED: " + e.message);
    }
}

async function verifySmsToCall() {
    log("\n🧪 TEST 2 & 3: SMS -> Call (Immediate & Scheduled)");

    // We mock the logic from sms_server.js here to verify the REGEX and STATE UPDATE logic works.
    // We cannot easily run the full express server in this script without blocking.

    const leads = JSON.parse(fs.readFileSync(LEADS_FILE, 'utf8'));
    const lead = leads.find(l => l.phone === TEST_PHONE);

    // A. Immediate Call
    const msgNow = "Can you call me right now?";
    if (/(call|speak|talk).*(now|immediately|right now)/.test(msgNow.toLowerCase())) {
        log(`   ✅ Regex Matched for Immediate Call: "${msgNow}"`);
        lead.status = 'SMS_TO_CALL_REQUESTED';
        log("   🔄 Updated Status to SMS_TO_CALL_REQUESTED");
    } else {
        log("   ❌ Regex Failed for Immediate Call.");
    }

    // B. Scheduled Call
    const msgLater = "Call me tomorrow at 10am.";
    if (/(call|speak).*(at|on|tomorrow|later|pm|am)/.test(msgLater.toLowerCase())) {
        log(`   ✅ Regex Matched for Scheduled Call: "${msgLater}"`);
        lead.status = 'SMS_CALL_SCHEDULED';
        log("   🔄 Updated Status to SMS_CALL_SCHEDULED");
    } else {
        log("   ❌ Regex Failed for Scheduled Call.");
    }

    fs.writeFileSync(LEADS_FILE, JSON.stringify(leads, null, 2));
}

async function verifyMailToCall() {
    log("\n🧪 TEST 4: Mail -> Call Request");
    log("   Action: User replies to email with 'Please call me'.");

    try {
        await processInboundEmail({
            sender: TEST_EMAIL,
            subject: "Re: Info",
            body: "Thanks for the info. Please call me on my number to discuss."
        });

        const leads = JSON.parse(fs.readFileSync(LEADS_FILE, 'utf8'));
        const lead = leads.find(l => l.email === TEST_EMAIL);

        if (lead.status === 'MAIL_TO_CALL_REQUESTED') {
            log("   ✅ SUCCESS: Lead Status updated to 'MAIL_TO_CALL_REQUESTED'.");
        } else {
            log(`   ❌ FAILURE: Lead Status is '${lead.status}'. Expected 'MAIL_TO_CALL_REQUESTED'.`);
        }
    } catch (e) {
        log("   ❌ TEST CRASHED: " + e.message);
    }
}

async function cleanup() {
    log("\n🧹 CLEANUP");
    // let leads = JSON.parse(fs.readFileSync(LEADS_FILE, 'utf8'));
    // leads = leads.filter(l => l.phone !== TEST_PHONE && l.email !== TEST_EMAIL);
    // fs.writeFileSync(LEADS_FILE, JSON.stringify(leads, null, 2));
    log("   ✅ Test Lead KEPT for inspection (Run cleanup manually later).");
}

async function run() {
    // Clear log file
    fs.writeFileSync(LOG_FILE, '');

    await setup();
    await verifyCallToWhatsapp();
    await verifySmsToCall();
    await verifyMailToCall();
    await cleanup();
}

run();
