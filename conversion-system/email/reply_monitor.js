// ---------------------------------------------------------
// TASK 2+: EMAIL AI RESPONDER (HEADER FIX - FULL VERSION)
// ---------------------------------------------------------

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const imaps = require('imap-simple');
const { simpleParser } = require('mailparser');
const nodemailer = require('nodemailer');
const fs = require('fs');
const { processInboundEmail } = require('./email_engine');

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
// MONITOR INBOX
// ---------------------------------------------------------
let isScanning = false;

const monitorInbox = async () => {
    if (isScanning) {
        console.log("   🔒 IMAP Scan already in progress.");
        return;
    }
    isScanning = true;
    console.log("\n📬 Checking Inbox for New Emails...");

    try {
        const connection = await imaps.connect(config);
        await connection.openBox('INBOX');

        const searchCriteria = ['UNSEEN'];
        const fetchOptions = { bodies: [''], markSeen: false };

        const messages = await connection.search(searchCriteria, fetchOptions);

        if (messages.length === 0) {
            // console.log("   (No new emails)");
            connection.end();
            isScanning = false;
            return;
        }

        console.log(`   🔎 Found ${messages.length} new message(s). Processing...`);

        for (const item of messages) {
            const fullRawEmail = item.parts[0].body;
            const mail = await simpleParser(fullRawEmail);

            if (!mail.from || !mail.from.value || !mail.from.value[0]) {
                console.log(`   ⚠️ Skipping Msg #${item.attributes.uid}: No Valid Sender Found in Parser Result.`);
                continue;
            }

            if (!mail.from || !mail.from.value || !mail.from.value[0]) {
                console.log(`   ⚠️ Skipping Msg #${item.attributes.uid}: No Valid Sender`);
                continue;
            }

            const fromAddress = mail.from.value[0].address;
            const subject = mail.subject || "No Subject";
            const bodyText = mail.text ? mail.text.trim() : "";
            // 🛑 Loop Protection (Header Based)
            // If the email has our custom header, it was sent by US (the bot).
            if (mail.headers && mail.headers.get('x-hivericks-bot') === 'true') {
                console.log(`   🛑 Skipping Msg #${item.attributes.uid}: Detected X-Hivericks-Bot Header (My Own Reply).`);
                await connection.addFlags(item.attributes.uid, "\\Seen");
                continue;
            }

            console.log(`   📩 IMAP Ingress: ${fromAddress} | Subject: ${subject}`);

            // DELEGATE TO ENGINE
            // This ensures Status Updates, Memory, AI Registry, everything runs standard.
            await processInboundEmail({
                sender: fromAddress,
                subject: subject,
                body: bodyText
            });

            // Mark Seen only after processing
            await connection.addFlags(item.attributes.uid, "\\Seen");
        }

        connection.end();

    } catch (error) {
        console.log("   ❌ IMAP ERROR:", error.message);
    } finally {
        isScanning = false;
    }
};

module.exports = { monitorInbox };
