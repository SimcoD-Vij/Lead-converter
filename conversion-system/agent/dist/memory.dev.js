"use strict";

function ownKeys(object, enumerableOnly) { var keys = Object.keys(object); if (Object.getOwnPropertySymbols) { var symbols = Object.getOwnPropertySymbols(object); if (enumerableOnly) symbols = symbols.filter(function (sym) { return Object.getOwnPropertyDescriptor(object, sym).enumerable; }); keys.push.apply(keys, symbols); } return keys; }

function _objectSpread(target) { for (var i = 1; i < arguments.length; i++) { var source = arguments[i] != null ? arguments[i] : {}; if (i % 2) { ownKeys(source, true).forEach(function (key) { _defineProperty(target, key, source[key]); }); } else if (Object.getOwnPropertyDescriptors) { Object.defineProperties(target, Object.getOwnPropertyDescriptors(source)); } else { ownKeys(source).forEach(function (key) { Object.defineProperty(target, key, Object.getOwnPropertyDescriptor(source, key)); }); } } return target; }

function _defineProperty(obj, key, value) { if (key in obj) { Object.defineProperty(obj, key, { value: value, enumerable: true, configurable: true, writable: true }); } else { obj[key] = value; } return obj; }

function _toConsumableArray(arr) { return _arrayWithoutHoles(arr) || _iterableToArray(arr) || _nonIterableSpread(); }

function _nonIterableSpread() { throw new TypeError("Invalid attempt to spread non-iterable instance"); }

function _iterableToArray(iter) { if (Symbol.iterator in Object(iter) || Object.prototype.toString.call(iter) === "[object Arguments]") return Array.from(iter); }

function _arrayWithoutHoles(arr) { if (Array.isArray(arr)) { for (var i = 0, arr2 = new Array(arr.length); i < arr.length; i++) { arr2[i] = arr[i]; } return arr2; } }

// agent/memory.js
require('dotenv').config({
  path: '../.env'
});

var fs = require('fs');

var path = require('path');

var _require = require('./config'),
    MEMORY_FILE = _require.MEMORY_FILE; // PATHS


var LEADS_FILE = path.resolve(__dirname, '../../processed_leads/clean_leads.json');

function ensureStorage() {
  var dir = path.dirname(MEMORY_FILE);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, {
    recursive: true
  });
  if (!fs.existsSync(MEMORY_FILE)) fs.writeFileSync(MEMORY_FILE, JSON.stringify({}), 'utf8');
}

function readAll() {
  ensureStorage();
  var raw = fs.readFileSync(MEMORY_FILE, 'utf8');

  try {
    return JSON.parse(raw || '{}');
  } catch (e) {
    return {};
  }
}

function writeAll(data) {
  ensureStorage();
  fs.writeFileSync(MEMORY_FILE, JSON.stringify(data, null, 2), 'utf8');
}
/**
 * Enhanced getMemory:
 * Returns { history: [], summaryContext: "string" }
 */


function getMemory(leadId) {
  var db, activeMemory, history, summaryContext, leads, lead, s;
  return regeneratorRuntime.async(function getMemory$(_context) {
    while (1) {
      switch (_context.prev = _context.next) {
        case 0:
          db = readAll();
          activeMemory = db[leadId] || {
            history: [],
            status: 'NEW'
          }; // 1. Get Short Term History (Raw turns) - Safety Check Added

          history = Array.isArray(activeMemory.history) ? activeMemory.history : []; // 2. Get Long Term Context (From Lead DB Summary)

          summaryContext = "";

          if (fs.existsSync(LEADS_FILE)) {
            try {
              leads = JSON.parse(fs.readFileSync(LEADS_FILE, 'utf8'));
              lead = leads.find(function (l) {
                return l.phone === leadId || l.phone === leadId.replace('whatsapp:', '');
              });

              if (lead && lead.last_call_summary) {
                s = lead.last_call_summary;

                if (typeof s === 'string') {
                  summaryContext = s;
                } else {
                  summaryContext = "PREVIOUS SUMMARY: ".concat(s.summary || "N/A", ". User Intent was: ").concat(s.intent || "Unknown", ".");
                }
              }
            } catch (e) {
              console.error("⚠️ Error reading lead summary:", e.message);
            }
          }

          return _context.abrupt("return", {
            history: history,
            summaryContext: summaryContext,
            status: activeMemory.status
          });

        case 6:
        case "end":
          return _context.stop();
      }
    }
  });
} // CRITICAL FIX FOR YOUR ERROR: "prev.history is not iterable"


function upsertMemory(leadId) {
  var patch,
      db,
      prev,
      currentHistory,
      newHistory,
      now,
      _args2 = arguments;
  return regeneratorRuntime.async(function upsertMemory$(_context2) {
    while (1) {
      switch (_context2.prev = _context2.next) {
        case 0:
          patch = _args2.length > 1 && _args2[1] !== undefined ? _args2[1] : {};
          db = readAll();
          prev = db[leadId] || {}; // FAILSAFE: If history doesn't exist or isn't an array, force it to []

          currentHistory = Array.isArray(prev.history) ? prev.history : [];
          newHistory = currentHistory;

          if (patch.history) {
            newHistory = [].concat(_toConsumableArray(currentHistory), _toConsumableArray(patch.history)); // Keep only last 20 turns to prevent file bloat

            if (newHistory.length > 20) newHistory = newHistory.slice(-20);
          }

          now = _objectSpread({}, prev, {}, patch, {
            history: newHistory,
            updated_at: new Date().toISOString()
          });
          db[leadId] = now;
          writeAll(db);
          return _context2.abrupt("return", now);

        case 10:
        case "end":
          return _context2.stop();
      }
    }
  });
}

module.exports = {
  getMemory: getMemory,
  upsertMemory: upsertMemory
};