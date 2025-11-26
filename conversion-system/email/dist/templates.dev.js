"use strict";

function _slicedToArray(arr, i) { return _arrayWithHoles(arr) || _iterableToArrayLimit(arr, i) || _nonIterableRest(); }

function _nonIterableRest() { throw new TypeError("Invalid attempt to destructure non-iterable instance"); }

function _iterableToArrayLimit(arr, i) { if (!(Symbol.iterator in Object(arr) || Object.prototype.toString.call(arr) === "[object Arguments]")) { return; } var _arr = []; var _n = true; var _d = false; var _e = undefined; try { for (var _i = arr[Symbol.iterator](), _s; !(_n = (_s = _i.next()).done); _n = true) { _arr.push(_s.value); if (i && _arr.length === i) break; } } catch (err) { _d = true; _e = err; } finally { try { if (!_n && _i["return"] != null) _i["return"](); } finally { if (_d) throw _e; } } return _arr; }

function _arrayWithHoles(arr) { if (Array.isArray(arr)) return arr; }

// MNC STANDARD: TEMPLATE MANAGER
// This file holds the scripts. It allows the sales team to change text
// without touching the complex code engine.
var templates = {
  // DAY 1: The Hook
  "EMAIL_1": {
    subject: "Question about {company}",
    body: "Hi {name},\n\nI noticed your work at {company} and wanted to reach out.\n\nWe help companies in {location} scale their sales process.\nAre you open to a quick 10-min chat this week?\n\nBest,\nThe AI Intern"
  },
  // DAY 3: The Nudge (Short & Sweet)
  "EMAIL_2": {
    subject: "Re: Question about {company}",
    body: "Hi {name},\n\nJust bubbling this up in case it got buried.\nWould love to show you how we handled this for other {industry} companies.\n\nBest,\nThe AI Intern"
  },
  // DAY 7: The Breakup (Polite closing)
  "EMAIL_3": {
    subject: "Last try?",
    body: "Hi {name},\n\nI haven't heard back, so I assume you're super busy or this isn't a priority.\nI'll close your file for now.\n\nHere is a link to our deck if you ever want to check it out later.\n\nCheers,\nThe AI Intern"
  }
}; // Helper function to replace {tokens}

var fillTemplate = function fillTemplate(templateId, lead) {
  var template = templates[templateId];
  if (!template) return null;
  var subject = template.subject;
  var body = template.body; // MNC TRICK: Use a map to replace all tokens dynamically
  // If lead.company is missing, fallback to "your company"

  var replacements = {
    "{name}": lead.name.split(' ')[0],
    // Use First Name only
    "{company}": lead.company || "your company",
    "{location}": lead.location || "your area",
    "{industry}": "Technology" // Default for now

  }; // Loop through replacements and swap them in text

  for (var _i = 0, _Object$entries = Object.entries(replacements); _i < _Object$entries.length; _i++) {
    var _Object$entries$_i = _slicedToArray(_Object$entries[_i], 2),
        key = _Object$entries$_i[0],
        value = _Object$entries$_i[1];

    subject = subject.replaceAll(key, value);
    body = body.replaceAll(key, value);
  }

  return {
    subject: subject,
    body: body
  };
};

module.exports = {
  fillTemplate: fillTemplate
};