const { spawn } = require('child_process');
const path = require('path');

// Colors for console logging
const COLORS = {
    server: '\x1b[36m', // Cyan
    orchestrator: '\x1b[32m', // Green
    reset: '\x1b[0m'
};

const startService = (name, script, color) => {
    console.log(`${color}[${name}] Starting...${COLORS.reset}`);
    const proc = spawn('node', [script], {
        cwd: __dirname,
        stdio: 'pipe',
        shell: true
    });

    proc.stdout.on('data', (data) => {
        process.stdout.write(`${color}[${name}] ${data.toString()}${COLORS.reset}`);
    });

    proc.stderr.on('data', (data) => {
        process.stderr.write(`${color}[${name} ERR] ${data.toString()}${COLORS.reset}`);
    });

    proc.on('close', (code) => {
        console.log(`${color}[${name}] Exited with code ${code}${COLORS.reset}`);
    });
};

console.log("🚀 STARTING UNIFIED SYSTEM...");

// 1. Start Call Server (Backend) - Port 3000
// DISABLED: Orchestrator now manages its own voice server instance
// startService('SERVER', 'voice/call_server.js', COLORS.server);

// 2. Wait for Server to Initialize, then Start Orchestrator
setTimeout(() => {
    startService('ORCHESTRATOR', 'router/orchestrator.js', COLORS.orchestrator);
}, 2000);
