// conversion-system/json_manager.js
const fs = require('fs');
const path = require('path');

const LEADS_FILE = path.join(__dirname, 'processed_leads/clean_leads.json');

// Ensure file exists
if (!fs.existsSync(LEADS_FILE)) {
    const dir = path.dirname(LEADS_FILE);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(LEADS_FILE, JSON.stringify([], null, 2));
}

// 1. READ ALL LEADS
const readLeads = () => {
    try {
        const data = fs.readFileSync(LEADS_FILE, 'utf-8');
        return JSON.parse(data);
    } catch (e) {
        return [];
    }
};

// 2. WRITE ALL LEADS (Safely)
const saveLeads = (leads) => {
    fs.writeFileSync(LEADS_FILE, JSON.stringify(leads, null, 2));
};

// 3. GET LEADS DUE FOR ACTION
const getDueLeads = () => {
    const leads = readLeads();
    const now = new Date();
    
    return leads.filter(lead => {
        if (lead.status === 'COMPLETED' || lead.status === 'STOPPED') return false;
        if (!lead.next_action_due) return true; // Immediate action if undefined
        return new Date(lead.next_action_due) <= now;
    });
};

// 4. UPDATE A SPECIFIC LEAD
const updateLead = (phone, updates) => {
    const leads = readLeads();
    const index = leads.findIndex(l => {
        // Handle legacy phone objects if necessary
        const p = typeof l.phone === 'object' ? l.phone.phone : l.phone;
        return p === phone;
    });

    if (index !== -1) {
        // Merge updates
        leads[index] = { ...leads[index], ...updates };
        saveLeads(leads);
        // console.log(`   💾 Updated JSON for ${leads[index].name}`);
        return true;
    }
    return false;
};

// 5. HELPER: CALCULATE FUTURE DATE
const addDays = (days) => {
    const date = new Date();
    date.setDate(date.getDate() + days);
    return date.toISOString();
};

module.exports = { readLeads, saveLeads, getDueLeads, updateLead, addDays };