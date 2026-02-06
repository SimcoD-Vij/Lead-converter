const fs = require('fs');
const path = require('path');
const { generateStructuredSummary } = require('../agent/salesBot');

const EVENTS_FILE = path.join(__dirname, '../processed_leads/lead-events.json');

// Helper to read events
const readEvents = () => {
    try {
        return JSON.parse(fs.readFileSync(EVENTS_FILE, 'utf8'));
    } catch (e) {
        return [];
    }
};

const writeEvents = (events) => {
    fs.writeFileSync(EVENTS_FILE, JSON.stringify(events, null, 2));
};

// 1. OPEN NEW MAIL EVENT
const openMailEvent = (leadId, initialContext) => {
    const events = readEvents();

    // Check if open event exists? Rule says "Each MAIL interaction maps to exactly one Event ID."
    // If we are sending OUTBOUND, we open a new one.

    const eventId = `evt_mail_${Date.now()}`;
    const newEvent = {
        event_id: eventId,
        lead_id: leadId,
        channel: 'MAIL',
        type: 'MAIL_THREAD_OPEN',
        timestamp: new Date().toISOString(),
        status: 'OPEN',
        transcript: [],
        summary: null // Deferred
    };

    if (initialContext) {
        newEvent.transcript.push({
            role: 'assistant',
            content: initialContext,
            timestamp: new Date().toISOString()
        });
    }

    events.push(newEvent);
    writeEvents(events);
    return eventId;
};

// 2. LOG INTERACTION (Append to Transcript)
const logMailInteraction = (eventId, role, content) => {
    const events = readEvents();
    const evt = events.find(e => e.event_id === eventId);
    if (!evt) return false;

    evt.transcript.push({
        role: role, // 'user' or 'assistant'
        content: content,
        timestamp: new Date().toISOString()
    });

    // Update timestamp of event to last touch
    evt.last_updated = new Date().toISOString();
    writeEvents(events);
    return true;
};

// 3. GET OPEN EVENT FOR LEAD
const getOpenMailEvent = (leadId) => {
    const events = readEvents();
    // Find event that is OPEN and channel matching MAIL or ANONYMOUS_MAIL logic?
    // Just simple filter
    return events.find(e => e.lead_id === leadId && e.channel === 'MAIL' && e.status === 'OPEN');
};

// 4. GENERATE SUMMARY (DEFERRED)
// Called by 'finalizeMailEvents' logic
const summarizeMailEvent = async (eventId) => {
    const events = readEvents();
    const evt = events.find(e => e.event_id === eventId);

    if (!evt) return null;

    // 0. IDEMPOTENCY & CAP CHECK
    if (['CLOSED', 'FAILED_FINAL'].includes(evt.status)) {
        return evt.structured_analysis || { conversation_summary: evt.summary };
    }

    evt.summary_attempts = (evt.summary_attempts || 0) + 1;
    if (evt.summary_attempts > 3) {
        console.error(`      ⛔ Event ${eventId} exceeded max summary attempts. Marking FAILED_FINAL.`);
        evt.status = 'FAILED_FINAL';
        evt.failure_reason = 'MAX_ATTEMPTS_EXCEEDED';
        writeEvents(events);
        return null; // Stop processing
    }

    writeEvents(events); // Persist attempt count immediately (Lock)

    // 1. Flatten Transcript (User Focused)
    // We include Assistant for context but can filter if needed. 
    // User Tip: "Never summarize ASSISTANT". Let's focus on USER content primarily.
    const transcriptText = (evt.transcript || [])
        .filter(t => t.role === 'user') // Focus on what User said
        .map(t => `${t.role.toUpperCase()}: ${t.content}`)
        .join('\n');

    if (!transcriptText) {
        // No user content? Just close it as NO_RESPONSE.
        evt.status = 'CLOSED';
        evt.summary = "Lead did not respond to the email drip.";
        evt.structured_analysis = {
            interest_level: 'low',
            user_intent: 'no_response',
            objections: 'none',
            next_action: 'continue_drip',
            conversation_summary: "Lead did not respond to the email drip."
        };
        writeEvents(events);
        console.log(`      ⏩ Event ${eventId} closed (No User Response).`);
        return evt.structured_analysis;
    }

    console.log(`      📝 Generating Summary for Event ${eventId} (Attempt ${evt.summary_attempts})...`);

    try {
        // 2. Use SalesBot
        const summaryData = await generateStructuredSummary(transcriptText);

        // Fallback for Malformed structured summary
        if (summaryData.user_intent === 'error_parsing') {
            const textFallback = await require('../agent/salesBot').generateTextSummary(transcriptText);
            summaryData.conversation_summary = textFallback;
        }

        // 3. Finalize Success
        evt.summary = summaryData.conversation_summary;
        evt.structured_analysis = summaryData;
        evt.status = 'CLOSED';

        console.log(`      ✅ Event Summarized and Closed: ${eventId}`);
    } catch (error) {
        console.error(`      ❌ Summary Failed for ${eventId}: ${error.message}`);
        // Do NOT set to CLOSED. Leave OPEN/RETRYING.
        // Attempt count was already incremented.
    }

    writeEvents(events); // Final Persistence
    return evt.structured_analysis;
};

module.exports = {
    openMailEvent,
    logMailInteraction,
    getOpenMailEvent,
    summarizeMailEvent
};
