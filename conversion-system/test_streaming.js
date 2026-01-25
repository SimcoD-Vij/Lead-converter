
const axios = require('axios');
const fs = require('fs');
const path = require('path');

async function testStreaming() {
    console.log("Testing Streaming TTS...");
    const ttsUrl = 'http://localhost:8020/tts';
    const text = "This is a test of the streaming system.";
    const filename = `test_stream_${Date.now()}.wav`;
    const outputPath = path.join(__dirname, 'test_audio.wav');

    try {
        const writer = fs.createWriteStream(outputPath);
        console.log(`Requesting ${ttsUrl}...`);

        const res = await axios.post(ttsUrl, { text, speed: 1.3 }, { responseType: 'stream' });

        res.data.pipe(writer);

        await new Promise((resolve, reject) => {
            writer.on('finish', resolve);
            writer.on('error', reject);
        });

        console.log(`✅ Success! Audio saved to ${outputPath}`);
        console.log(`File size: ${fs.statSync(outputPath).size} bytes`);

    } catch (e) {
        console.error("❌ Failed:", e.message);
        if (e.response) {
            console.error("Status:", e.response.status);
            e.response.data.pipe(process.stderr);
        }
    }
}

testStreaming();
