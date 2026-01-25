const { generateFeedbackRequest } = require('./salesBot');
const { validateEmailContent } = require('../utils/emailValidator');

const PRODUCT_KNOWLEDGE = `(Injected by system)`; // salesBot has this internally

(async () => {
    console.log("🚀 STARTING CONTEXT BRANCHING VERIFICATION");

    // SCENARIO 1: COLD LEAD (No history, Low Attempt)
    // Orchestrator Logic Simulation for Cold Lead
    const leadCold = { name: "Alice New", attempt_count: 0 };
    let summaryCold = ""; // Simulating Orchestrator default for new leads

    console.log("\n🥶 SCENARIO 1: COLD LEAD (Alice)");
    console.log(`   Context: "${summaryCold}"`);
    console.log("   Generating...");

    const emailCold = await generateFeedbackRequest(summaryCold, 'EMAIL', leadCold.name, leadCold.attempt_count);
    console.log(`\n   📄 OUTPUT:\n${emailCold}\n`);

    // SCENARIO 2: WARM LEAD (High history, Objection)
    // Orchestrator Logic Simulation for Warm Lead
    const leadWarm = { name: "Bob Returning", attempt_count: 3 };
    const summaryWarm = "User asked about bulk pricing for 50 units but was concerned about shipping time.";

    console.log("\n🔥 SCENARIO 2: WARM LEAD (Bob)");
    console.log(`   Context: "${summaryWarm}"`);
    console.log("   Generating...");

    const emailWarm = await generateFeedbackRequest(summaryWarm, 'EMAIL', leadWarm.name, leadWarm.attempt_count);
    console.log(`\n   📄 OUTPUT:\n${emailWarm}\n`);

    // SCENARIO 3: VALIDATION CHECK
    const valCold = validateEmailContent(emailCold.trim());
    const valWarm = validateEmailContent(emailWarm.trim());

    // Write results to file for reliable reading
    const fs = require('fs');
    const output = `
-----------------------------------------
🥶 SCENARIO 1: COLD LEAD (Alice)
${emailCold}
-----------------------------------------
🔥 SCENARIO 2: WARM LEAD (Bob)
${emailWarm}
-----------------------------------------
Validation Cold: ${valCold.valid}
Validation Warm: ${valWarm.valid}
    `;
    fs.writeFileSync('verification_output.txt', output);
    console.log("✅ Results written to verification_output.txt");

})();
