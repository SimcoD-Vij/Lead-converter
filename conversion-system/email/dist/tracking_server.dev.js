"use strict";

// ---------------------------------------------------------
// LAYER 2: EDGE INTELLIGENCE SERVER (TRACKING)
// ---------------------------------------------------------
var express = require('express');

var fs = require('fs');

var path = require('path');

var useragent = require('useragent');

var app = express();
var PORT = 5000; // We use Port 5000 to avoid conflict with Voice(3000)/SMS(4000)
// FILE CONFIG

var LEADS_FILE = path.resolve(__dirname, '../processed_leads/clean_leads.json'); // HELPER: Update Lead Stats safely

var updateLeadStats = function updateLeadStats(email, action, req) {
  try {
    if (!fs.existsSync(LEADS_FILE)) return;
    var leads = JSON.parse(fs.readFileSync(LEADS_FILE, 'utf-8')); // Find Lead by Email

    var lead = leads.find(function (l) {
      return l.email === email;
    });
    if (!lead) return; // Capture Edge Intelligence (Device Info)

    var agent = useragent.parse(req.headers['user-agent']);
    var deviceType = agent.device.toString(); // "iPhone", "Samsung", "Other"

    var os = agent.os.toString(); // "iOS 15.4", "Windows 10"

    var browser = agent.toAgent(); // "Chrome 110.0.0"

    console.log("   \uD83D\uDD75\uFE0F EDGE DATA: ".concat(email, " | ").concat(action, " | ").concat(os, " on ").concat(deviceType)); // Update Flags for Scoring Engine

    if (action === 'OPEN') {
      lead.opened = true;
      lead.last_open_time = new Date().toISOString();
    } else if (action === 'CLICK') {
      lead.clicked = true;
      lead.last_click_time = new Date().toISOString();
    } // Store Intelligence Log


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
    console.log("   \uD83D\uDCBE Saved ".concat(action, " event to database."));
  } catch (e) {
    console.log("❌ Error updating stats:", e.message);
  }
}; // =========================================================
// ROUTE 1: TRACK OPEN (The Invisible Pixel)
// URL Example: http://your-url.ngrok/track/open?email=user@gmail.com
// =========================================================


app.get('/track/open', function (req, res) {
  var email = req.query.email;

  if (email) {
    updateLeadStats(email, 'OPEN', req);
  } // Return a 1x1 transparent GIF (Standard Tracking Pixel)


  var pixel = Buffer.from('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7', 'base64');
  res.writeHead(200, {
    'Content-Type': 'image/gif',
    'Content-Length': pixel.length
  });
  res.end(pixel);
}); // =========================================================
// ROUTE 2: TRACK CLICK (The Redirect)
// URL Example: http://your-url.ngrok/track/click?email=user@gmail.com&dest=https://google.com
// =========================================================

app.get('/track/click', function (req, res) {
  var email = req.query.email;
  var destination = req.query.dest || 'https://google.com';

  if (email) {
    updateLeadStats(email, 'CLICK', req);
  } // Send user to the real website


  res.redirect(destination);
}); // START SERVER

app.listen(PORT, function () {
  console.log("-----------------------------------------------");
  console.log("\uD83D\uDCE1 Edge Intelligence Server running on Port ".concat(PORT));
  console.log("   Waiting for email opens...");
  console.log("-----------------------------------------------");
});