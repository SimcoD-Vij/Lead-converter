"use strict";

// ---------------------------------------------------------
// TASK 3: VOICE BRAIN (FRESH BUILD)
// ---------------------------------------------------------
var express = require('express');

var bodyParser = require('body-parser');

var fs = require('fs');

var path = require('path');

var app = express();
app.use(bodyParser.urlencoded({
  extended: false
}));
var PORT = 3000;
var LEADS_FILE = path.resolve(__dirname, '../processed_leads/clean_leads.json'); // --- HELPER: UPDATE DATABASE ---

var saveResult = function saveResult(callSid, status, digits) {
  console.log("\n\uD83D\uDCBE SAVING RESULT for SID: ".concat(callSid, "..."));
  if (!fs.existsSync(LEADS_FILE)) return console.log("❌ DB Missing"); // 1. Read File

  var leads = JSON.parse(fs.readFileSync(LEADS_FILE, 'utf-8')); // 2. Find Lead by Call ID

  var lead = leads.find(function (l) {
    return l.last_call_sid === callSid;
  });

  if (lead) {
    // 3. Update Logic
    lead.status = status;
    lead.last_response_digit = digits; // Scoring (Simple Version)

    if (status === "INTERESTED") lead.score = (lead.score || 0) + 40;
    if (status === "CALL_LATER") lead.score = (lead.score || 0) + 10; // 4. Write File

    fs.writeFileSync(LEADS_FILE, JSON.stringify(leads, null, 2));
    console.log("   \u2705 UPDATED: ".concat(lead.name, " is now ").concat(status));
  } else {
    console.log("   ❌ ERROR: Call SID not found in database. (Did the Engine save it?)");
  }
}; // --- ROUTE 1: SPEAK SCRIPT ---


app.post('/voice', function (req, res) {
  var twiml = "\n    <Response>\n        <Say voice=\"Polly.Aditi\">Hello! This is an automated call from the Sales Team.</Say>\n        <Gather numDigits=\"1\" action=\"/gather\" method=\"POST\" timeout=\"10\">\n            <Say voice=\"Polly.Aditi\">\n                Press 1 if you are Interested.\n                Press 2 to Call Later.\n                Press 3 if Not Interested.\n            </Say>\n        </Gather>\n        <Say voice=\"Polly.Aditi\">We didn't receive any input. Goodbye.</Say>\n    </Response>\n    ";
  res.type('text/xml');
  res.send(twiml);
}); // --- ROUTE 2: HANDLE INPUT ---

app.post('/gather', function (req, res) {
  var digit = req.body.Digits;
  var callSid = req.body.CallSid;
  console.log("\uD83D\uDCDE INPUT: User pressed ".concat(digit));
  var reply = "Sorry, invalid input.";
  var status = "CALL_COMPLETE";

  if (digit === '1') {
    reply = "Great! Connecting you to a human.";
    status = "INTERESTED";
  } else if (digit === '2') {
    reply = "Okay. We will call you tomorrow.";
    status = "CALL_LATER";
  } else if (digit === '3') {
    reply = "Understood. Goodbye.";
    status = "NOT_INTERESTED";
  } // Trigger Save


  saveResult(callSid, status, digit);
  res.type('text/xml');
  res.send("<Response><Say voice=\"Polly.Aditi\">".concat(reply, "</Say></Response>"));
});
app.listen(PORT, function () {
  console.log("\uD83E\uDD16 Voice Brain running on Port ".concat(PORT));
});