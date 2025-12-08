"use strict";

// ---------------------------------------------------------
// TASK 2 EXTENSION: INBOX REPLY MONITOR (DEBUG MODE)
// ---------------------------------------------------------
require('dotenv').config({
  path: '../.env'
});

var imaps = require('imap-simple');

var _require = require('mailparser'),
    simpleParser = _require.simpleParser;

var fs = require('fs');

var path = require('path'); // CONFIG


var LEADS_FILE = path.join(__dirname, '../processed_leads/clean_leads.json'); // KEYWORDS

var INTENTS = {
  INTERESTED: ['yes', 'sure', 'interested', 'call me', 'schedule', 'demo', 'time'],
  STOP: ['stop', 'unsubscribe', 'remove', 'spam', 'not interested', 'no thanks']
};
var config = {
  imap: {
    user: process.env.EMAIL_USER,
    password: process.env.EMAIL_PASS,
    host: 'imap.gmail.com',
    port: 993,
    tls: true,
    authTimeout: 10000,
    tlsOptions: {
      rejectUnauthorized: false
    }
  }
}; // HELPER: UPDATE LEAD

var updateLead = function updateLead(emailFrom, status, snippet) {
  console.log("   \uD83D\uDD0E Searching database for: ".concat(emailFrom));
  if (!fs.existsSync(LEADS_FILE)) return console.log("   ❌ Error: DB File missing.");
  var leads = JSON.parse(fs.readFileSync(LEADS_FILE, 'utf-8')); // STRICTER MATCHING: Extract plain email from string like "John <john@gmail.com>"

  var cleanEmail = emailFrom.match(/([a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+\.[a-zA-Z0-9._-]+)/gi);
  var targetEmail = cleanEmail ? cleanEmail[0].toLowerCase() : emailFrom.toLowerCase();
  var lead = leads.find(function (l) {
    return l.email.toLowerCase() === targetEmail;
  });

  if (lead) {
    console.log("   \u2705 FOUND: ".concat(lead.name, " (Current Status: ").concat(lead.status, ")")); // UPDATE

    lead.status = status;
    lead.last_reply = new Date().toISOString();
    lead.last_reply_snippet = snippet;
    fs.writeFileSync(LEADS_FILE, JSON.stringify(leads, null, 2));
    console.log("   \uD83D\uDCBE SUCCESS: Updated status to \"".concat(status, "\""));
  } else {
    console.log("   \u26A0\uFE0F FAILED: Could not find lead with email \"".concat(targetEmail, "\""));
  }
}; // ANALYZE INTENT


var analyzeIntent = function analyzeIntent(text) {
  var lowerText = (text || "").toLowerCase();
  console.log("   \uD83E\uDDE0 Analyzing Text: \"".concat(lowerText.substring(0, 50), "...\""));

  if (INTENTS.STOP.some(function (word) {
    return lowerText.includes(word);
  })) {
    console.log("      👉 Detected STOP intent");
    return "STOPPED";
  }

  if (INTENTS.INTERESTED.some(function (word) {
    return lowerText.includes(word);
  })) {
    console.log("      👉 Detected INTERESTED intent");
    return "INTERESTED";
  }

  console.log("      👉 Detected NEUTRAL intent");
  return "REPLIED";
}; // MAIN CHECKER


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
            _context.next = 48;
            break;
          }

          item = _step.value;
          _context.prev = 24;
          all = item.parts.find(function (part) {
            return part.which === 'TEXT';
          });
          id = item.attributes.uid;
          idHeader = "Imap-Id: " + id + "\r\n";
          _context.next = 30;
          return regeneratorRuntime.awrap(simpleParser(idHeader + all.body));

        case 30:
          mail = _context.sent;

          if (!(!mail.from || !mail.from.value || !mail.from.value[0])) {
            _context.next = 33;
            break;
          }

          return _context.abrupt("continue", 45);

        case 33:
          fromAddress = mail.from.value[0].address; // Use address property directly

          subject = mail.subject;
          bodyText = mail.text;
          console.log("\n   \uD83D\uDCE9 NEW MAIL From: ".concat(fromAddress));
          sentiment = analyzeIntent(bodyText);
          snippet = bodyText ? bodyText.substring(0, 100).replace(/\n/g, ' ') : "No Content";
          updateLead(fromAddress, sentiment, snippet);
          _context.next = 45;
          break;

        case 42:
          _context.prev = 42;
          _context.t0 = _context["catch"](24);
          console.log("   \u26A0\uFE0F Parse Error: ".concat(_context.t0.message));

        case 45:
          _iteratorNormalCompletion = true;
          _context.next = 22;
          break;

        case 48:
          _context.next = 54;
          break;

        case 50:
          _context.prev = 50;
          _context.t1 = _context["catch"](20);
          _didIteratorError = true;
          _iteratorError = _context.t1;

        case 54:
          _context.prev = 54;
          _context.prev = 55;

          if (!_iteratorNormalCompletion && _iterator["return"] != null) {
            _iterator["return"]();
          }

        case 57:
          _context.prev = 57;

          if (!_didIteratorError) {
            _context.next = 60;
            break;
          }

          throw _iteratorError;

        case 60:
          return _context.finish(57);

        case 61:
          return _context.finish(54);

        case 62:
          connection.end();
          _context.next = 68;
          break;

        case 65:
          _context.prev = 65;
          _context.t2 = _context["catch"](1);
          console.log("❌ IMAP Error:", _context.t2.message);

        case 68:
        case "end":
          return _context.stop();
      }
    }
  }, null, null, [[1, 65], [20, 50, 54, 62], [24, 42], [55,, 57, 61]]);
};

checkInbox();