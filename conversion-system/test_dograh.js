/**
 * Test Dograh Integration
 * Verifies Dograh API is working and can handle calls
 */

const DograhClient = require('./voice/dograh_client');
require('dotenv').config();

async function testDograhIntegration() {
    console.log('='.repeat(60));
    console.log('DOGRAH INTEGRATION TEST');
    console.log('='.repeat(60));
    console.log('');

    const dograh = new DograhClient(
        process.env.DOGRAH_API_URL || 'http://localhost:8000',
        process.env.DOGRAH_API_KEY
    );

    let allPassed = true;

    // Test 1: Health Check
    console.log('Test 1: Health Check');
    try {
        const health = await dograh.healthCheck();
        console.log('✓ Dograh API is healthy');
        console.log('  Status:', health.status);
        console.log('');
    } catch (error) {
        console.error('✗ Health check failed:', error.message);
        console.error('  Make sure Dograh is running: docker compose -f docker-compose.dograh.yml up -d');
        allPassed = false;
        return;
    }

    // Test 2: List Workflows
    console.log('Test 2: List Workflows');
    try {
        const workflows = await dograh.listWorkflows();
        console.log(`✓ Found ${workflows.length} workflow(s)`);

        if (workflows.length > 0) {
            workflows.forEach(w => {
                console.log(`  - ${w.name} (ID: ${w.id})`);
            });
        } else {
            console.log('  ⚠ No workflows found. Create one in Dograh UI: http://localhost:3010');
        }
        console.log('');
    } catch (error) {
        console.error('✗ Failed to list workflows:', error.message);
        allPassed = false;
    }

    // Test 3: Get Specific Workflow
    const workflowId = process.env.DOGRAH_WORKFLOW_ID || 1;
    console.log(`Test 3: Get Workflow ${workflowId}`);
    try {
        const workflow = await dograh.getWorkflow(workflowId);
        console.log('✓ Workflow found:', workflow.name);
        console.log('  Type:', workflow.type);
        console.log('  Nodes:', workflow.nodes?.length || 0);
        console.log('');
    } catch (error) {
        console.error(`✗ Failed to get workflow ${workflowId}:`, error.message);
        console.error('  Create a workflow in Dograh UI and update DOGRAH_WORKFLOW_ID in .env');
        allPassed = false;
    }

    // Test 4: Initiate Test Call (optional - requires phone number)
    if (process.env.TEST_PHONE_NUMBER) {
        console.log('Test 4: Initiate Test Call');
        try {
            const call = await dograh.initiateCall(
                workflowId,
                process.env.TEST_PHONE_NUMBER,
                {
                    name: 'Test User',
                    attempt_count: 2,
                    source: 'integration_test'
                }
            );

            console.log('✓ Call initiated successfully');
            console.log('  Call ID:', call.call_id);
            console.log('  Status:', call.status);
            console.log('');

            // Wait for call completion (with timeout)
            console.log('  Waiting for call to complete...');
            const result = await dograh.waitForCallCompletion(call.call_id, 120000); // 2 min max

            console.log('✓ Call completed');
            console.log('  Final status:', result.status);
            console.log('  Duration:', result.duration, 'seconds');

            if (result.variables) {
                console.log('  Extracted variables:');
                Object.entries(result.variables).forEach(([key, value]) => {
                    console.log(`    - ${key}: ${value}`);
                });
            }
            console.log('');
        } catch (error) {
            console.error('✗ Call test failed:', error.message);
            allPassed = false;
        }
    } else {
        console.log('Test 4: Skipped (set TEST_PHONE_NUMBER to test actual calls)');
        console.log('');
    }

    // Summary
    console.log('='.repeat(60));
    if (allPassed) {
        console.log('✓ ALL TESTS PASSED');
        console.log('');
        console.log('Next steps:');
        console.log('1. Create a workflow in Dograh UI: http://localhost:3010');
        console.log('2. Update DOGRAH_WORKFLOW_ID in .env');
        console.log('3. Set USE_DOGRAH_AI=true in .env');
        console.log('4. Test with orchestrator');
    } else {
        console.log('✗ SOME TESTS FAILED');
        console.log('');
        console.log('Troubleshooting:');
        console.log('1. Ensure Dograh is running: docker compose -f docker-compose.dograh.yml ps');
        console.log('2. Check logs: docker compose -f docker-compose.dograh.yml logs api');
        console.log('3. Verify .env has correct DOGRAH_API_URL');
    }
    console.log('='.repeat(60));
}

// Run tests
testDograhIntegration().catch(error => {
    console.error('Test suite error:', error);
    process.exit(1);
});
