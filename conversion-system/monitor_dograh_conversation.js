#!/usr/bin/env node
/**
 * Dograh Conversation Monitor
 * Streams Dograh API logs to show real-time conversation flow
 */

const { spawn } = require('child_process');
const path = require('path');

console.log('🎧 Dograh Conversation Monitor');
console.log('================================\n');
console.log('Streaming Dograh API logs...');
console.log('Press Ctrl+C to stop\n');

// Path to dograh directory
const dograhPath = path.join(__dirname, '../dograh');

// Stream docker logs with filtering
const logProcess = spawn('docker', [
    'compose',
    'logs',
    '-f',
    '--tail=50',
    'api'
], {
    cwd: dograhPath,
    stdio: ['ignore', 'pipe', 'pipe'],
    shell: true
});

// Filter and format logs
logProcess.stdout.on('data', (data) => {
    const lines = data.toString().split('\n');

    lines.forEach(line => {
        // Filter for conversation-related logs
        if (
            line.includes('LLM') ||
            line.includes('TTS') ||
            line.includes('STT') ||
            line.includes('User said') ||
            line.includes('Bot said') ||
            line.includes('transcript') ||
            line.includes('Streaming') ||
            line.includes('workflow run') ||
            line.includes('call') ||
            line.includes('conversation')
        ) {
            // Clean up and format
            let cleanLine = line
                .replace(/^api-1\s+\|\s+/, '')
                .replace(/\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}:\d{2}\.\d{3}\s+\|\s+/, '')
                .trim();

            if (cleanLine) {
                // Add emoji based on content
                if (cleanLine.includes('User said') || cleanLine.includes('STT')) {
                    console.log(`👤 ${cleanLine}`);
                } else if (cleanLine.includes('Bot said') || cleanLine.includes('TTS')) {
                    console.log(`🤖 ${cleanLine}`);
                } else if (cleanLine.includes('LLM')) {
                    console.log(`🧠 ${cleanLine}`);
                } else if (cleanLine.includes('call')) {
                    console.log(`📞 ${cleanLine}`);
                } else {
                    console.log(`   ${cleanLine}`);
                }
            }
        }
    });
});

logProcess.stderr.on('data', (data) => {
    const error = data.toString().trim();
    if (error && !error.includes('Attaching to')) {
        console.error(`❌ ${error}`);
    }
});

logProcess.on('close', (code) => {
    console.log(`\n\n🛑 Monitor stopped (exit code: ${code})`);
    process.exit(code);
});

// Handle Ctrl+C
process.on('SIGINT', () => {
    console.log('\n\n👋 Stopping monitor...');
    logProcess.kill();
    process.exit(0);
});
