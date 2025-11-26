"use strict";

// ---------------------------------------------------------
// UTILITY: MERGE CALL LOGS INTO MASTER DATA
// ---------------------------------------------------------
var fs = require('fs');

var path = require('path');

var LEADS_FILE = path.resolve(__dirname, '../processed_leads/clean_leads.json');
var LOGS_FILE = path.resolve(__dirname, '../processed_leads/call_logs.json');

var mergeData = function mergeData() {
  console.log("🔄 Starting Data Merge..."); // 1. Check clean_leads.json (Target)

  if (!fs.existsSync(LEADS_FILE)) {
    console.log("❌ CRITICAL: clean_leads.json not found. Run Task 1 (Importer) first.");
    return;
  } // 2. Check call_logs.json (Source)


  if (!fs.existsSync(LOGS_FILE)) {
    console.log("ℹ️ No call logs found yet. Make some calls first!");
    return;
  } // 3. Load Data


  var leads = [];
  var logs = [];

  try {
    leads = JSON.parse(fs.readFileSync(LEADS_FILE, 'utf-8'));
    logs = JSON.parse(fs.readFileSync(LOGS_FILE, 'utf-8'));
  } catch (e) {
    console.log("❌ Error reading JSON files:", e.message);
    return;
  }

  console.log("   Loaded ".concat(leads.length, " Leads and ").concat(logs.length, " Call Logs."));
  var updatesCount = 0; // 4. Merge Logic

  logs.forEach(function (log) {
    // Find lead with matching phone 
    // (We normalize by removing spaces just in case)
    var lead = leads.find(function (l) {
      // Handle cases where l.phone might be null or undefined
      if (!l.phone) return false;
      return l.phone.replace(/\s/g, '') === log.phone.replace(/\s/g, '');
    });

    if (lead) {
      // Check if we actually have new info to add
      // We prioritized the latest log status
      if (lead.status !== log.status || lead.last_response_digit !== log.digit_pressed) {
        // UPDATE: Just the user preference and status
        lead.status = log.status; // e.g., "INTERESTED"

        lead.interest = log.interest; // e.g., "HIGH"

        lead.last_response_digit = log.digit_pressed; // e.g., "1", "2", "3"

        lead.last_updated = log.timestamp;
        updatesCount++;
        console.log("   \uD83D\uDC49 Updated ".concat(lead.name, ": Pressed ").concat(log.digit_pressed, " (").concat(log.status, ")"));
      }
    }
  }); // 5. Save Result

  if (updatesCount > 0) {
    fs.writeFileSync(LEADS_FILE, JSON.stringify(leads, null, 2));
    console.log("\u2705 Merge Complete. Updated ".concat(updatesCount, " leads in clean_leads.json"));
  } else {
    console.log("✅ No new updates found to merge.");
  }
};

mergeData();