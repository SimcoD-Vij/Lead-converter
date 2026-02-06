// ---------------------------------------------------------
// UNIFIED GATEWAY SERVER (PORT 8080)
// ---------------------------------------------------------
// This is the SINGLE PUBLIC INGRESS.
// 1. Accepts ALL Twilio Webhooks.
// 2. Queues SMS immediately (Zero Blocking).
// 3. Proxies Voice traffic to the internal Voice Server (Port 3000).
// ---------------------------------------------------------

const express = require('express');
const bodyParser = require('body-parser');
const axios = require('axios');
const fs = require('fs');
const path = require('path');

const app = express();
// Parse POST bodies (Twilio sends form-urlencoded)
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

const PORT = 8082;
const VOICE_SERVER_URL = "http://localhost:3000";

// PATHS
const SMS_QUEUE_FILE = path.join(__dirname, '../sms/inbound_sms_queue.json');

// ---------------------------------------------------------
// 1. SMS INGRESS (QUEUE ONLY)
// ---------------------------------------------------------
app.post('/sms', (req, res) => {
    // 1. Immediate ACK to Twilio (Prevent Timeout)
    res.type('text/xml').send('<Response></Response>');

    const from = req.body.From;
    const body = req.body.Body;

    console.log(`\n📨 GATEWAY: Received SMS from ${from}. Queuing...`);

    // 2. Append to Queue (Atomic-ish Sync Write for safety)
    try {
        let queue = [];
        if (fs.existsSync(SMS_QUEUE_FILE)) {
            try { queue = JSON.parse(fs.readFileSync(SMS_QUEUE_FILE, 'utf8')); } catch (e) { }
        }

        queue.push({
            lead_id: from,
            message: body,
            timestamp: new Date().toISOString(),
            status: 'PENDING'
        });

        fs.writeFileSync(SMS_QUEUE_FILE, JSON.stringify(queue, null, 2));
        console.log(`   ✅ Queued. Current Size: ${queue.length}`);

    } catch (e) {
        console.error("   ❌ GATEWAY ERROR: Failed to queue SMS", e);
    }
});
// ---------------------------------------------------------
// 1.5 EMAIL INGRESS (QUEUE ONLY)
// ---------------------------------------------------------
const EMAIL_QUEUE_FILE = path.join(__dirname, '../email/inbound_email_queue.json');

app.post('/email', (req, res) => {
    // 1. Immediate ACK
    res.sendStatus(200);

    const { sender, subject, body } = req.body;
    console.log(`\n📧 GATEWAY: Received Email from ${sender}. Queuing...`);

    try {
        let queue = [];
        if (fs.existsSync(EMAIL_QUEUE_FILE)) {
            try { queue = JSON.parse(fs.readFileSync(EMAIL_QUEUE_FILE, 'utf8')); } catch (e) { }
        }

        queue.push({
            sender,
            subject,
            body,
            timestamp: new Date().toISOString(),
            status: 'PENDING'
        });

        fs.writeFileSync(EMAIL_QUEUE_FILE, JSON.stringify(queue, null, 2));
        console.log(`   ✅ Email Queued. Current Size: ${queue.length}`);
    } catch (e) {
        console.error("   ❌ GATEWAY ERROR: Failed to queue Email", e);
    }
});
// We proxy all voice-related routes to the internal call server.
const proxyToVoice = async (req, res) => {
    // FIX: app.use('/voice') strips the prefix. We need the FULL path.
    // req.originalUrl includes '/voice/...'
    const targetUrl = `${VOICE_SERVER_URL}${req.originalUrl}`;
    // console.log(`   📞 GATEWAY: Proxying ${req.method} ${req.originalUrl} -> ${targetUrl}`);

    try {
        // Create clean headers
        const proxyHeaders = { ...req.headers };
        delete proxyHeaders['host'];
        delete proxyHeaders['content-length'];
        delete proxyHeaders['content-type']; // Let Axios set this based on data type (JSON)

        // Forward the request
        const response = await axios({
            method: req.method,
            url: targetUrl,
            data: req.body,
            headers: proxyHeaders,
            // Don't throw on 4xx/5xx, let Twilio handle it
            validateStatus: () => true
        });

        // Set Headers
        res.set(response.headers);
        res.status(response.status).send(response.data);

    } catch (e) {
        console.error(`   ❌ GATEWAY PROXY ERROR (${req.path}):`, e.message);
        // If internal server is down, return generic error XML or 502
        if (req.path.includes('voice')) {
            res.type('text/xml').send('<Response><Say>System is currently busy. Please try again later.</Say></Response>');
        } else {
            res.sendStatus(502);
        }
    }
};

app.use('/voice', proxyToVoice);

// ---------------------------------------------------------
// START
// ---------------------------------------------------------
app.listen(PORT, () => {
    console.log(`\n🌍 UNIFIED GATEWAY LISTENING ON PORT ${PORT}`);
    console.log(`   👉 SMS Queued internally`);
    console.log(`   👉 Voice Proxied to ${VOICE_SERVER_URL}`);
});
