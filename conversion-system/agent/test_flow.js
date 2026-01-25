const { generateTextSummary, generateFeedbackRequest } = require('./salesBot');
const { sendEmail } = require('../email/email_engine');
const { validateEmailContent } = require('../utils/emailValidator'); // Import Validator

// MOCK DATA
const mockTranscript = `
ASSISTANT: Hello, thanks for calling Hivericks. This is Vijay.
USER: Hi, I was looking at your XOptimus charger. Does it support fast charging for iPhone 15?
ASSISTANT: Yes, absolutely. It supports standard USB-PD which works perfectly with iPhone 15. It regulates heat to protect the battery.
USER: That sounds good. What is the price?
ASSISTANT: It is currently ₹1499.
USER: Okay, can you email me these details? and maybe a link to buy?
ASSISTANT: Sure, I have your email on file. I'll send that right over.
`;

const mockLead = {
    email: "rsvijaypargavan@gmail.com",
    phone: "+917604896187",
    name: "Vijay Pargavan"
};

(async () => {
    console.log("🚀 STARTING GENERATION FLOW VERIFICATION");
    console.log("-----------------------------------------");

    // 1. TEST SUMMARIZATION
    console.log("1️⃣  Step 1: Generating Summary from Transcript...");
    const summary = await generateTextSummary(mockTranscript);
    console.log(`   📝 RESULT: "${summary}"`);

    if (summary.includes("Summary unavailable")) {
        console.error("   ❌ Summary Failed!");
        process.exit(1);
    }

    // 2. TEST EMAIL DRAFTING
    console.log("\n2️⃣  Step 2: Drafting Email based on Summary...");

    let fullMsg = "";
    let isValid = false;
    let attempts = 0;
    const MAX_ATTEMPTS = 2;

    while (!isValid && attempts < MAX_ATTEMPTS) {
        attempts++;
        console.log(`\n🔄 Attempt ${attempts}/${MAX_ATTEMPTS}: Generating Email...`);

        fullMsg = await generateFeedbackRequest(summary, 'EMAIL', mockLead.name);

        const validation = validateEmailContent(fullMsg.trim());
        if (validation.valid) {
            isValid = true;
            console.log("✅ VALIDATION PASSED (MNC Standards Met)");
        } else {
            console.warn(`⚠️ Validation Failed: ${validation.reason}`);
        }
    }

    if (!isValid) {
        console.error(`\n❌ ALL ATTEMPTS FAILED.`);
        console.log(`LAST OUTPUT: ${fullMsg}`);
        process.exit(1);
    }

    // PARSE & CLEAN (Mimic Orchestrator)
    let subject = "Follow up from Hivericks";
    let body = fullMsg;

    const subjectMatch = fullMsg.match(/SUBJECT:\s*(.+)(\r?\n|$)/i);
    if (subjectMatch) {
        subject = subjectMatch[1].trim();
        body = fullMsg.replace(subjectMatch[0], '').trim();
        // Aggressive Cleaning Loop
        let lines = body.split(/\r?\n/);
        while (lines.length > 0 && (
            lines[0].trim() === '' ||
            lines[0].match(/^(Here|Start|Generated|Begin|Draft|Subject|Output|Context)/i) ||
            lines[0].match(/^[A-Z\s]+:?$/) ||
            lines[0].match(/^-+$/)
        )) {
            lines.shift();
        }
        body = lines.join('\n').trim();
    }

    console.log(`   📧 DRAFT SUBJECT: ${subject}`);
    console.log(`   📄 DRAFT BODY:\n${body}\n`);

    // 3. TEST SENDING (Live Test)
    console.log("3️⃣  Step 3: Attempting to Send Email...");
    try {
        const sent = await sendEmail(mockLead, subject, body);
        if (sent) console.log("   ✅ Email Sent Successfully! (Check Inbox)");
        else console.log("   ❌ Email Sending Failed (Check Logs).");
    } catch (e) {
        console.error("   ❌ Error Sending:", e);
    }

    console.log("-----------------------------------------");
})();
