
function repairJSON(raw) {
    console.log("Original:", raw);
    let cleaner = raw;

    // 1. Quote keys first
    // Matches word char(s) followed by colon, at start of line or after { or ,
    cleaner = cleaner.replace(/([{,]\s*)([a-zA-Z0-9_]+)\s*:/g, '$1"$2":');
    console.log("Keys Quoted:", cleaner);

    // 2. Quote Values
    // Match colon, optional space
    // Capture GROUP 1: Any character (greedy or non-greedy?)
    // UNTIL positive lookahead for:
    //   a) comma, whitespace, quote (start of next key)
    //   b) closing brace (end of object)

    // We use [\s\S] to match newlines too if needed, though usually on one line.
    // strict mode: only quote if not already quoted?
    cleaner = cleaner.replace(/:\s*("?)([\s\S]+?)("?)(\s*(?=,\s*"|\s*}))/g, (match, q1, val, q2, end) => {
        // If it was already quoted (q1 and q2 exist), don't double quote
        if (q1 && q2) return match;

        let v = val.trim();
        if (v === 'null' || v === 'true' || v === 'false') return match;
        if (!isNaN(v)) return match; // primitive number

        // If it looks like a string but missing quotes
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
