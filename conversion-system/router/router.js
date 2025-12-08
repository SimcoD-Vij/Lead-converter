// ---------------------------------------------------------
// TASK 6: SALES ROUTING SYSTEM (SMART PRIORITY)
// ---------------------------------------------------------
const fs = require('fs');
const path = require('path');

// CONFIG
const LEADS_FILE = path.resolve(__dirname, '../processed_leads/clean_leads.json');

// MOCK SALES TEAM
const SALES_AGENTS = ["Tony", "Sai", "CR7"];

// HELPER: Generate Message
const generateSummary = (lead, owner, priority) => {
    return `
    =========================================
    ${priority} LEAD NOTIFICATION
    =========================================
    👤 Lead:   ${lead.name}
    🏢 Comp:   ${lead.company}
    📞 Phone:  ${lead.phone}
    -----------------------------------------
    🏆 Score:  ${lead.score} (${lead.category})
    💬 Action: ${lead.last_response_digit ? "Pressed " + lead.last_response_digit : "Passive"}
    📊 Status: ${lead.status}
    -----------------------------------------
    👉 ASSIGNED TO: @${owner}
    =========================================
    `;
};

const runRouting = () => {
    console.log("🚀 Starting Smart Sales Routing...");

    if (!fs.existsSync(LEADS_FILE)) return console.log("❌ File missing.");

    const leads = JSON.parse(fs.readFileSync(LEADS_FILE, 'utf-8'));

    // 1. FILTER: Warm/Hot leads NOT yet routed
    let qualifiedLeads = leads.filter(l => {
        const isQualified = l.score >= 20; 
        const notRouted = l.status !== "ROUTED_TO_SALES";
        return isQualified && notRouted;
    });

    // 2. ACCURACY UPGRADE: SORTING
    // Process the HOTTEST leads first (Score High -> Low)
    qualifiedLeads.sort((a, b) => b.score - a.score);

    console.log(`📋 Found ${qualifiedLeads.length} qualified leads pending routing.\n`);

    if (qualifiedLeads.length === 0) return;

    // 3. ROUTING LOOP
    qualifiedLeads.forEach((lead, index) => {
        
        // A. Assign Owner
        const owner = SALES_AGENTS[index % SALES_AGENTS.length];

        // B. Determine Urgency (Accuracy Upgrade)
        let priority = "🔔 STANDARD";
        if (lead.score >= 50 || lead.status === "INTERESTED" || lead.last_reply) {
            priority = "🚨 URGENT"; // Voice/Text replies are URGENT
        }

        // C. Generate Alert
        const alertMessage = generateSummary(lead, owner, priority);

        // D. Send Notification
        console.log(alertMessage);

        // E. Update Database
        lead.owner = owner;
        lead.status = "ROUTED_TO_SALES";
        lead.routed_at = new Date().toISOString();
    });

    // 4. SAVE CHANGES
    fs.writeFileSync(LEADS_FILE, JSON.stringify(leads, null, 2));
    console.log("\n💾 Database updated. High priority leads assigned first.");
};

runRouting();