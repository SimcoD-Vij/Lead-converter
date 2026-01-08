// ---------------------------------------------------------
// TASK 1: LEAD IMPORTER (PARTIAL VALIDITY & SCHEMA FIX)
// ---------------------------------------------------------

// 1. IMPORTS
require('dotenv').config({ path: '../.env' });
const fs = require('fs');
const path = require('path');
const axios = require('axios');
const { parsePhoneNumber } = require('libphonenumber-js');

// 2. CONFIGURATION
const OUTPUT_DIR = path.join(__dirname, '../processed_leads');
const FILES = {
    CLEAN: path.join(OUTPUT_DIR, 'clean_leads.json'),
    BAD_DATA: path.join(OUTPUT_DIR, 'rejected_leads.json')
};

// 3. HELPER: PHONE NORMALIZATION
const normalizePhone = async (phone, countryCode = 'IN') => {
    if (!phone) return null;
    let rawPhone = phone.toString().replace(/[^0-9+]/g, '');

    // Abstract API (Optional Validation)
    const apiKey = process.env.ABSTRACT_API_KEY;
    if (apiKey && !apiKey.includes('your_key')) {
        try {
            const url = `https://phonevalidation.abstractapi.com/v1/?api_key=${apiKey}&phone=${rawPhone}`;
            const response = await axios.get(url);
            if (response.data.valid) {
                return response.data.format.international.replace(/\s/g, '');
            }
            return null;
        } catch (e) { console.log("      ⚠️ API Error. Using fallback..."); }
    }

    // Library Fallback
    try {
        const p = parsePhoneNumber(rawPhone, countryCode);
        if (p && p.isValid()) return p.number;
    } catch (e) { return null; }
    return null;
};

// 4. HELPER: EMAIL VALIDATION (Simple Syntax Check)
const validateEmail = (email) => {
    if (!email) return null;
    const cleanEmail = email.trim().toLowerCase();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(cleanEmail) ? cleanEmail : null;
};

// 5. STORAGE ENGINE
const saveToJSON = (filePath, data) => {
    if (!fs.existsSync(OUTPUT_DIR)) fs.mkdirSync(OUTPUT_DIR);
    if (!fs.existsSync(filePath)) fs.writeFileSync(filePath, JSON.stringify([], null, 2));

    let jsonList = [];
    try {
        const fileContent = fs.readFileSync(filePath, 'utf-8');
        jsonList = JSON.parse(fileContent);
    } catch (e) { jsonList = []; }

    // Smart Deduplication: Check Phone OR Email
    const exists = jsonList.find(l => {
        const phoneMatch = l.phone && data.phone && l.phone === data.phone;
        const emailMatch = l.email && data.email && l.email === data.email;
        return phoneMatch || emailMatch; // If either matches, it's a duplicate
    });

    if (!exists) {
        jsonList.push(data);
        fs.writeFileSync(filePath, JSON.stringify(jsonList, null, 2));
        console.log("   ✅ Lead Saved.");
    } else {
        console.log("      ⚠️ Duplicate skipped.");
    }
};

// 6. MAIN PROCESSOR
const processLead = async (rawLead) => {
    console.log(`\n🚀 Processing: ${rawLead.name || 'Unknown'}...`);

    // A. Validate Contacts Independently
    const validPhone = await normalizePhone(rawLead.phone, rawLead.country);
    const validEmail = validateEmail(rawLead.email);

    // B. Critical Check: Must have AT LEAST ONE valid contact method
    if (!validPhone && !validEmail) {
        console.log("   ❌ Rejected: No valid Phone OR Email.");
        // Optional: Save to bad data file
        return;
    }

    // C. Construct Clean Object (Null handling)
    const cleanLead = {
        // 1. Identity
        name: rawLead.name ? rawLead.name.trim() : "Unknown",
        phone: validPhone, // Can be null
        email: validEmail, // Can be null

        // 2. State
        attempt_count: 0,
        next_action_due: new Date().toISOString().split('T')[0],

        // 3. Scoring
        score: 0,
        category: "COLD",

        // 4. Source & Metadata
        source: "SYSTEM",
        status: "PENDING",
        imported_at: new Date().toISOString()
    };

    // D. Save
    saveToJSON(FILES.CLEAN, cleanLead);
};

// 7. TEST RUNNER
(async () => {
    const testLeads = [
        { name: "Vijay R", phone: "7604896187", email: "vijay@example.com", country: "IN" }, // Both Valid
        { name: "Only Email", phone: "000", email: "only@test.com", country: "IN" },         // Phone Invalid, Email Valid
        { name: "Only Phone", phone: "9876543210", email: "bad-email", country: "IN" },      // Phone Valid, Email Invalid
        { name: "Ghost User", phone: "000", email: "bad-email", country: "IN" }              // Both Invalid (Should Reject)
    ];

    // Reset for testing
    if (fs.existsSync(FILES.CLEAN)) fs.unlinkSync(FILES.CLEAN);

    for (const lead of testLeads) {
        await processLead(lead);
    }
    console.log("\n🏁 Import Complete.");
})();