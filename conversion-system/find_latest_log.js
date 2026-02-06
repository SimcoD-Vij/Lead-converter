const fs = require('fs');
const path = require('path');

const DIR = path.join(__dirname, 'voice/voice_conversations');

try {
    const files = fs.readdirSync(DIR);
    let latestFile = null;
    let latestTime = 0;

    files.forEach(f => {
        if (!f.endsWith('.json')) return;
        const fullPath = path.join(DIR, f);
        const stat = fs.statSync(fullPath);
        if (stat.mtimeMs > latestTime) {
            latestTime = stat.mtimeMs;
            latestFile = f;
        }
    });

    if (latestFile) {
        console.log(`Latest File: ${latestFile}`);
        console.log(`Time: ${new Date(latestTime).toISOString()}`);
        console.log("--- CONTENT ---");
        const content = fs.readFileSync(path.join(DIR, latestFile), 'utf8');
        console.log(content);
    } else {
        console.log("No JSON logs found.");
    }
} catch (e) {
    console.error(e.message);
}
