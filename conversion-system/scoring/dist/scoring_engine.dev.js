"use strict";

function ownKeys(object, enumerableOnly) { var keys = Object.keys(object); if (Object.getOwnPropertySymbols) { var symbols = Object.getOwnPropertySymbols(object); if (enumerableOnly) symbols = symbols.filter(function (sym) { return Object.getOwnPropertyDescriptor(object, sym).enumerable; }); keys.push.apply(keys, symbols); } return keys; }

function _objectSpread(target) { for (var i = 1; i < arguments.length; i++) { var source = arguments[i] != null ? arguments[i] : {}; if (i % 2) { ownKeys(source, true).forEach(function (key) { _defineProperty(target, key, source[key]); }); } else if (Object.getOwnPropertyDescriptors) { Object.defineProperties(target, Object.getOwnPropertyDescriptors(source)); } else { ownKeys(source).forEach(function (key) { Object.defineProperty(target, key, Object.getOwnPropertyDescriptor(source, key)); }); } } return target; }

function _defineProperty(obj, key, value) { if (key in obj) { Object.defineProperty(obj, key, { value: value, enumerable: true, configurable: true, writable: true }); } else { obj[key] = value; } return obj; }

// ---------------------------------------------------------
// TASK 5: LEAD SCORING ENGINE (DATA-AWARE VERSION)
// ---------------------------------------------------------
var fs = require('fs');

var path = require('path'); // DATA SOURCES


var LEADS_FILE = path.resolve(__dirname, '../processed_leads/clean_leads.json'); // We keep call logs as a backup source, but prioritize the lead file

var CALL_LOGS_FILE = path.resolve(__dirname, '../processed_leads/call_logs.json'); // SCORING RULES

var POINTS = {
  // BASELINE (Data Quality)
  VALID_EMAIL: 5,
  VALID_PHONE: 5,
  // ACTIVITY (Effort)
  SENT_EMAIL: 1,
  TRIED_CALL: 1,
  SENT_SMS: 1,
  // ENGAGEMENT (High Value)
  EMAIL_OPEN: 5,
  EMAIL_CLICK: 10,
  VOICE_INTERESTED: 40,
  // Pressed 1
  VOICE_CALLBACK: 10,
  // Pressed 2
  REPLIED_ANY: 20 // SMS/WhatsApp/Email Reply

};
var THRESHOLD = {
  HOT: 50,
  WARM: 20
}; // ---------------------------------------------------------
// 1. HELPER: SAFE FILE READER
// ---------------------------------------------------------

var loadJSON = function loadJSON(filePath) {
  if (!fs.existsSync(filePath)) return [];

  try {
    var content = fs.readFileSync(filePath, 'utf-8');
    if (!content.trim()) return [];
    return JSON.parse(content);
  } catch (e) {
    return [];
  }
}; // ---------------------------------------------------------
// 2. HELPER: CALCULATE SCORE
// ---------------------------------------------------------


var scoreLead = function scoreLead(lead) {
  var score = 0;
  var reasons = []; // --- A. BASELINE SCORING ---

  if (lead.email) score += POINTS.VALID_EMAIL;
  if (lead.phone) score += POINTS.VALID_PHONE; // --- B. ACTIVITY SCORING ---

  if (lead.stage > 0) {
    score += POINTS.SENT_EMAIL;
  }

  if (lead.last_called) {
    score += POINTS.TRIED_CALL;
  }

  if (lead.last_sms_time) {
    score += POINTS.SENT_SMS;
  } // --- C. ENGAGEMENT SCORING (The Fix) ---
  // 1. Voice Interaction (Check 'last_response_digit' inside the lead object)


  if (lead.last_response_digit) {
    if (lead.last_response_digit === '1') {
      score += POINTS.VOICE_INTERESTED;
      reasons.push("Voice: Interested");
    } else if (lead.last_response_digit === '2') {
      score += POINTS.VOICE_CALLBACK;
      reasons.push("Voice: Call Later");
    }
  } // 2. Message Interaction (Check 'last_reply' timestamp)


  if (lead.last_reply) {
    score += POINTS.REPLIED_ANY;
    reasons.push("Msg Reply Received");
  } // 3. Email Tracking (Check 'opened' / 'clicked')


  if (lead.opened) {
    score += POINTS.EMAIL_OPEN;
    reasons.push("Opened Email");
  }

  if (lead.clicked) {
    score += POINTS.EMAIL_CLICK;
    reasons.push("Clicked Link");
  } // --- D. CATEGORIZE ---


  var category = "❄️ COLD";
  var action = "Nurture";

  if (score >= THRESHOLD.HOT) {
    category = "🔥 HOT";
    action = "CALL NOW (Human)";
  } else if (score >= THRESHOLD.WARM) {
    category = "🌤️ WARM";
    action = "Send SMS";
  }

  if (reasons.length === 0) reasons.push("Profiling Only");
  return {
    score: score,
    category: category,
    action: action,
    breakdown: reasons.join(", ")
  };
}; // ---------------------------------------------------------
// 3. MAIN PROCESS
// ---------------------------------------------------------


var runScoring = function runScoring() {
  console.log("🧠 Starting Scoring Engine...\n");
  var leads = loadJSON(LEADS_FILE);

  if (leads.length === 0) {
    console.log("❌ No leads found.");
    return;
  }

  console.log("-----------------------------------------------------------------------------------------");
  console.log("NAME".padEnd(20) + "SCORE".padEnd(8) + "CATEGORY".padEnd(12) + "ACTION".padEnd(20) + "REASONS");
  console.log("-----------------------------------------------------------------------------------------");
  var scoredLeads = leads.map(function (lead) {
    var result = scoreLead(lead);
    console.log(lead.name.padEnd(20) + result.score.toString().padEnd(8) + result.category.padEnd(12) + result.action.padEnd(20) + result.breakdown);
    return _objectSpread({}, lead, {
      score: result.score,
      category: result.category,
      intelligence_action: result.action,
      last_scored: new Date().toISOString()
    });
  });
  fs.writeFileSync(LEADS_FILE, JSON.stringify(scoredLeads, null, 2));
  console.log("\n💾 Scoring Complete. Database updated.");
};

runScoring();