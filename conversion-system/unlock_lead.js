/**
 * Unlock Lead - Reset lead's daily lock for testing
 * Usage: node unlock_lead.js [phone_number]
 * If no phone provided, unlocks all leads
 */

const fs = require('fs');
const path = require('path');

const LEADS_FILE = path.join(__dirname, 'processed_leads/clean_leads.json');

// Get phone number from command line argument
const targetPhone = process.argv[2];

const unlockLeads = () => {
    if (!fs.existsSync(LEADS_FILE)) {
        console.error('❌ Error: clean_leads.json not found');
        return;
    }

    const leads = JSON.parse(fs.readFileSync(LEADS_FILE, 'utf8'));
    const today = new Date().toISOString().split('T')[0];
    const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];

    let unlockedCount = 0;

    if (targetPhone) {
        // Unlock specific lead
        const lead = leads.find(l => l.phone === targetPhone || l.phone.includes(targetPhone));

        if (!lead) {
            console.error(`❌ Lead not found: ${targetPhone}`);
            console.log('\nAvailable leads:');
            leads.slice(0, 5).forEach(l => {
                console.log(`  - ${l.name}: ${l.phone} (Status: ${l.status})`);
            });
            return;
        }

        console.log(`\n🔓 Unlocking Lead: ${lead.name} (${lead.phone})`);
        console.log(`   Current Status: ${lead.status}`);
        console.log(`   Last Action: ${lead.last_action_date}`);
        console.log(`   Attempt Count: ${lead.attempt_count || 0}`);

        // Reset daily lock
        lead.last_action_date = yesterday;
        lead.next_action_due = today;

        console.log(`\n✅ Lead Unlocked!`);
        console.log(`   Next Action Due: ${today}`);
        console.log(`   Ready for orchestrator to process`);

        unlockedCount = 1;
    } else {
        // Unlock all leads
        console.log(`\n🔓 Unlocking ALL leads...`);

        leads.forEach(lead => {
            if (lead.last_action_date === today) {
                lead.last_action_date = yesterday;
                lead.next_action_due = today;
                unlockedCount++;
            }
        });

        console.log(`✅ Unlocked ${unlockedCount} lead(s)`);
    }

    // Save changes
    fs.writeFileSync(LEADS_FILE, JSON.stringify(leads, null, 2));
    console.log(`\n💾 Changes saved to clean_leads.json\n`);
};

// Run
unlockLeads();
