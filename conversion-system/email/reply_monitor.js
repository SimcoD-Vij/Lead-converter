// ---------------------------------------------------------
// TASK 2+: EMAIL AI RESPONDER (HEADER FIX - FULL VERSION)
// ---------------------------------------------------------

require('dotenv').config({ path: '../.env' });

const imaps = require('imap-simple');
const { simpleParser } = require('mailparser');
const nodemailer = require('nodemailer');
const { generateResponse } = require('../ai/ollama_engine');

// ---------------------------------------------------------
// IMAP CONFIG
// ---------------------------------------------------------

const config = {
    imap: {
        user: process.env.EMAIL_USER,
        password: process.env.EMAIL_PASS,
        host: 'imap.gmail.com',
        port: 993,
        tls: true,
        tlsOptions: { rejectUnauthorized: false },
        authTimeout: 15000
    }
};

// ---------------------------------------------------------
// HELPER: SEND AI REPLY
// ---------------------------------------------------------

const sendReply = async (toEmail, subject, aiBody) => {
    console.log("      🚀 STEP 4: Initializing SMTP...");

    try {
        const transporter = nodemailer.createTransport({
            service: 'gmail',
            auth: {
                user: process.env.EMAIL_USER,
                pass: process.env.EMAIL_PASS
            }
        });

        console.log(`      🚀 STEP 5: Sending reply to ${toEmail}...`);

        await transporter.sendMail({
            from: process.env.EMAIL_USER,
            to: toEmail,
            subject: `Re: ${subject}`,
            text: aiBody
        });

        console.log(`      ✅ STEP 6: Email SENT Successfully!`);
        return true;

    } catch (e) {
        console.log(`      ❌ SMTP ERROR: ${e.message}`);
        return false;
    }
};

// ---------------------------------------------------------
// MAIN: CHECK INBOX & AUTO-REPLY
// ---------------------------------------------------------

const checkAndReply = async () => {
    console.log("\n📬 Checking Inbox for AI Auto-Response...");

    try {
        const connection = await imaps.connect(config);
        await connection.openBox('INBOX');

        const searchCriteria = ['UNSEEN'];
        const fetchOptions = { bodies: ['HEADER', 'TEXT'], markSeen: false };

        const messages = await connection.search(searchCriteria, fetchOptions);

        if (messages.length === 0) {
            console.log("   (No new emails)");
            connection.end();
            return;
        }

        console.log(`   🔎 Found ${messages.length} new message(s). Processing...`);

        for (const item of messages) {
            console.log("\n   --- PROCESSING NEW EMAIL ---");

            // ✅ FIX: Extract HEADER + BODY
            const headerPart = item.parts.find(p => p.which === 'HEADER');
            const textPart = item.parts.find(p => p.which === 'TEXT');

            if (!headerPart || !textPart) {
                console.log("   ⚠️ Skipping: Malformed email parts.");
                continue;
            }

            // ✅ FIX: Combine into FULL RAW EMAIL for parser
            const fullRawEmail =
                headerPart.body + "\r\n\r\n" + textPart.body;

            console.log("   📝 STEP 1: Parsing email...");
            const mail = await simpleParser(fullRawEmail);

            if (!mail.from || !mail.from.value || !mail.from.value[0]) {
                console.log("   ⚠️ Skipping: No valid sender found.");
                continue;
            }

            const fromAddress = mail.from.value[0].address;
            const subject = mail.subject || "No Subject";
            const bodyText = mail.text ? mail.text.trim() : "";

            // 🛑 Prevent Self-Reply
            if (fromAddress === process.env.EMAIL_USER) {
                console.log("   🛑 Skipping: This is my own email.");
                await connection.addFlags(item.attributes.uid, "\\Seen");
                continue;
            }

            console.log(`   📩 From: ${fromAddress}`);
            console.log(`   📄 Content: "${bodyText.substring(0, 80)}..."`);

            // 🧠 STEP 2: AI GENERATION
            console.log("   🧠 STEP 2: Asking Ollama...");
            const aiReply = await generateResponse(bodyText);

            console.log(
                `   💡 STEP 3: AI Generated Answer (Length: ${aiReply.length} chars)`
            );

            // 📤 STEP 3: SEND EMAIL
            const sent = await sendReply(fromAddress, subject, aiReply);

            if (sent) {
                console.log("   📌 Marking email as READ in Gmail...");
                await connection.addFlags(item.attributes.uid, "\\Seen");
            }
        }

        console.log("\n🏁 Closing Connection.");
        connection.end();

    } catch (error) {
        console.log("❌ CRITICAL ERROR:", error.message);
    }
};

// ---------------------------------------------------------
// RUN
// ---------------------------------------------------------

checkAndReply();
