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

    if (!evt || evt.summary) return null; // Already done or missing

    // Flatten Transcript
    const transcriptText = evt.transcript.map(t => `${t.role.toUpperCase()}: ${t.content}`).join('\n');

    console.log(`      📝 Generating Summary for Event ${eventId}...`);

    // Use SalesBot
    // We reuse generateStructuredSummary but might want a simpler one for Mail?
    // User Requirement: "concise, two-line, human-readable summary"
    // Let's use a custom prompt here or adapt SalesBot?
    // SalesBot `generateStructuredSummary` returns a JSON object. We need that for the Lead File update.

    const summaryData = await generateStructuredSummary(transcriptText);

    // Fallback for Malformed structured summary
    if (summaryData.user_intent === 'error_parsing') {
        console.log("      ⚠️ Structured Summary Failed. Falling back to Text Summary...");
        const textFallback = await require('../agent/salesBot').generateTextSummary(transcriptText);
        summaryData.conversation_summary = textFallback;
    }

    // Finalize
    evt.summary = summaryData.conversation_summary;
    evt.structured_analysis = summaryData; // Store full JSON too in details
    evt.status = 'CLOSED';

    writeEvents(events);
    return summaryData;
};

module.exports = {
    openMailEvent,
    logMailInteraction,
    getOpenMailEvent,
    summarizeMailEvent
};
