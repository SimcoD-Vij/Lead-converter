"use strict";

// ---------------------------------------------------------
// TASK 1: LEAD IMPORTER (FINAL MERGED VERSION)
// ---------------------------------------------------------
// 1. IMPORTS
require('dotenv').config({
  path: '../.env'
});

var fs = require('fs'); // To write files


var path = require('path'); // To handle folder paths


var axios = require('axios');

var _require = require('libphonenumber-js'),
    parsePhoneNumber = _require.parsePhoneNumber; // 2. FILE SYSTEM CONFIGURATION
// This sets up the folder: processed_leads


var OUTPUT_DIR = path.join(__dirname, '../processed_leads');
var FILES = {
  CLEAN: path.join(OUTPUT_DIR, 'clean_leads.json'),
  BAD_EMAIL: path.join(OUTPUT_DIR, 'invalid_emails.json'),
  BAD_PHONE: path.join(OUTPUT_DIR, 'invalid_numbers.json')
}; // 3. HELPER: STORAGE ENGINE

var saveToJSON = function saveToJSON(filePath, data) {
  // A. Create folder if it doesn't exist
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR);
  } // B. Create file if it doesn't exist (start with empty list [])


  if (!fs.existsSync(filePath)) {
    fs.writeFileSync(filePath, JSON.stringify([], null, 2));
  } // C. Read, Push, Write


  var fileContent = fs.readFileSync(filePath, 'utf-8');
  var jsonList = JSON.parse(fileContent);
  jsonList.push(data); // Add the new lead

  fs.writeFileSync(filePath, JSON.stringify(jsonList, null, 2));
}; // 4. HELPER: CLEANING TOOLS


var toTitleCase = function toTitleCase(str) {
  if (!str) return "Unknown";
  return str.trim() // Remove side spaces
  .toLowerCase().split(/\s+/) // Split by ANY whitespace (fixes double spaces)
  .map(function (w) {
    return w.charAt(0).toUpperCase() + w.slice(1);
  }).join(' ');
}; // 5. HELPER: PHONE NORMALIZATION (Abstract API + Library Fallback)


var normalizePhone = function normalizePhone(phone, countryCode) {
  var rawPhone, apiKey, url, response, data, cleanNumber, p;
  return regeneratorRuntime.async(function normalizePhone$(_context) {
    while (1) {
      switch (_context.prev = _context.next) {
        case 0:
          // 1. Clean the input first (Remove spaces, dashes, keep only numbers and +)
          rawPhone = phone.toString().replace(/[^0-9+]/g, '');
          apiKey = process.env.ABSTRACT_API_KEY; // 2. Try Abstract API (If Key Exists)

          if (!(apiKey && !apiKey.includes('your_key'))) {
            _context.next = 23;
            break;
          }

          _context.prev = 3;
          console.log("   \uD83D\uDD0E Validating ".concat(rawPhone, " with Abstract API..."));
          url = "https://phonevalidation.abstractapi.com/v1/?api_key=".concat(apiKey, "&phone=").concat(rawPhone);
          _context.next = 8;
          return regeneratorRuntime.awrap(axios.get(url));

        case 8:
          response = _context.sent;
          data = response.data; // CHECK: Did the API say it's valid?

          if (!(data.valid === true)) {
            _context.next = 16;
            break;
          }

          // MNC STANDARD: Returns string "+919876543210"
          cleanNumber = data.format.international.replace(/\s/g, '');
          console.log("      \u2705 API Verified: ".concat(cleanNumber));
          return _context.abrupt("return", cleanNumber);

        case 16:
          console.log("      ❌ API said Invalid Number");
          return _context.abrupt("return", null);

        case 18:
          _context.next = 23;
          break;

        case 20:
          _context.prev = 20;
          _context.t0 = _context["catch"](3);
          console.log("      ⚠️ API Error. Falling back to library...");

        case 23:
          _context.prev = 23;
          p = parsePhoneNumber(rawPhone, countryCode);

          if (!(p && p.isValid())) {
            _context.next = 27;
            break;
          }

          return _context.abrupt("return", p.number);

        case 27:
          _context.next = 32;
          break;

        case 29:
          _context.prev = 29;
          _context.t1 = _context["catch"](23);
          return _context.abrupt("return", null);

        case 32:
          return _context.abrupt("return", null);

        case 33:
        case "end":
          return _context.stop();
      }
    }
  }, null, null, [[3, 20], [23, 29]]);
}; // 6. HELPER: EMAIL VALIDATION ENGINE


var validateEmail = function validateEmail(email) {
  var emailRegex, apiKey, url, response, result;
  return regeneratorRuntime.async(function validateEmail$(_context2) {
    while (1) {
      switch (_context2.prev = _context2.next) {
        case 0:
          // 1. Basic Syntax Check
          emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

          if (emailRegex.test(email)) {
            _context2.next = 4;
            break;
          }

          console.log("   \u274C Logic: Email syntax is wrong");
          return _context2.abrupt("return", false);

        case 4:
          // 2. API Check
          apiKey = process.env.KICKBOX_API_KEY; // Safety Check: Fail Open if key is missing

          if (!(!apiKey || apiKey.includes('your_actual'))) {
            _context2.next = 8;
            break;
          }

          console.log("   ⚠️ Warning: No valid API Key found. Skipping verification.");
          return _context2.abrupt("return", true);

        case 8:
          _context2.prev = 8;
          console.log("   \uD83D\uDD0E Checking ".concat(email, " with Kickbox..."));
          url = "https://api.kickbox.com/v2/verify?email=".concat(email, "&apikey=").concat(apiKey);
          _context2.next = 13;
          return regeneratorRuntime.awrap(axios.get(url));

        case 13:
          response = _context2.sent;
          result = response.data.result;

          if (!(result === 'deliverable' || result === 'risky')) {
            _context2.next = 20;
            break;
          }

          console.log("      \u2705 API: Email is valid (Status: ".concat(result, ")"));
          return _context2.abrupt("return", true);

        case 20:
          console.log("      \u274C API: Email rejected (Status: ".concat(result, ")"));
          return _context2.abrupt("return", false);

        case 22:
          _context2.next = 28;
          break;

        case 24:
          _context2.prev = 24;
          _context2.t0 = _context2["catch"](8);
          console.log("      ⚠️ API Error (Allowing lead anyway):", _context2.t0.message);
          return _context2.abrupt("return", true);

        case 28:
        case "end":
          return _context2.stop();
      }
    }
  }, null, null, [[8, 24]]);
}; // 7. MAIN PROCESSOR


var processLead = function processLead(rawLead) {
  var validPhone, cleanLead, isEmailValid;
  return regeneratorRuntime.async(function processLead$(_context3) {
    while (1) {
      switch (_context3.prev = _context3.next) {
        case 0:
          console.log("\n\uD83D\uDE80 Processing: ".concat(rawLead.name, "...")); // --- CRITICAL FIX: AWAIT THE PHONE NUMBER HERE ---
          // If we don't await, it returns a Promise object {}, causing the bug you saw.

          _context3.next = 3;
          return regeneratorRuntime.awrap(normalizePhone(rawLead.phone, rawLead.country));

        case 3:
          validPhone = _context3.sent;
          // Step A: Create the Clean Object
          cleanLead = {
            name: toTitleCase(rawLead.name),
            company: toTitleCase(rawLead.company || "Unknown"),
            email: rawLead.email.trim().toLowerCase(),
            phone: validPhone,
            // Now this is a real string, not a Promise
            status: "PENDING",
            timestamp: new Date().toISOString()
          }; // Step B: Validate Phone

          if (cleanLead.phone) {
            _context3.next = 10;
            break;
          }

          console.log("   ❌ Failed: Invalid Phone Number");
          cleanLead.status = "INVALID_PHONE";
          saveToJSON(FILES.BAD_PHONE, cleanLead);
          return _context3.abrupt("return");

        case 10:
          _context3.next = 12;
          return regeneratorRuntime.awrap(validateEmail(cleanLead.email));

        case 12:
          isEmailValid = _context3.sent;

          if (isEmailValid) {
            _context3.next = 18;
            break;
          }

          console.log("   ❌ Failed: Invalid Email");
          cleanLead.status = "INVALID_EMAIL";
          saveToJSON(FILES.BAD_EMAIL, cleanLead);
          return _context3.abrupt("return");

        case 18:
          // Step D: Success
          console.log("   ✅ Success! Lead Saved to clean_leads.json");
          cleanLead.status = "VERIFIED";
          saveToJSON(FILES.CLEAN, cleanLead);

        case 21:
        case "end":
          return _context3.stop();
      }
    }
  });
}; // 8. TEST DATA


var testLeads = [{
  name: "Vijaypargavan R S",
  phone: "7604896187",
  email: "rsvijaypargavan@gmail.com",
  country: "IN",
  company: "zedbee"
}, {
  name: "Fake User",
  phone: "000",
  email: "fake@gmail.com",
  country: "IN"
}]; // Run the batch

(function _callee() {
  var _iteratorNormalCompletion, _didIteratorError, _iteratorError, _iterator, _step, lead;

  return regeneratorRuntime.async(function _callee$(_context4) {
    while (1) {
      switch (_context4.prev = _context4.next) {
        case 0:
          // Clear old clean file to prevent duplicates during testing (Optional)
          if (fs.existsSync(FILES.CLEAN)) fs.unlinkSync(FILES.CLEAN);
          _iteratorNormalCompletion = true;
          _didIteratorError = false;
          _iteratorError = undefined;
          _context4.prev = 4;
          _iterator = testLeads[Symbol.iterator]();

        case 6:
          if (_iteratorNormalCompletion = (_step = _iterator.next()).done) {
            _context4.next = 13;
            break;
          }

          lead = _step.value;
          _context4.next = 10;
          return regeneratorRuntime.awrap(processLead(lead));

        case 10:
          _iteratorNormalCompletion = true;
          _context4.next = 6;
          break;

        case 13:
          _context4.next = 19;
          break;

        case 15:
          _context4.prev = 15;
          _context4.t0 = _context4["catch"](4);
          _didIteratorError = true;
          _iteratorError = _context4.t0;

        case 19:
          _context4.prev = 19;
          _context4.prev = 20;

          if (!_iteratorNormalCompletion && _iterator["return"] != null) {
            _iterator["return"]();
          }

        case 22:
          _context4.prev = 22;

          if (!_didIteratorError) {
            _context4.next = 25;
            break;
          }

          throw _iteratorError;

        case 25:
          return _context4.finish(22);

        case 26:
          return _context4.finish(19);

        case 27:
          console.log("\n🏁 Batch Processing Complete.");

        case 28:
        case "end":
          return _context4.stop();
      }
    }
  }, null, null, [[4, 15, 19, 27], [20,, 22, 26]]);
})();