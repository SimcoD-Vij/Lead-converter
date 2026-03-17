const axios = require('axios');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const DOGRAH_API_URL = process.env.DOGRAH_API_URL || 'http://3.95.139.180:8000';
const DOGRAH_API_KEY = process.env.DOGRAH_API_KEY;

async function test() {
    console.log(`URL: ${DOGRAH_API_URL}`);
    console.log(`KEY: ${DOGRAH_API_KEY ? DOGRAH_API_KEY.substring(0, 10) + '...' : 'MISSING'}`);

    try {
        console.log('--- TESTING PROTECTED ENDPOINT (/api/v1/workflows) ---');
        const response = await axios.get(`${DOGRAH_API_URL}/api/v1/workflows`, {
            headers: {
                'Authorization': `Bearer ${DOGRAH_API_KEY}`
            }
        });
        console.log('✅ Success! Workflows:', response.data);
    } catch (error) {
        console.error('❌ Failed:', error.response?.data || error.message);
    }
}

test();
