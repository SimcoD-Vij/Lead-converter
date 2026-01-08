const express = require('express');
const bodyParser = require('body-parser');
const { v4: uuidv4 } = require('uuid');
const { generateResponse } = require('./salesBot');
const { getMemory, upsertMemory } = require('./memory');
const { sanitize } = require('./utils');

const app = express();
app.use(bodyParser.json());

const PORT = 6000; // Distinct port for the Agent

app.post('/api/salesbot', async (req, res) => {
  try {
    // LeadId can be a phone number or email
    const { leadId: incomingLeadId, message, mode } = req.body;
    
    if (!message) return res.status(400).send({ error: 'message required' });

    const messageText = sanitize(message);
    const leadId = incomingLeadId || uuidv4();

    console.log(`\n🤖 Agent received msg from ${leadId}: "${messageText}"`);

    // 1. Load Memory
    const memory = await getMemory(leadId) || {};

    // 2. Generate Reply
    const reply = await generateResponse({ userMessage: messageText, memory, mode: mode || 'CONSULTATIVE' });

    console.log(`   💡 Agent Reply: "${reply}"`);

    // 3. Update Memory (Extract intents)
    const lower = messageText.toLowerCase();
    const patch = {};
    if (/no budget|not interested|stop/.test(lower)) {
      patch.status = 'OBJECTION';
    }
    if (/price|cost|how much/.test(lower)) {
      patch.pricing_inquiry = true;
    }
    patch.last_user_message = messageText;

    const newMemory = await upsertMemory(leadId, patch);

    return res.send({ leadId, reply, memory: newMemory });

  } catch (err) {
    console.error(err);
    res.status(500).send({ error: 'server error' });
  }
});

app.listen(PORT, () => console.log(`🚀 XOptimus Sales Agent running on Port ${PORT}`));