"use strict";

// conversion-system/scoring/scoring_engine.js
// ---------------------------------------------------------
// SCORING ENGINE (STRICT RULES)
// ---------------------------------------------------------

/**
 * Calculates the lead score based on current state and interaction.
 * Score is capped between 0 and 100.
 */
function calculateScore(lead, input, state) {
  var score = lead.score || 0; // Cumulative
  // 1. STATE BASED ADJUSTMENTS (Major Signals)

  if (state === 'POSITIVE') score += 25;
  if (state === 'LATER') score -= 20; // Repeated delays reduce score

  if (state === 'NEGATIVE') score -= 30; // Heavy penalty

  if (state === 'COLD_LEAD') score -= 40; // Terminal penalty
  // 2. EVENT BASED ADJUSTMENTS (Micro Signals)

  if (input) {
    var lower = input.toLowerCase(); // "Requesting details / Rollback"

    if (lower.match(/send|details|link|whatsapp|mail/)) {
      score += 15;
    } // "Agreeing to call"


    if (lower.match(/call me|yes|sure|okay/)) {
      score += 10;
    } // "Responding at all" (Any valid human reply is good)


    score += 10;
  } // 3. MULTI-CHANNEL BONUS
  // If they have engaged on both Voice and SMS, they are high intent


  var hasSms = lead.last_sms_time ? true : false;
  var hasCall = lead.last_call_time ? true : false;

  if (hasSms && hasCall) {
    // Ensure we don't add this bonus multiple times (simple check)
    if (!lead.multi_channel_bonus_applied) {
      score += 5;
      lead.multi_channel_bonus_applied = true;
    }
  } // 4. GHOSTING PENALTY
  // If processLeadState was called without input (Automatic Follow-up)
  // it means they ghosted the previous attempt.


  if (!input && lead.status !== 'NEW') {
    score -= 10;
  } // 5. BOUNDARY CAP (0 - 100)


  if (score > 100) score = 100;
  if (score < 0) score = 0;
  return score;
}

module.exports = {
  calculateScore: calculateScore
};