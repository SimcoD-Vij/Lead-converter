"use strict";

// ---------------------------------------------------------
// TASK 4: WHATSAPP/SMS LISTENER (DEBUG MODE)
// ---------------------------------------------------------
var express = require('express');

var bodyParser = require('body-parser');

var fs = require('fs');

var path = require('path');

var MessagingResponse = require('twilio').twiml.MessagingResponse;

var app = express();
app.use(bodyParser.urlencoded({
  extended: false
})); // PORT CONFIGURATION

var PORT = 4000;
var LEADS_FILE = path.resolve(__dirname, '../processed_leads/clean_leads.json'); // 1. GLOBAL DEBUG LOGGER (Catches ANY traffic)

app.use(function (req, res, next) {
  console.log("\n\uD83D\uDD14 INCOMING SIGNAL: ".concat(req.method, " ").concat(req.url));
  next();
}); // HELPER: Update Status

var updateLeadStatus = function updateLeadStatus(phoneNumber, newStatus) {
  if (!fs.existsSync(LEADS_FILE)) {
    console.log("   ❌ Error: clean_leads.json not found.");
    return false;
  }

  var leads = JSON.parse(fs.readFileSync(LEADS_FILE, 'utf-8')); // Normalize: Remove 'whatsapp:' and spaces

  var cleanIncoming = phoneNumber.replace('whatsapp:', '').replace(/\s/g, '');
  console.log("   \uD83D\uDD0D Searching for: ".concat(cleanIncoming));
  var lead = leads.find(function (l) {
    var cleanLeadPhone = (l.phone || "").replace(/\s/g, '');
    return cleanLeadPhone === cleanIncoming;
  });

  if (lead) {
    var oldStatus = lead.status;
    lead.status = newStatus;
    lead.last_reply = new Date().toISOString();
    fs.writeFileSync(LEADS_FILE, JSON.stringify(leads, null, 2));
    console.log("   \uD83D\uDCBE SUCCESS: Updated ".concat(lead.name, " (").concat(oldStatus, " -> ").concat(newStatus, ")"));
    return true;
  } else {
    console.log("   \u26A0\uFE0F FAILED: Number not found in database.");
    return false;
  }
}; // MAIN ROUTE


app.post('/sms', function (req, res) {
  var incomingMsg = req.body.Body ? req.body.Body.trim().toLowerCase() : "empty";
  var fromPhone = req.body.From;
  console.log("   \uD83D\uDCE9 Message Content: \"".concat(incomingMsg, "\" from ").concat(fromPhone));
  var twiml = new MessagingResponse(); // 2. ANALYZE INTENT

  if (['stop', 'cancel', 'no'].includes(incomingMsg)) {
    updateLeadStatus(fromPhone, "STOPPED");
    twiml.message("You have been unsubscribed.");
  } else if (['yes', 'interested', 'sure', 'ok'].includes(incomingMsg)) {
    updateLeadStatus(fromPhone, "INTERESTED");
    twiml.message("Great! A human agent will follow up.");
  } else {
    updateLeadStatus(fromPhone, "REPLIED");
    twiml.message("Thanks for your reply.");
  }

  res.type('text/xml').send(twiml.toString());
});
app.listen(PORT, function () {
  console.log("------------------------------------------------");
  console.log("\uD83D\uDCE1 WhatsApp Listener running on http://localhost:".concat(PORT));
  console.log("   Waiting for Twilio...");
  console.log("------------------------------------------------");
});