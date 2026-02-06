const fs = require('fs');
const path = require('path');

const LEADS_FILE = path.join(__dirname, '../processed_leads/clean_leads.json');
const TARGET_PHONE = "+917604896187";

const resetList = () => {
    if (!fs.existsSync(LEADS_FILE)) return;

    const leads = JSON.parse(fs.readFileSync(LEADS_FILE, 'utf8'));
    const lead = leads.find(l => l.phone === TARGET_PHONE);

    if (lead) {
        console.log(`Resetting Lead: ${lead.name}`);
        lead.attempt_count = 0;
        lead.last_action_date = "2026-01-25"; // Yesterday
        lead.next_action_due = "2026-01-26"; // Due Today
        lead.status = "NEW_LEAD";
        // Clear history ref if needed? Maybe keep it for context test? 
        // User wants "Live human response", so keeping history is fine, 
        // but for a true "Fresh" test we might want to carry over context or wipe it. 
        // Let's keep context to show "memory" feature working.

        fs.writeFileSync(LEADS_FILE, JSON.stringify(leads, null, 2));
        console.log("Lead Reset Complete. Ready for Attempt 1.");
    }
};

resetList();
