"use strict";

// ---------------------------------------------------------
// TASK 6: SALES ROUTING SYSTEM (SMART PRIORITY)
// ---------------------------------------------------------
var fs = require('fs');

var path = require('path'); // CONFIG


var LEADS_FILE = path.resolve(__dirname, '../processed_leads/clean_leads.json'); // MOCK SALES TEAM

var SALES_AGENTS = ["Alice", "Bob", "Charlie"]; // HELPER: Generate Message

var generateSummary = function generateSummary(lead, owner, priority) {
  return "\n    =========================================\n    ".concat(priority, " LEAD NOTIFICATION\n    =========================================\n    \uD83D\uDC64 Lead:   ").concat(lead.name, "\n    \uD83C\uDFE2 Comp:   ").concat(lead.company, "\n    \uD83D\uDCDE Phone:  ").concat(lead.phone, "\n    -----------------------------------------\n    \uD83C\uDFC6 Score:  ").concat(lead.score, " (").concat(lead.category, ")\n    \uD83D\uDCAC Action: ").concat(lead.last_response_digit ? "Pressed " + lead.last_response_digit : "Passive", "\n    \uD83D\uDCCA Status: ").concat(lead.status, "\n    -----------------------------------------\n    \uD83D\uDC49 ASSIGNED TO: @").concat(owner, "\n    =========================================\n    ");
};

var runRouting = function runRouting() {
  console.log("🚀 Starting Smart Sales Routing...");
  if (!fs.existsSync(LEADS_FILE)) return console.log("❌ File missing.");
  var leads = JSON.parse(fs.readFileSync(LEADS_FILE, 'utf-8')); // 1. FILTER: Warm/Hot leads NOT yet routed

  var qualifiedLeads = leads.filter(function (l) {
    var isQualified = l.score >= 20;
    var notRouted = l.status !== "ROUTED_TO_SALES";
    return isQualified && notRouted;
  }); // 2. ACCURACY UPGRADE: SORTING
  // Process the HOTTEST leads first (Score High -> Low)

  qualifiedLeads.sort(function (a, b) {
    return b.score - a.score;
  });
  console.log("\uD83D\uDCCB Found ".concat(qualifiedLeads.length, " qualified leads pending routing.\n"));
  if (qualifiedLeads.length === 0) return; // 3. ROUTING LOOP

  qualifiedLeads.forEach(function (lead, index) {
    // A. Assign Owner
    var owner = SALES_AGENTS[index % SALES_AGENTS.length]; // B. Determine Urgency (Accuracy Upgrade)

    var priority = "🔔 STANDARD";

    if (lead.score >= 50 || lead.status === "INTERESTED" || lead.last_reply) {
      priority = "🚨 URGENT"; // Voice/Text replies are URGENT
    } // C. Generate Alert


    var alertMessage = generateSummary(lead, owner, priority); // D. Send Notification

    console.log(alertMessage); // E. Update Database

    lead.owner = owner;
    lead.status = "ROUTED_TO_SALES";
    lead.routed_at = new Date().toISOString();
  }); // 4. SAVE CHANGES

  fs.writeFileSync(LEADS_FILE, JSON.stringify(leads, null, 2));
  console.log("\n💾 Database updated. High priority leads assigned first.");
};

runRouting();