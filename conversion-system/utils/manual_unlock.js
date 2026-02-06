const fs = require('fs');
const path = require('path');

const LEADS_FILE = path.join(__dirname, '../processed_leads/clean_leads.json');
const TARGET_PHONE = "+917604896187";

const unlock = () => {
    if (!fs.existsSync(LEADS_FILE)) {
        console.error("Leads file not found");
        return;
    }

    const leads = JSON.parse(fs.readFileSync(LEADS_FILE, 'utf8'));
    const lead = leads.find(l => l.phone === TARGET_PHONE);

    if (lead) {
        console.log(`Found Lead: ${lead.name}`);
        console.log(`Current Lock Date: ${lead.last_action_date}`);

        // UNLOCK
        lead.last_action_date = "2026-01-25"; // Set to Yesterday
        console.log(`New Lock Date: ${lead.last_action_date} (UNLOCKED)`);

        fs.writeFileSync(LEADS_FILE, JSON.stringify(leads, null, 2));
        console.log("Saved.");
    } else {
        console.error("Lead not found!");
    }
};

unlock();
