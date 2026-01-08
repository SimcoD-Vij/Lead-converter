"use strict";

// conversion-system/test_add.js
var _require = require('./json_manager'),
    addLead = _require.addLead,
    db = _require.db;

console.log("📝 Adding Test Lead...");
var testLead = {
  name: "Test Client",
  phone: "+917604896187",
  // Change to your real phone for WhatsApp testing
  email: "rsvijaypargavan@gmail.com"
}; // 1. Add the lead

addLead(testLead); // 2. Verify it's actually there

var check = db.prepare('SELECT * FROM leads WHERE phone = ?').get(testLead.phone);

if (check) {
  console.log("✅ Lead successfully verified in DB:");
  console.log(check);
  console.log("👉 The Orchestrator should pick this up in 5 seconds.");
} else {
  console.log("❌ CRITICAL: Lead was NOT found in DB.");
}