const axios = require('axios');
const qs = require('qs'); // Built-in or usually available, else we use URLSearchParams

async function runsimulation() {
    console.log("🚀 SIMULATING TWILIO INPUT via GATEWAY (8080)...");

    const payload = {
        CallSid: 'SIM_GATEWAY_' + Date.now(),
        SpeechResult: 'Yes, I am listening.',
        Confidence: '0.99',
        From: '+917604896187',
        To: '+1555000000'
    };

    try {
        // Must send as x-www-form-urlencoded to match Twilio behavior
        // And hit port 8080 (Gateway)
        console.log(`\n📤 Sending POST to http://localhost:8080/voice/input`);

        const start = Date.now();
        const res = await axios.post('http://localhost:8080/voice/input', qs.stringify(payload), {
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
        });
        const duration = Date.now() - start;

        console.log(`\n✅ RESPONSE RECEIVED (${duration}ms):`);
        console.log(`   Status: ${res.status}`);
        console.log(`   TwiML: \n${res.data}`);

    } catch (error) {
        console.error(`\n❌ SIMULATION FAILED:`, error.message);
        if (error.response) {
            console.error(`   Status: ${error.response.status}`);
            console.error(`   Data: ${error.response.data}`);
        }
    }
}

runsimulation();
