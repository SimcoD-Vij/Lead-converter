"use strict";

// ---------------------------------------------------------
// TASK 2 EXTENSION: INBOX REPLY MONITOR (FIXED SSL)
// ---------------------------------------------------------
require('dotenv').config({
  path: '../.env'
});

var imaps = require('imap-simple');

var _require = require('mailparser'),
    simpleParser = _require.simpleParser;

var fs = require('fs');

var path = require('path'); // CONFIG


var LEADS_FILE = path.join(__dirname, '../processed_leads/clean_leads.json');
var CHECK_INTERVAL = 60000;
var INTENTS = {
  INTERESTED: ['yes', 'sure', 'interested', 'call me', 'schedule', 'demo', 'time'],
  STOP: ['stop', 'unsubscribe', 'remove', 'spam', 'not interested', 'no thanks']
}; // 1. IMAP CONFIGURATION (Updated with SSL Fix)

var config = {
  imap: {
    user: process.env.EMAIL_USER,
    password: process.env.EMAIL_PASS,
    host: 'imap.gmail.com',
    port: 993,
    tls: true,
    authTimeout: 10000,
    // Increased timeout to 10s
    tlsOptions: {
      rejectUnauthorized: false // <--- THE FIX: Allow self-signed certs (Antivirus/Proxy)

    }
  }
}; // 2. HELPER: UPDATE LEAD STATUS

var updateLead = function updateLead(emailFrom, status, snippet) {
  if (!fs.existsSync(LEADS_FILE)) return;
  var leads = JSON.parse(fs.readFileSync(LEADS_FILE, 'utf-8')); // Normalize email (case insensitive)

  var lead = leads.find(function (l) {
    return l.email.toLowerCase() === emailFrom.toLowerCase();
  });

  if (lead) {
    console.log("   \uD83C\uDFAF MATCH FOUND: ".concat(lead.name)); // Only update if we haven't already marked them

    if (lead.status !== "STOPPED" && lead.status !== "INTERESTED") {
      lead.status = status;
      lead.last_reply = new Date().toISOString();
      lead.last_reply_snippet = snippet;
      fs.writeFileSync(LEADS_FILE, JSON.stringify(leads, null, 2));
      console.log("   \uD83D\uDCBE Updated Status to: ".concat(status));
    }
  } else {
    console.log("   \u26A0\uFE0F Unknown Sender: ".concat(emailFrom, " (Not in lead list)"));
  }
}; // 3. ANALYZE EMAIL BODY


var analyzeIntent = function analyzeIntent(text) {
  var lowerText = text.toLowerCase();

  if (INTENTS.STOP.some(function (word) {
    return lowerText.includes(word);
  })) {
    return "STOPPED";
  }

  if (INTENTS.INTERESTED.some(function (word) {
    return lowerText.includes(word);
  })) {
    return "INTERESTED";
  }

  return "REPLIED";
}; // 4. MAIN CHECKER FUNCTION


var checkInbox = function checkInbox() {
  var connection, searchCriteria, fetchOptions, messages, _iteratorNormalCompletion, _didIteratorError, _iteratorError, _iterator, _step, item, all, id, idHeader, mail, fromAddress, subject, bodyText, sentiment, snippet;

  return regeneratorRuntime.async(function checkInbox$(_context) {
    while (1) {
      switch (_context.prev = _context.next) {
        case 0:
          console.log("\n📬 Checking Inbox for new replies...");
          _context.prev = 1;
          _context.next = 4;
          return regeneratorRuntime.awrap(imaps.connect(config));

        case 4:
          connection = _context.sent;
          _context.next = 7;
          return regeneratorRuntime.awrap(connection.openBox('INBOX'));

        case 7:
          // Search for UNSEEN emails
          searchCriteria = ['UNSEEN'];
          fetchOptions = {
            bodies: ['HEADER', 'TEXT'],
            markSeen: true
          };
          _context.next = 11;
          return regeneratorRuntime.awrap(connection.search(searchCriteria, fetchOptions));

        case 11:
          messages = _context.sent;

          if (!(messages.length === 0)) {
            _context.next = 16;
            break;
          }

          console.log("   (No new unread emails found)");
          connection.end();
          return _context.abrupt("return");

        case 16:
          console.log("   Found ".concat(messages.length, " new messages."));
          _iteratorNormalCompletion = true;
          _didIteratorError = false;
          _iteratorError = undefined;
          _context.prev = 20;
          _iterator = messages[Symbol.iterator]();

        case 22:
          if (_iteratorNormalCompletion = (_step = _iterator.next()).done) {
            _context.next = 40;
            break;
          }

          item = _step.value;
          all = item.parts.find(function (part) {
            return part.which === 'TEXT';
          });
          id = item.attributes.uid;
          idHeader = "Imap-Id: " + id + "\r\n";
          _context.next = 29;
          return regeneratorRuntime.awrap(simpleParser(idHeader + all.body));

        case 29:
          mail = _context.sent;
          fromAddress = mail.from.value[0].address;
          subject = mail.subject;
          bodyText = mail.text;
          console.log("   \uD83D\uDCE9 From: ".concat(fromAddress, " | Sub: ").concat(subject));
          sentiment = analyzeIntent(bodyText);
          snippet = bodyText.substring(0, 100).replace(/\n/g, ' ');
          updateLead(fromAddress, sentiment, snippet);

        case 37:
          _iteratorNormalCompletion = true;
          _context.next = 22;
          break;

        case 40:
          _context.next = 46;
          break;

        case 42:
          _context.prev = 42;
          _context.t0 = _context["catch"](20);
          _didIteratorError = true;
          _iteratorError = _context.t0;

        case 46:
          _context.prev = 46;
          _context.prev = 47;

          if (!_iteratorNormalCompletion && _iterator["return"] != null) {
            _iterator["return"]();
          }

        case 49:
          _context.prev = 49;

          if (!_didIteratorError) {
            _context.next = 52;
            break;
          }

          throw _iteratorError;

        case 52:
          return _context.finish(49);

        case 53:
          return _context.finish(46);

        case 54:
          connection.end();
          _context.next = 61;
          break;

        case 57:
          _context.prev = 57;
          _context.t1 = _context["catch"](1);
          console.log("❌ IMAP Error:", _context.t1.message);

          if (_context.t1.message.includes("AUTHENTICATIONFAILED")) {
            console.log("   👉 Tip: Check .env EMAIL_PASS (Must be App Password)");
          }

        case 61:
        case "end":
          return _context.stop();
      }
    }
  }, null, null, [[1, 57], [20, 42, 46, 54], [47,, 49, 53]]);
};

checkInbox();