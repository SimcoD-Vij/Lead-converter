// ---------------------------------------------------------
// LAYER 2: EDGE INTELLIGENCE SERVER (TRACKING)
// ---------------------------------------------------------

const express = require('express');
const fs = require('fs');
const path = require('path');
const useragent = require('useragent');

const app = express();
const PORT = 5000; // We use Port 5000 to avoid conflict with Voice(3000)/SMS(4000)

// FILE CONFIG
const LEADS_FILE = path.resolve(__dirname, '../processed_leads/clean_leads.json');

// HELPER: Update Lead Stats safely
const updateLeadStats = (email, action, req) => {
    try {
        if (!fs.existsSync(LEADS_FILE)) return;

        const leads = JSON.parse(fs.readFileSync(LEADS_FILE, 'utf-8'));
        
        // Find Lead by Email
        const lead = leads.find(l => l.email === email);
        if (!lead) return;

        // Capture Edge Intelligence (Device Info)
        const agent = useragent.parse(req.headers['user-agent']);
        const deviceType = agent.device.toString(); // "iPhone", "Samsung", "Other"
        const os = agent.os.toString(); // "iOS 15.4", "Windows 10"
        const browser = agent.toAgent(); // "Chrome 110.0.0"
        
        console.log(`   🕵️ EDGE DATA: ${email} | ${action} | ${os} on ${deviceType}`);

        // Update Flags for Scoring Engine
        if (action === 'OPEN') {
            lead.opened = true;
            lead.last_open_time = new Date().toISOString();
        } 
        else if (action === 'CLICK') {
            lead.clicked = true;
            lead.last_click_time = new Date().toISOString();
        }

        // Store Intelligence Log
        if (!lead.edge_data) lead.edge_data = [];
        lead.edge_data.push({
            action: action,
            time: new Date().toISOString(),
            ip: req.ip,
            device: deviceType,
            os: os,
            browser: browser
        });

        fs.writeFileSync(LEADS_FILE, JSON.stringify(leads, null, 2));
        console.log(`   💾 Saved ${action} event to database.`);

    } catch (e) {
        console.log("❌ Error updating stats:", e.message);
    }
};

// =========================================================
// ROUTE 1: TRACK OPEN (The Invisible Pixel)
// URL Example: http://your-url.ngrok/track/open?email=user@gmail.com
// =========================================================
app.get('/track/open', (req, res) => {
    const email = req.query.email;
    if (email) {
        updateLeadStats(email, 'OPEN', req);
    }

    // Return a 1x1 transparent GIF (Standard Tracking Pixel)
    const pixel = Buffer.from('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7', 'base64');
    res.writeHead(200, {
        'Content-Type': 'image/gif',
        'Content-Length': pixel.length,
    });
    res.end(pixel);
});

// =========================================================
// ROUTE 2: TRACK CLICK (The Redirect)
// URL Example: http://your-url.ngrok/track/click?email=user@gmail.com&dest=https://google.com
// =========================================================
app.get('/track/click', (req, res) => {
    const email = req.query.email;
    const destination = req.query.dest || 'https://google.com';

    if (email) {
        updateLeadStats(email, 'CLICK', req);
    }

    // Send user to the real website
    res.redirect(destination);
});

// START SERVER
app.listen(PORT, () => {
    console.log("-----------------------------------------------");
    console.log(`📡 Edge Intelligence Server running on Port ${PORT}`);
    console.log(`   Waiting for email opens...`);
    console.log("-----------------------------------------------");
});