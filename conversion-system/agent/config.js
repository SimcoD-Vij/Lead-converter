module.exports = {
    OLLAMA_URL: process.env.OLLAMA_URL || 'http://127.0.0.1:11434/api/chat',
    MODEL: 'llama3.2:1b', // Ensure this matches your working model
    MEMORY_FILE: require('path').join(__dirname, 'data/memory.json'),
    MAX_PROMPT_TOKENS: 3500 
  };