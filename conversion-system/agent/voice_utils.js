// agent/voice_utils.js

// 1. FILLERS: Randomly add human sounds at the start of sentences
const fillers = ["Um, ", "You know, ", "Actually, ", "So, ", "Well, "];

function addFillers(text) {
    // Only add fillers 30% of the time to avoid sounding annoying
    if (Math.random() > 0.7) { 
        const randomFiller = fillers[Math.floor(Math.random() * fillers.length)];
        return randomFiller + text.charAt(0).toLowerCase() + text.slice(1);
    }
    return text;
}

// 2. SSML WRAPPER: Tells the voice engine (Polly) how to breathe
function textToSSML(text) {
    // Clean text
    let cleanText = text.replace(/[*#]/g, ''); // Remove markdown characters
    
    // Add fillers
    let humanText = addFillers(cleanText);

    // Apply SSML tags
    // <break time="300ms"/> simulates thinking
    // <prosody> adjusts speed (humans speak slightly faster than default TTS)
    return `
    <speak>
        <break time="200ms"/> 
        <prosody rate="105%">
            ${humanText}
        </prosody>
    </speak>
    `;
}

module.exports = { textToSSML };