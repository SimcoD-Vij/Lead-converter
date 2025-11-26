// MNC STANDARD: TEMPLATE MANAGER
// This file holds the scripts. It allows the sales team to change text
// without touching the complex code engine.

const templates = {
    // DAY 1: The Hook
    "EMAIL_1": {
        subject: "Question about {company}",
        body: `Hi {name},

I noticed your work at {company} and wanted to reach out.

We help companies in {location} scale their sales process.
Are you open to a quick 10-min chat this week?

Best,
The AI Intern`
    },

    // DAY 3: The Nudge (Short & Sweet)
    "EMAIL_2": {
        subject: "Re: Question about {company}",
        body: `Hi {name},

Just bubbling this up in case it got buried.
Would love to show you how we handled this for other {industry} companies.

Best,
The AI Intern`
    },

    // DAY 7: The Breakup (Polite closing)
    "EMAIL_3": {
        subject: "Last try?",
        body: `Hi {name},

I haven't heard back, so I assume you're super busy or this isn't a priority.
I'll close your file for now.

Here is a link to our deck if you ever want to check it out later.

Cheers,
The AI Intern`
    }
};

// Helper function to replace {tokens}
const fillTemplate = (templateId, lead) => {
    const template = templates[templateId];
    if (!template) return null;

    let subject = template.subject;
    let body = template.body;

    // MNC TRICK: Use a map to replace all tokens dynamically
    // If lead.company is missing, fallback to "your company"
    const replacements = {
        "{name}": lead.name.split(' ')[0], // Use First Name only
        "{company}": lead.company || "your company",
        "{location}": lead.location || "your area",
        "{industry}": "Technology" // Default for now
    };

    // Loop through replacements and swap them in text
    for (const [key, value] of Object.entries(replacements)) {
        subject = subject.replaceAll(key, value);
        body = body.replaceAll(key, value);
    }

    return { subject, body };
};

module.exports = { fillTemplate };