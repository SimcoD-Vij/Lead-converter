"use strict";

// ---------------------------------------------------------
// TASK 2+: EMAIL AI RESPONDER (HEADER FIX - FULL VERSION)
// ---------------------------------------------------------
require('dotenv').config({
  path: '../.env'
});

var imaps = require('imap-simple');

var _require = require('mailparser'),
    simpleParser = _require.simpleParser;

var nodemailer = require('nodemailer');

var _require2 = require('../ai/ollama_engine'),
    generateResponse = _require2.generateResponse; // ---------------------------------------------------------
// IMAP CONFIG
// ---------------------------------------------------------


var config = {
  imap: {
    user: process.env.EMAIL_USER,
    password: process.env.EMAIL_PASS,
    host: 'imap.gmail.com',
    port: 993,
    tls: true,
    tlsOptions: {
      rejectUnauthorized: false
    },
    authTimeout: 15000
  }
}; // ---------------------------------------------------------
// HELPER: SEND AI REPLY
// ---------------------------------------------------------

var sendReply = function sendReply(toEmail, subject, aiBody) {
  var transporter;
  return regeneratorRuntime.async(function sendReply$(_context) {
    while (1) {
      switch (_context.prev = _context.next) {
        case 0:
          console.log("      🚀 STEP 4: Initializing SMTP...");
          _context.prev = 1;
          transporter = nodemailer.createTransport({
            service: 'gmail',
            auth: {
              user: process.env.EMAIL_USER,
              pass: process.env.EMAIL_PASS
            }
          });
          console.log("      \uD83D\uDE80 STEP 5: Sending reply to ".concat(toEmail, "..."));
          _context.next = 6;
          return regeneratorRuntime.awrap(transporter.sendMail({
            from: process.env.EMAIL_USER,
            to: toEmail,
            subject: "Re: ".concat(subject),
            text: aiBody
          }));

        case 6:
          console.log("      \u2705 STEP 6: Email SENT Successfully!");
          return _context.abrupt("return", true);

        case 10:
          _context.prev = 10;
          _context.t0 = _context["catch"](1);
          console.log("      \u274C SMTP ERROR: ".concat(_context.t0.message));
          return _context.abrupt("return", false);

        case 14:
        case "end":
          return _context.stop();
      }
    }
  }, null, null, [[1, 10]]);
}; // ---------------------------------------------------------
// MAIN: CHECK INBOX & AUTO-REPLY
// ---------------------------------------------------------


var checkAndReply = function checkAndReply() {
  var connection, searchCriteria, fetchOptions, messages, _iteratorNormalCompletion, _didIteratorError, _iteratorError, _iterator, _step, item, headerPart, textPart, fullRawEmail, mail, fromAddress, subject, bodyText, aiReply, sent;

  return regeneratorRuntime.async(function checkAndReply$(_context2) {
    while (1) {
      switch (_context2.prev = _context2.next) {
        case 0:
          console.log("\n📬 Checking Inbox for AI Auto-Response...");
          _context2.prev = 1;
          _context2.next = 4;
          return regeneratorRuntime.awrap(imaps.connect(config));

        case 4:
          connection = _context2.sent;
          _context2.next = 7;
          return regeneratorRuntime.awrap(connection.openBox('INBOX'));

        case 7:
          searchCriteria = ['UNSEEN'];
          fetchOptions = {
            bodies: ['HEADER', 'TEXT'],
            markSeen: false
          };
          _context2.next = 11;
          return regeneratorRuntime.awrap(connection.search(searchCriteria, fetchOptions));

        case 11:
          messages = _context2.sent;

          if (!(messages.length === 0)) {
            _context2.next = 16;
            break;
          }

          console.log("   (No new emails)");
          connection.end();
          return _context2.abrupt("return");

        case 16:
          console.log("   \uD83D\uDD0E Found ".concat(messages.length, " new message(s). Processing..."));
          _iteratorNormalCompletion = true;
          _didIteratorError = false;
          _iteratorError = undefined;
          _context2.prev = 20;
          _iterator = messages[Symbol.iterator]();

        case 22:
          if (_iteratorNormalCompletion = (_step = _iterator.next()).done) {
            _context2.next = 63;
            break;
          }

          item = _step.value;
          console.log("\n   --- PROCESSING NEW EMAIL ---"); // ✅ FIX: Extract HEADER + BODY

          headerPart = item.parts.find(function (p) {
            return p.which === 'HEADER';
          });
          textPart = item.parts.find(function (p) {
            return p.which === 'TEXT';
          });

          if (!(!headerPart || !textPart)) {
            _context2.next = 30;
            break;
          }

          console.log("   ⚠️ Skipping: Malformed email parts.");
          return _context2.abrupt("continue", 60);

        case 30:
          // ✅ FIX: Combine into FULL RAW EMAIL for parser
          fullRawEmail = headerPart.body + "\r\n\r\n" + textPart.body;
          console.log("   📝 STEP 1: Parsing email...");
          _context2.next = 34;
          return regeneratorRuntime.awrap(simpleParser(fullRawEmail));

        case 34:
          mail = _context2.sent;

          if (!(!mail.from || !mail.from.value || !mail.from.value[0])) {
            _context2.next = 38;
            break;
          }

          console.log("   ⚠️ Skipping: No valid sender found.");
          return _context2.abrupt("continue", 60);

        case 38:
          fromAddress = mail.from.value[0].address;
          subject = mail.subject || "No Subject";
          bodyText = mail.text ? mail.text.trim() : ""; // 🛑 Prevent Self-Reply

          if (!(fromAddress === process.env.EMAIL_USER)) {
            _context2.next = 46;
            break;
          }

          console.log("   🛑 Skipping: This is my own email.");
          _context2.next = 45;
          return regeneratorRuntime.awrap(connection.addFlags(item.attributes.uid, "\\Seen"));

        case 45:
          return _context2.abrupt("continue", 60);

        case 46:
          console.log("   \uD83D\uDCE9 From: ".concat(fromAddress));
          console.log("   \uD83D\uDCC4 Content: \"".concat(bodyText.substring(0, 80), "...\"")); // 🧠 STEP 2: AI GENERATION

          console.log("   🧠 STEP 2: Asking Ollama...");
          _context2.next = 51;
          return regeneratorRuntime.awrap(generateResponse(bodyText));

        case 51:
          aiReply = _context2.sent;
          console.log("   \uD83D\uDCA1 STEP 3: AI Generated Answer (Length: ".concat(aiReply.length, " chars)")); // 📤 STEP 3: SEND EMAIL

          _context2.next = 55;
          return regeneratorRuntime.awrap(sendReply(fromAddress, subject, aiReply));

        case 55:
          sent = _context2.sent;

          if (!sent) {
            _context2.next = 60;
            break;
          }

          console.log("   📌 Marking email as READ in Gmail...");
          _context2.next = 60;
          return regeneratorRuntime.awrap(connection.addFlags(item.attributes.uid, "\\Seen"));

        case 60:
          _iteratorNormalCompletion = true;
          _context2.next = 22;
          break;

        case 63:
          _context2.next = 69;
          break;

        case 65:
          _context2.prev = 65;
          _context2.t0 = _context2["catch"](20);
          _didIteratorError = true;
          _iteratorError = _context2.t0;

        case 69:
          _context2.prev = 69;
          _context2.prev = 70;

          if (!_iteratorNormalCompletion && _iterator["return"] != null) {
            _iterator["return"]();
          }

        case 72:
          _context2.prev = 72;

          if (!_didIteratorError) {
            _context2.next = 75;
            break;
          }

          throw _iteratorError;

        case 75:
          return _context2.finish(72);

        case 76:
          return _context2.finish(69);

        case 77:
          console.log("\n🏁 Closing Connection.");
          connection.end();
          _context2.next = 84;
          break;

        case 81:
          _context2.prev = 81;
          _context2.t1 = _context2["catch"](1);
          console.log("❌ CRITICAL ERROR:", _context2.t1.message);

        case 84:
        case "end":
          return _context2.stop();
      }
    }
  }, null, null, [[1, 81], [20, 65, 69, 77], [70,, 72, 76]]);
}; // ---------------------------------------------------------
// RUN
// ---------------------------------------------------------


checkAndReply();