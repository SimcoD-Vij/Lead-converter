const fs = require('fs');
const path = require('path');
const { sync } = require('./sync_manual_update');

const WATCH_FILE = path.join(__dirname, 'voice', 'call_logs.json');
let debounceTimer;

console.log('👀 LOG WATCHER ACTIVE: Monitoring voice/call_logs.json for changes...\n');

fs.watch(WATCH_FILE, (eventType) => {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
        // Silent execution - only log errors
        sync(true).catch(err => console.error('❌ Watcher Sync Error:', err));
    }, 500);
});

function startWatcher() {
    // Already started above
}

module.exports = { startWatcher };
