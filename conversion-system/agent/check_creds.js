require('dotenv').config();

console.log("--- CREDENTIAL CHECK ---");
const sid = process.env.TWILIO_SID;
const auth = process.env.TWILIO_AUTH;
const context7 = process.env.CONTEXT7_API_KEY;

console.log("TWILIO_SID:", sid ? sid.substring(0, 5) + "..." : "UNDEFINED");
console.log("TWILIO_AUTH:", auth ? auth.substring(0, 5) + "..." : "UNDEFINED");
console.log("CONTEXT7_API:", context7 ? context7.substring(0, 5) + "..." : "UNDEFINED");

if (!sid || !auth) {
    console.error("❌ CRITICAL: Twilio Credentials Missing.");
} else {
    console.log("✅ Credentials Loaded (Validity unchecked by this script).");
}
