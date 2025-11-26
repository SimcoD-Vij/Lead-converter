"use strict";

// ---------------------------------------------------------
// TASK 2: EMAIL OUTREACH ENGINE (STATE MACHINE)
// ---------------------------------------------------------
require('dotenv').config({
  path: '../.env'
}); // 👇 DEBUGGING BLOCK


console.log("--- DEBUG START ---");
console.log("1. Checking .env path:", require('path').resolve(__dirname, '../.env'));
console.log("2. Key loaded for User:", process.env.EMAIL_USER ? "YES" : "NO");
console.log("3. Key loaded for Pass:", process.env.EMAIL_PASS ? "YES" : "NO");
console.log("4. User Value:", process.env.EMAIL_USER);
console.log("--- DEBUG END ---\n"); // 👆 END DEBUGGING BLOCK

var fs = require('fs');

var path = require('path');

var nodemailer = require('nodemailer');

var _require = require('./templates'),
    fillTemplate = _require.fillTemplate; // ---------------------------------------------------------
// CONFIGURATION
// ---------------------------------------------------------


var LEADS_FILE = path.join(__dirname, '../processed_leads/clean_leads.json');
var MAX_EMAILS_PER_HOUR = 10;
var DELAY_BETWEEN_EMAILS_MS = 5000; // UPDATE: Tracking Domain (Points to your Tracking Server)
// If running locally via Ngrok, this should be your Ngrok URL (e.g., https://xyz.ngrok-free.app)

var TRACKING_DOMAIN = process.env.TRACKING_DOMAIN || 'http://localhost:5000'; // ---------------------------------------------------------
// 1. SETUP TRANSPORTER
// ---------------------------------------------------------

var createTransporter = function createTransporter() {
  var testAccount;
  return regeneratorRuntime.async(function createTransporter$(_context) {
    while (1) {
      switch (_context.prev = _context.next) {
        case 0:
          if (!(process.env.EMAIL_USER && process.env.EMAIL_PASS)) {
            _context.next = 3;
            break;
          }

          console.log("   🔌 Connecting to Real Gmail...");
          return _context.abrupt("return", {
            transporter: nodemailer.createTransport({
              service: 'gmail',
              auth: {
                user: process.env.EMAIL_USER,
                pass: process.env.EMAIL_PASS
              }
            })
          });

        case 3:
          console.log("   🧪 No Real Credentials → Using Ethereal Test Mode");
          _context.next = 6;
          return regeneratorRuntime.awrap(nodemailer.createTestAccount());

        case 6:
          testAccount = _context.sent;
          return _context.abrupt("return", {
            transporter: nodemailer.createTransport({
              host: 'smtp.ethereal.email',
              port: 587,
              secure: false,
              auth: {
                user: testAccount.user,
                pass: testAccount.pass
              }
            })
          });

        case 8:
        case "end":
          return _context.stop();
      }
    }
  });
}; // ---------------------------------------------------------
// 2. DECIDE NEXT STEP (STATE MACHINE)
// ---------------------------------------------------------


var determineNextStep = function determineNextStep(lead) {
  if (["STOPPED", "REPLIED", "BOUNCED", "FAILED"].includes(lead.status)) return null;
  var now = new Date();
  var lastContact = lead.last_contacted ? new Date(lead.last_contacted) : null;

  if (!lastContact || lead.stage === undefined) {
    return {
      stage: 1,
      template: "EMAIL_1"
    };
  }

  var diffTime = Math.abs(now - lastContact);
  var diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  if (lead.stage === 1 && diffDays >= 2) {
    return {
      stage: 2,
      template: "EMAIL_2"
    };
  }

  if (lead.stage === 2 && diffDays >= 4) {
    return {
      stage: 3,
      template: "EMAIL_3"
    };
  }

  return null;
}; // ---------------------------------------------------------
// 3. MAIN ENGINE
// ---------------------------------------------------------


var runEmailCampaign = function runEmailCampaign() {
  var leads, _ref, transporter, emailsSentCount, i, lead, nextStep, content, pixelUrl, clickUrl, htmlBody, info;

  return regeneratorRuntime.async(function runEmailCampaign$(_context2) {
    while (1) {
      switch (_context2.prev = _context2.next) {
        case 0:
          console.log("🚀 Starting Email Campaign...");
          console.log("   \uD83C\uDFAF Edge Intelligence Domain: ".concat(TRACKING_DOMAIN));

          if (fs.existsSync(LEADS_FILE)) {
            _context2.next = 5;
            break;
          }

          console.log("❌ clean_leads.json not found. Run Task 1 first.");
          return _context2.abrupt("return");

        case 5:
          _context2.prev = 5;
          leads = JSON.parse(fs.readFileSync(LEADS_FILE, 'utf-8'));
          _context2.next = 13;
          break;

        case 9:
          _context2.prev = 9;
          _context2.t0 = _context2["catch"](5);
          console.log("❌ JSON corrupt or unreadable.");
          return _context2.abrupt("return");

        case 13:
          _context2.next = 15;
          return regeneratorRuntime.awrap(createTransporter());

        case 15:
          _ref = _context2.sent;
          transporter = _ref.transporter;
          emailsSentCount = 0;
          i = 0;

        case 19:
          if (!(i < leads.length)) {
            _context2.next = 59;
            break;
          }

          lead = leads[i];

          if (!(emailsSentCount >= MAX_EMAILS_PER_HOUR)) {
            _context2.next = 24;
            break;
          }

          console.log("🛑 Hourly limit reached. Stopping batch.");
          return _context2.abrupt("break", 59);

        case 24:
          nextStep = determineNextStep(lead);

          if (nextStep) {
            _context2.next = 27;
            break;
          }

          return _context2.abrupt("continue", 56);

        case 27:
          console.log("\n\uD83D\uDCE7 Preparing ".concat(nextStep.template, " for ").concat(lead.name, "..."));
          content = fillTemplate(nextStep.template, lead);

          if (content) {
            _context2.next = 33;
            break;
          }

          console.log("   \u26A0\uFE0F Missing template for stage ".concat(nextStep.stage));
          lead.last_error = "Template EMAIL_".concat(nextStep.stage, " missing");
          return _context2.abrupt("continue", 56);

        case 33:
          // --- UPDATE START: EDGE INTELLIGENCE INJECTION ---
          // 1. Create Tracking Links
          pixelUrl = "".concat(TRACKING_DOMAIN, "/track/open?email=").concat(lead.email); // Destination can be changed to your real sales deck or meeting link

          clickUrl = "".concat(TRACKING_DOMAIN, "/track/click?email=").concat(lead.email, "&dest=https://www.google.com"); // 2. Build HTML Body

          htmlBody = "\n            <div style=\"font-family: Arial, sans-serif; color: #333;\">\n                <p>".concat(content.body.replace(/\n/g, '<br>'), "</p>\n                <p>\n                    <a href=\"").concat(clickUrl, "\" style=\"color: #007bff; text-decoration: none; font-weight: bold;\">\n                        Click here to view details\n                    </a>\n                </p>\n                <!-- INVISIBLE SPY PIXEL -->\n                <img src=\"").concat(pixelUrl, "\" width=\"1\" height=\"1\" alt=\"\" style=\"display:none;\" />\n            </div>\n        "); // --- UPDATE END ---

          _context2.prev = 36;
          _context2.next = 39;
          return regeneratorRuntime.awrap(transporter.sendMail({
            from: '"AI Sales Bot" <bot@company.com>',
            to: lead.email,
            subject: content.subject,
            text: content.body,
            // Fallback for old email clients
            html: htmlBody // The Tracking Version

          }));

        case 39:
          info = _context2.sent;
          console.log("   \u2705 Sent! Preview: ".concat(nodemailer.getTestMessageUrl(info) || "Sent via Gmail"));
          lead.stage = nextStep.stage;
          lead.last_contacted = new Date().toISOString();
          lead.status = "CONTACTED";
          lead.last_error = null;
          emailsSentCount++;
          _context2.next = 48;
          return regeneratorRuntime.awrap(new Promise(function (resolve) {
            return setTimeout(resolve, DELAY_BETWEEN_EMAILS_MS);
          }));

        case 48:
          _context2.next = 56;
          break;

        case 50:
          _context2.prev = 50;
          _context2.t1 = _context2["catch"](36);
          console.log("   \u274C Error sending: ".concat(_context2.t1.message));
          lead.status = "FAILED";
          lead.last_error = _context2.t1.message;
          lead.last_attempted = new Date().toISOString();

        case 56:
          i++;
          _context2.next = 19;
          break;

        case 59:
          fs.writeFileSync(LEADS_FILE, JSON.stringify(leads, null, 2));
          console.log("\n💾 Campaign Progress Saved.");

        case 61:
        case "end":
          return _context2.stop();
      }
    }
  }, null, null, [[5, 9], [36, 50]]);
};

runEmailCampaign();