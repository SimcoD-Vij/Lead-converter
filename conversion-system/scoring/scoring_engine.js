// conversion-system/scoring/scoring_engine.js
// ---------------------------------------------------------
// SCORING ENGINE (MAX 100)
// ---------------------------------------------------------
// WEIGHTS:
// 1. INTENT (50%): Derived from AI Analysis of conversation
// 2. STATUS (30%): Derived from System State (Engagement depth)
// 3. RECENCY/EFFICIENCY (20%): Derived from Attempt Count (Early conversion is better)

/**
 * Calculates Score out of 100
 * @param {Object} lead - The lead object (for attempt count)
 * @param {String} intent - 'HOT', 'WARM', 'COLD', 'NEGATIVE' (from AI)
 * @param {String} status - Current System Status
 */
function calculateScore(lead, intent, status) {
    let score = 0;

    // 1. INTENT SCORE (Max 50) - MODIFIED WITH NEGATIVE SENTIMENT
    // ------------------------------------------------
    const i = (intent || 'COLD').toUpperCase();

    // ALERT: Analyze for Sentiment Penalties (New Feature)
    let penalty = 0;
    // We expect the 'intent' to potentially carry negative signals, or we rely on 'analyzeSentiment' called externally.
    // However, since we don't have the transcript here, we rely on the caller passing a 'sentiment_score' or similar.
    // BUT, for now, we will add a helper and assume 'lead.last_call_summary' might contain clues or we assume the caller (call_server) runs analysis.

    // BETTER APPROACH: Export 'analyzeSentiment' and let call_server use it to determine the 'intent' passed here.
    // So 'intent' becomes 'NEGATIVE' if analysis fails.

    if (i === 'NEGATIVE') score = 0;
    else if (i === 'HOT') score += 50;
    else if (i === 'WARM') score += 30;
    else if (i === 'COLD') score += 10;
    else score += 10;

    // Apply explicit penalty if passed (Future proofing)
    // For now, relies on SalesBot setting intent='NEGATIVE' correctly.
    if (lead.last_call_summary && lead.last_call_summary.transcript) {
        penalty = analyzeSentiment(lead.last_call_summary.transcript);
        score += penalty;
    }


    // 2. STATUS SCORE (Max 30)
    // ------------------------------------------------
    const s = (status || '').toUpperCase();

    // High Engagement
    if (['CALL_CONNECTED', 'SMS_ENGAGED', 'MAIL_ENGAGED', 'CALL_INTERESTED', 'HUMAN_HANDOFF'].includes(s)) {
        score += 30;
    }
    // Moderate Engagement
    else if (['SMS_REPLIED', 'SMS_RECEIVED', 'MAIL_OPENED', 'MAIL_RECEIVED', 'CALL_TO_SMS_FOLLOWUP'].includes(s)) {
        score += 20;
    }
    // Low Engagement (Delivery)
    else if (['SMS_DELIVERED', 'MAIL_DELIVERED', 'CALL_NO_ANSWER', 'CALL_BUSY'].includes(s)) {
        score += 10;
    }
    // Basic Sent
    else {
        score += 5;
    }

    // 3. EFFICIENCY SCORE (Max 20)
    // ------------------------------------------------
    // Reward converting early. Penalize dragging on.
    const attempt = lead.attempt_count || 0;

    if (attempt <= 3) score += 20;      // Early Bird
    else if (attempt <= 6) score += 10; // Mid Game
    else if (attempt <= 9) score += 5;  // Late
    else score += 0;                    // Overdue

    // 4. BOUNDS & CATEGORIZATION
    if (score > 100) score = 100;
    if (score < 0) score = 0;

    return {
        score: score,
        category: getCategory(score),
        intent_level: i
    };
}

function getCategory(score) {
    if (score >= 70) return 'HOT';
    if (score >= 40) return 'WARM';
    return 'COLD';
}

function analyzeSentiment(transcript) {
    if (!transcript || !Array.isArray(transcript)) return 0;

    // 1. Analyze User Turns (Last 3)
    const userTurns = transcript.filter(t => t.role === 'user').slice(-3);
    const negativeKeywords = ["not worth", "bad", "cheat", "scam", "too high", "expensive", "hang up", "don't want", "fraud", "useless", "fake", "cheaper"];

    for (const t of userTurns) {
        if (negativeKeywords.some(k => t.text.toLowerCase().includes(k))) return -50;
    }

    // 2. Analyze AI Refusals
    const aiTurns = transcript.filter(t => t.role === 'assistant').slice(-3);
    const refusalKeywords = ["cannot assist", "can't answer", "unable to provide", "apologize"];

    for (const t of aiTurns) {
        if (refusalKeywords.some(k => t.text.toLowerCase().includes(k))) return -30;
    }

    return 0; // Neutral
}

module.exports = { calculateScore, getCategory, analyzeSentiment };