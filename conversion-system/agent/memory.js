const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const fs = require('fs');
const { MEMORY_FILE } = require('./config');

// PATHS
const LEADS_FILE = path.resolve(__dirname, '../../processed_leads/clean_leads.json');

function ensureStorage() {
    const dir = path.dirname(MEMORY_FILE);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    if (!fs.existsSync(MEMORY_FILE)) fs.writeFileSync(MEMORY_FILE, JSON.stringify({}), 'utf8');
}

function readAll() {
    ensureStorage();
    const raw = fs.readFileSync(MEMORY_FILE, 'utf8');
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
async function getMemory(leadId) {
    const db = readAll();
    const activeMemory = db[leadId] || { history: [], status: 'NEW' };

    // 1. Get Short Term History (Raw turns) - Safety Check Added
    let history = Array.isArray(activeMemory.history) ? activeMemory.history : [];

    // 2. Get Long Term Context (From Lead DB Summary)
    let summaryContext = "";
    if (fs.existsSync(LEADS_FILE)) {
        try {
            const leads = JSON.parse(fs.readFileSync(LEADS_FILE, 'utf8'));
            const lead = leads.find(l => l.phone === leadId || l.phone === leadId.replace('whatsapp:', ''));

            if (lead && lead.last_call_summary) {
                const s = lead.last_call_summary;
                if (typeof s === 'string') {
                    summaryContext = s;
                } else {
                    summaryContext = `PREVIOUS SUMMARY: ${s.summary || "N/A"}. User Intent was: ${s.intent || "Unknown"}.`;
                }
            }
        } catch (e) {
            console.error("⚠️ Error reading lead summary:", e.message);
        }
    }

    return {
        history: history,
        summaryContext: summaryContext,
        status: activeMemory.status
    };
}

// CRITICAL FIX FOR YOUR ERROR: "prev.history is not iterable"
async function upsertMemory(leadId, patch = {}) {
    const db = readAll();
    const prev = db[leadId] || {};

    // FAILSAFE: If history doesn't exist or isn't an array, force it to []
    const currentHistory = Array.isArray(prev.history) ? prev.history : [];

    let newHistory = currentHistory;
    if (patch.history) {
        newHistory = [...currentHistory, ...patch.history];
        // Keep only last 20 turns to prevent file bloat
        if (newHistory.length > 20) newHistory = newHistory.slice(-20);
    }

    const now = {
        ...prev,
        ...patch,
        history: newHistory,
        updated_at: new Date().toISOString()
    };

    db[leadId] = now;
    writeAll(db);
    return now;
}

module.exports = { getMemory, upsertMemory };