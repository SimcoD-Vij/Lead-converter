"use strict";

function ownKeys(object, enumerableOnly) { var keys = Object.keys(object); if (Object.getOwnPropertySymbols) { var symbols = Object.getOwnPropertySymbols(object); if (enumerableOnly) symbols = symbols.filter(function (sym) { return Object.getOwnPropertyDescriptor(object, sym).enumerable; }); keys.push.apply(keys, symbols); } return keys; }

function _objectSpread(target) { for (var i = 1; i < arguments.length; i++) { var source = arguments[i] != null ? arguments[i] : {}; if (i % 2) { ownKeys(source, true).forEach(function (key) { _defineProperty(target, key, source[key]); }); } else if (Object.getOwnPropertyDescriptors) { Object.defineProperties(target, Object.getOwnPropertyDescriptors(source)); } else { ownKeys(source).forEach(function (key) { Object.defineProperty(target, key, Object.getOwnPropertyDescriptor(source, key)); }); } } return target; }

function _defineProperty(obj, key, value) { if (key in obj) { Object.defineProperty(obj, key, { value: value, enumerable: true, configurable: true, writable: true }); } else { obj[key] = value; } return obj; }

function _typeof(obj) { if (typeof Symbol === "function" && typeof Symbol.iterator === "symbol") { _typeof = function _typeof(obj) { return typeof obj; }; } else { _typeof = function _typeof(obj) { return obj && typeof Symbol === "function" && obj.constructor === Symbol && obj !== Symbol.prototype ? "symbol" : typeof obj; }; } return _typeof(obj); }

// conversion-system/json_manager.js
var fs = require('fs');

var path = require('path');

var LEADS_FILE = path.join(__dirname, 'processed_leads/clean_leads.json'); // Ensure file exists

if (!fs.existsSync(LEADS_FILE)) {
  var dir = path.dirname(LEADS_FILE);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, {
    recursive: true
  });
  fs.writeFileSync(LEADS_FILE, JSON.stringify([], null, 2));
} // 1. READ ALL LEADS


var readLeads = function readLeads() {
  try {
    var data = fs.readFileSync(LEADS_FILE, 'utf-8');
    return JSON.parse(data);
  } catch (e) {
    return [];
  }
}; // 2. WRITE ALL LEADS (Safely)


var saveLeads = function saveLeads(leads) {
  fs.writeFileSync(LEADS_FILE, JSON.stringify(leads, null, 2));
}; // 3. GET LEADS DUE FOR ACTION


var getDueLeads = function getDueLeads() {
  var leads = readLeads();
  var now = new Date();
  return leads.filter(function (lead) {
    if (lead.status === 'COMPLETED' || lead.status === 'STOPPED') return false;
    if (!lead.next_action_due) return true; // Immediate action if undefined

    return new Date(lead.next_action_due) <= now;
  });
}; // 4. UPDATE A SPECIFIC LEAD


var updateLead = function updateLead(phone, updates) {
  var leads = readLeads();
  var index = leads.findIndex(function (l) {
    // Handle legacy phone objects if necessary
    var p = _typeof(l.phone) === 'object' ? l.phone.phone : l.phone;
    return p === phone;
  });

  if (index !== -1) {
    // Merge updates
    leads[index] = _objectSpread({}, leads[index], {}, updates);
    saveLeads(leads); // console.log(`   💾 Updated JSON for ${leads[index].name}`);

    return true;
  }

  return false;
}; // 5. HELPER: CALCULATE FUTURE DATE


var addDays = function addDays(days) {
  var date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString();
};

module.exports = {
  readLeads: readLeads,
  saveLeads: saveLeads,
  getDueLeads: getDueLeads,
  updateLead: updateLead,
  addDays: addDays
};