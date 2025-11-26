// ---------------------------------------------------------
// TASK 1: LEAD IMPORTER (FINAL MERGED VERSION)
// ---------------------------------------------------------

// 1. IMPORTS
require('dotenv').config({ path: '../.env' }); 
const fs = require('fs');       // To write files
const path = require('path');   // To handle folder paths
const axios = require('axios');
const { parsePhoneNumber } = require('libphonenumber-js');

// 2. FILE SYSTEM CONFIGURATION
// This sets up the folder: processed_leads
const OUTPUT_DIR = path.join(__dirname, '../processed_leads');

const FILES = {
    CLEAN: path.join(OUTPUT_DIR, 'clean_leads.json'),
    BAD_EMAIL: path.join(OUTPUT_DIR, 'invalid_emails.json'),
    BAD_PHONE: path.join(OUTPUT_DIR, 'invalid_numbers.json')
};

// 3. HELPER: STORAGE ENGINE
const saveToJSON = (filePath, data) => {
    // A. Create folder if it doesn't exist
    if (!fs.existsSync(OUTPUT_DIR)) {
        fs.mkdirSync(OUTPUT_DIR);
    }
    
    // B. Create file if it doesn't exist (start with empty list [])
    if (!fs.existsSync(filePath)) {
        fs.writeFileSync(filePath, JSON.stringify([], null, 2));
    }

    // C. Read, Push, Write
    const fileContent = fs.readFileSync(filePath, 'utf-8');
    const jsonList = JSON.parse(fileContent);
    
    jsonList.push(data); // Add the new lead
    
    fs.writeFileSync(filePath, JSON.stringify(jsonList, null, 2));
};

// 4. HELPER: CLEANING TOOLS
const toTitleCase = (str) => {
    if (!str) return "Unknown";
    return str
        .trim()                // Remove side spaces
        .toLowerCase()
        .split(/\s+/)          // Split by ANY whitespace (fixes double spaces)
        .map(w => w.charAt(0).toUpperCase() + w.slice(1))
        .join(' ');
};

// 5. HELPER: PHONE NORMALIZATION (Abstract API + Library Fallback)
const normalizePhone = async (phone, countryCode) => {
    // 1. Clean the input first (Remove spaces, dashes, keep only numbers and +)
    let rawPhone = phone.toString().replace(/[^0-9+]/g, '');

    const apiKey = process.env.ABSTRACT_API_KEY;
    
    // 2. Try Abstract API (If Key Exists)
    if (apiKey && !apiKey.includes('your_key')) {
        try {
            console.log(`   🔎 Validating ${rawPhone} with Abstract API...`);
            
            const url = `https://phonevalidation.abstractapi.com/v1/?api_key=${apiKey}&phone=${rawPhone}`;
            const response = await axios.get(url);
            const data = response.data;

            // CHECK: Did the API say it's valid?
            if (data.valid === true) {
                // MNC STANDARD: Returns string "+919876543210"
                const cleanNumber = data.format.international.replace(/\s/g, '');
                console.log(`      ✅ API Verified: ${cleanNumber}`);
                return cleanNumber; 
            } else {
                console.log("      ❌ API said Invalid Number");
                return null; 
            }

        } catch (error) {
            console.log("      ⚠️ API Error. Falling back to library...");
        }
    }

    // 3. Fallback: Offline Library (libphonenumber-js)
    try {
        const p = parsePhoneNumber(rawPhone, countryCode);
        if (p && p.isValid()) {
            return p.number; // Returns string "+91..."
        }
    } catch (e) { 
        return null; 
    }
    return null;
};

// 6. HELPER: EMAIL VALIDATION ENGINE
const validateEmail = async (email) => {
    // 1. Basic Syntax Check
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
        console.log(`   ❌ Logic: Email syntax is wrong`);
        return false;
    }

    // 2. API Check
    const apiKey = process.env.KICKBOX_API_KEY;
    
    // Safety Check: Fail Open if key is missing
    if (!apiKey || apiKey.includes('your_actual')) {
        console.log("   ⚠️ Warning: No valid API Key found. Skipping verification.");
        return true; 
    }

    try {
        console.log(`   🔎 Checking ${email} with Kickbox...`);
        const url = `https://api.kickbox.com/v2/verify?email=${email}&apikey=${apiKey}`;
        const response = await axios.get(url);
        const result = response.data.result;

        if (result === 'deliverable' || result === 'risky') {
            console.log(`      ✅ API: Email is valid (Status: ${result})`);
            return true;
        } else {
            console.log(`      ❌ API: Email rejected (Status: ${result})`);
            return false;
        }

    } catch (error) {
        console.log("      ⚠️ API Error (Allowing lead anyway):", error.message);
        return true; 
    }
};

// 7. MAIN PROCESSOR
const processLead = async (rawLead) => {
    console.log(`\n🚀 Processing: ${rawLead.name}...`);

    // --- CRITICAL FIX: AWAIT THE PHONE NUMBER HERE ---
    // If we don't await, it returns a Promise object {}, causing the bug you saw.
    const validPhone = await normalizePhone(rawLead.phone, rawLead.country);

    // Step A: Create the Clean Object
    const cleanLead = {
        name: toTitleCase(rawLead.name),
        company: toTitleCase(rawLead.company || "Unknown"),
        email: rawLead.email.trim().toLowerCase(),
        phone: validPhone, // Now this is a real string, not a Promise
        status: "PENDING",
        timestamp: new Date().toISOString()
    };

    // Step B: Validate Phone
    if (!cleanLead.phone) {
        console.log("   ❌ Failed: Invalid Phone Number");
        cleanLead.status = "INVALID_PHONE";
        saveToJSON(FILES.BAD_PHONE, cleanLead);
        return;
    }

    // Step C: Validate Email
    const isEmailValid = await validateEmail(cleanLead.email);
    if (!isEmailValid) {
        console.log("   ❌ Failed: Invalid Email");
        cleanLead.status = "INVALID_EMAIL";
        saveToJSON(FILES.BAD_EMAIL, cleanLead);
        return;
    }

    // Step D: Success
    console.log("   ✅ Success! Lead Saved to clean_leads.json");
    cleanLead.status = "VERIFIED";
    saveToJSON(FILES.CLEAN, cleanLead);
};

// 8. TEST DATA
const testLeads = [
    { 
        name: "Vijaypargavan R S", 
        phone: "7604896187", 
        email: "rsvijaypargavan@gmail.com", 
        country: "IN", 
        company: "zedbee" 
    },
    { 
        name: "Fake User", 
        phone: "000", 
        email: "fake@gmail.com", 
        country: "IN" 
    }
];

// Run the batch
(async () => {
    // Clear old clean file to prevent duplicates during testing (Optional)
    if (fs.existsSync(FILES.CLEAN)) fs.unlinkSync(FILES.CLEAN);

    for (const lead of testLeads) {
        await processLead(lead);
    }
    console.log("\n🏁 Batch Processing Complete.");
})();