const axios = require('axios');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const DOGRAH_API_URL = process.env.DOGRAH_API_URL || 'http://3.95.139.180:8000';
const DOGRAH_API_KEY = process.env.DOGRAH_API_KEY;

async function probe(url, name) {
    try {
        console.log(`Testing ${name}: ${url}...`);
        const res = await axios.get(url, {
            headers: { 'Authorization': `Bearer ${DOGRAH_API_KEY}` },
            timeout: 5000
        });
        console.log(`✅ ${name} SUCCESS: status=${res.status}`);
        return true;
    } catch (e) {
        console.log(`❌ ${name} FAILED: ${e.response?.status || e.message} ${JSON.stringify(e.response?.data || {})}`);
        return false;
    }
}

async function test() {
    await probe(`${DOGRAH_API_URL}/api/v1/health`, 'Health V1');
    await probe(`${DOGRAH_API_URL}/api/health`, 'Health No-V');
    await probe(`${DOGRAH_API_URL}/api/v1/workflows`, 'Workflows V1 Plural');
    await probe(`${DOGRAH_API_URL}/api/v1/workflow`, 'Workflow V1 Singular');
    await probe(`${DOGRAH_API_URL}/api/workflows`, 'Workflows No-V Plural');
    await probe(`${DOGRAH_API_URL}/api/v1/telephony/initiate-call`, 'Telephony V1 (POST-test via GET)');
}

test();
