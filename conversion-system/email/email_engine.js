// ---------------------------------------------------------
// TASK 2: EMAIL OUTREACH ENGINE (STATE MACHINE)
// ---------------------------------------------------------

require('dotenv').config({ path: '../.env' });

// 👇 DEBUGGING BLOCK
console.log("--- DEBUG START ---");
console.log("1. Checking .env path:", require('path').resolve(__dirname, '../.env'));
console.log("2. Key loaded for User:", process.env.EMAIL_USER ? "YES" : "NO");
console.log("3. Key loaded for Pass:", process.env.EMAIL_PASS ? "YES" : "NO");
console.log("4. User Value:", process.env.EMAIL_USER);
console.log("--- DEBUG END ---\n");
// 👆 END DEBUGGING BLOCK

const fs = require('fs');
const path = require('path');
const nodemailer = require('nodemailer');
const { fillTemplate } = require('./templates');

// ---------------------------------------------------------
// CONFIGURATION
// ---------------------------------------------------------
const LEADS_FILE = path.join(__dirname, '../processed_leads/clean_leads.json');
const MAX_EMAILS_PER_HOUR = 10;
const DELAY_BETWEEN_EMAILS_MS = 5000;

// UPDATE: Tracking Domain (Points to your Tracking Server)
// If running locally via Ngrok, this should be your Ngrok URL (e.g., https://xyz.ngrok-free.app)
const TRACKING_DOMAIN = process.env.TRACKING_DOMAIN || 'http://localhost:5000';

// ---------------------------------------------------------
// 1. SETUP TRANSPORTER
// ---------------------------------------------------------
const createTransporter = async () => {
    if (process.env.EMAIL_USER && process.env.EMAIL_PASS) {
        console.log("   🔌 Connecting to Real Gmail...");

        return {
            transporter: nodemailer.createTransport({
                service: 'gmail',
                auth: {
                    user: process.env.EMAIL_USER,
                    pass: process.env.EMAIL_PASS
                }
            })
        };
    }

    console.log("   🧪 No Real Credentials → Using Ethereal Test Mode");

    const testAccount = await nodemailer.createTestAccount();

    return {
        transporter: nodemailer.createTransport({
            host: 'smtp.ethereal.email',
            port: 587,
            secure: false,
            auth: {
                user: testAccount.user,
                pass: testAccount.pass
            }
        })
    };
};

// ---------------------------------------------------------
// 2. DECIDE NEXT STEP (STATE MACHINE)
// ---------------------------------------------------------
const determineNextStep = (lead) => {
    if (["STOPPED", "REPLIED", "BOUNCED", "FAILED"].includes(lead.status))
        return null;

    const now = new Date();
    const lastContact = lead.last_contacted ? new Date(lead.last_contacted) : null;

    if (!lastContact || lead.stage === undefined) {
        return { stage: 1, template: "EMAIL_1" };
    }

    const diffTime = Math.abs(now - lastContact);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (lead.stage === 1 && diffDays >= 2) {
        return { stage: 2, template: "EMAIL_2" };
    }

    if (lead.stage === 2 && diffDays >= 4) {
        return { stage: 3, template: "EMAIL_3" };
    }

    return null;
};

// ---------------------------------------------------------
// 3. MAIN ENGINE
// ---------------------------------------------------------
const runEmailCampaign = async () => {
    console.log("🚀 Starting Email Campaign...");
    console.log(`   🎯 Edge Intelligence Domain: ${TRACKING_DOMAIN}`);

    if (!fs.existsSync(LEADS_FILE)) {
        console.log("❌ clean_leads.json not found. Run Task 1 first.");
        return;
    }

    let leads;
    try {
        leads = JSON.parse(fs.readFileSync(LEADS_FILE, 'utf-8'));
    } catch (e) {
        console.log("❌ JSON corrupt or unreadable.");
        return;
    }

    const { transporter } = await createTransporter();

    let emailsSentCount = 0;

    for (let i = 0; i < leads.length; i++) {
        const lead = leads[i];

        if (emailsSentCount >= MAX_EMAILS_PER_HOUR) {
            console.log("🛑 Hourly limit reached. Stopping batch.");
            break;
        }

        const nextStep = determineNextStep(lead);

        if (!nextStep) continue;

        console.log(`\n📧 Preparing ${nextStep.template} for ${lead.name}...`);

        const content = fillTemplate(nextStep.template, lead);

        if (!content) {
            console.log(`   ⚠️ Missing template for stage ${nextStep.stage}`);
            lead.last_error = `Template EMAIL_${nextStep.stage} missing`;
            continue;
        }

        // --- UPDATE START: EDGE INTELLIGENCE INJECTION ---
        
        // 1. Create Tracking Links
        const pixelUrl = `${TRACKING_DOMAIN}/track/open?email=${lead.email}`;
        // Destination can be changed to your real sales deck or meeting link
        const clickUrl = `${TRACKING_DOMAIN}/track/click?email=${lead.email}&dest=https://www.google.com`; 

        // 2. Build HTML Body
        const htmlBody = `
            <div style="font-family: Arial, sans-serif; color: #333;">
                <p>${content.body.replace(/\n/g, '<br>')}</p>
                <p>
                    <a href="${clickUrl}" style="color: #007bff; text-decoration: none; font-weight: bold;">
                        Click here to view details
                    </a>
                </p>
                <!-- INVISIBLE SPY PIXEL -->
                <img src="${pixelUrl}" width="1" height="1" alt="" style="display:none;" />
            </div>
        `;
        // --- UPDATE END ---

        try {
            const info = await transporter.sendMail({
                from: '"AI Sales Bot" <bot@company.com>',
                to: lead.email,
                subject: content.subject,
                text: content.body, // Fallback for old email clients
                html: htmlBody      // The Tracking Version
            });

            console.log(`   ✅ Sent! Preview: ${nodemailer.getTestMessageUrl(info) || "Sent via Gmail"}`);

            lead.stage = nextStep.stage;
            lead.last_contacted = new Date().toISOString();
            lead.status = "CONTACTED";
            lead.last_error = null;

            emailsSentCount++;

            await new Promise(resolve => setTimeout(resolve, DELAY_BETWEEN_EMAILS_MS));

        } catch (error) {
            console.log(`   ❌ Error sending: ${error.message}`);

            lead.status = "FAILED";
            lead.last_error = error.message;
            lead.last_attempted = new Date().toISOString();
        }
    }

    fs.writeFileSync(LEADS_FILE, JSON.stringify(leads, null, 2));
    console.log("\n💾 Campaign Progress Saved.");
};

runEmailCampaign();