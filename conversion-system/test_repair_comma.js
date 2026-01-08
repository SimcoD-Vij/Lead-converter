
function repairJSON(raw) {
    console.log("Original:", raw);
    let cleaner = raw;

    // Repair: Quote unquoted keys
    cleaner = cleaner.replace(/([{,]\s*)([a-zA-Z0-9_]+)\s*:/g, '$1"$2":');

    // CURRENT BROKEN REGEX (Simulated)
    // cleaner = cleaner.replace(/:\s*([^",}\]]+?)(\s*[,}])/g, ...

    // IMPROVED REGEX to test
    // We want to capture everything until we hit a comma that looks like a delimiter (followed by newline or quote)
    // OR we hit the closing brace.
    // This is hard.

    // Let's test the current regex behavior first
    cleaner = cleaner.replace(/:\s*([^",}\]]+?)(\s*[,}])/g, (match, val, end) => {
        const v = val.trim();
        if (v === 'null' || v === 'true' || v === 'false') return match;
        if (!isNaN(v)) return match;
        if (v.startsWith('"')) return match;

        return `: "${v}"${end}`;
    });

    console.log("Repaired:", cleaner);
    try {
        const parsed = JSON.parse(cleaner);
        console.log("Parsed Success:", JSON.stringify(parsed, null, 2));
    } catch (e) {
        console.error("Parse Failed:", e.message);
    }
}

const commaJSON = ` {
  interest_level: medium,
  user_intent: asking_price,
  objections: none,
  next_action: follow_up,
  conversation_summary: The user asked for price, features, and details.
}`;

repairJSON(commaJSON);
