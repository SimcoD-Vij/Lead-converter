module.exports = {
  OLLAMA_URL: process.env.OLLAMA_URL || 'http://127.0.0.1:11434/api/chat',
  MODEL: 'llama3.2:3b', // Default working model
  MEMORY_FILE: require('path').join(__dirname, 'data/memory.json'),
  MAX_PROMPT_TOKENS: 3500,
  CRM_BASE_URL: (process.env.CRM_PUBLIC_URL ? process.env.CRM_PUBLIC_URL.replace(/\/$/, '') + '/api' : 'https://e32376a97ce7.ngrok-free.app/api')
};