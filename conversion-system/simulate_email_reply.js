const fs = require('fs');
const path = require('path');

const QUEUE_FILE = path.join(__dirname, 'email', 'inbound_email_queue.json');

// Mock Data
const mockReply = {
    sender: "rsvijaypargavan@gmail.com",
    subject: "Re: Follow up from Hivericks",
    body: "That sounds interesting. What is the price exactly?",
    timestamp: new Date().toISOString(),
    status: 'PENDING'
};

// Write to Queue
try {
    let queue = [];
    if (fs.existsSync(QUEUE_FILE)) {
        queue = JSON.parse(fs.readFileSync(QUEUE_FILE, 'utf8'));
    }
    queue.push(mockReply);
    fs.writeFileSync(QUEUE_FILE, JSON.stringify(queue, null, 2));
    console.log("✅ Simulation: Injected email reply into queue.");
    console.log(JSON.stringify(mockReply, null, 2));
} catch (e) {
    console.error("❌ Simulation Failed:", e);
}
