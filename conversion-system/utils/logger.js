const fs = require('fs');
const path = require('path');

const LOG_FILE = path.join(__dirname, '../system_debug.log');

/**
 * Appends a log entry to system_debug.log
 * @param {string} component - [ORCHESTRATOR], [SALESBOT], [MCP], [VOICE]
 * @param {string} message - The message
 * @param {object} data - Optional data object to stringify
 */
function logSystem(component, message, data = null) {
    const timestamp = new Date().toISOString();
    let logLine = `[${timestamp}] ${component}: ${message}`;

    if (data) {
        try {
            logLine += ` | DATA: ${JSON.stringify(data)}`;
        } catch (e) {
            logLine += ` | DATA: [Circular/Error]`;
        }
    }

    logLine += '\n';

    try {
        fs.appendFileSync(LOG_FILE, logLine);
    } catch (e) {
        // Fallback to console if file write fails
        console.error("LOGGING ERROR:", e);
    }
}

module.exports = { logSystem };
