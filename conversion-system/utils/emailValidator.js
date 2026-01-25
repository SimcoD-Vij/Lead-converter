function validateEmailContent(emailText) {
    if (!emailText || typeof emailText !== "string") {
        return { valid: false, reason: "Empty or non-string email" };
    }

    // Common hallucinations and meta-commentary to block
    const forbiddenPhrases = [
        "google docs",
        "template",
        "system",
        "generated email",
        "replace function",
        "platform doesn't support",
        "draft email start",
        "here is the email",
        "here is a generated",
        "start_email_generation"
    ];

    for (const phrase of forbiddenPhrases) {
        if (emailText.toLowerCase().includes(phrase)) {
            return { valid: false, reason: `Forbidden phrase found: "${phrase}"` };
        }
    }

    // Structural Requirements
    if (!emailText.match(/^Subject:/i)) {
        return { valid: false, reason: "Missing 'Subject:' line at start" };
    }

    if (!emailText.includes("Dear") && !emailText.includes("Hi ") && !emailText.includes("Hello ")) {
        return { valid: false, reason: "Missing professional salutation" };
    }

    if (emailText.length < 10) { // Extremely relaxed, relying on Structure checks (Subject/Salutation) instead
        return { valid: false, reason: "Email content is virtually empty" };
    }

    return { valid: true };
}

module.exports = { validateEmailContent };
