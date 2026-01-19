const fs = require('fs');
const path = require('path');
const LEADS_FILE = path.join(__dirname, 'processed_leads/clean_leads.json');
const TEST_PHONE = 'whatsapp:+9999999999';
const TEST_EMAIL = 'test_verifier@example.com';

if (fs.existsSync(LEADS_FILE)) {
    let leads = JSON.parse(fs.readFileSync(LEADS_FILE, 'utf8'));
    const initialLen = leads.length;
    leads = leads.filter(l => l.phone !== TEST_PHONE && l.email !== TEST_EMAIL);
    fs.writeFileSync(LEADS_FILE, JSON.stringify(leads, null, 2));
    console.log(`Cleaned up ${initialLen - leads.length} test leads.`);
}
