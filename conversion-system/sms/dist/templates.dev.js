"use strict";

// ---------------------------------------------------------
// SMS & WHATSAPP TEMPLATES
// ---------------------------------------------------------
var templates = {
  // Gentle nudge after a missed call
  "SMS_1": "Hi {name}, I tried calling earlier regarding {company}. Are you free for a quick chat tomorrow? - AI Assistant",
  // Final attempt
  "SMS_2": "Hi {name}, just checking in. Let me know if you'd prefer an email instead. Thanks!"
};

var fillSMSTemplate = function fillSMSTemplate(templateId, lead) {
  var text = templates[templateId];
  if (!text) return null; // Personalization Logic

  return text.replace("{name}", lead.name.split(' ')[0]) // Use First Name only
  .replace("{company}", lead.company || "your company");
};

module.exports = {
  fillSMSTemplate: fillSMSTemplate
};