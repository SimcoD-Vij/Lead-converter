const axios = require('axios');
const path = require('path');
const fs = require('fs');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const CRM_BASE_URL = (process.env.CRM_PUBLIC_URL ? process.env.CRM_PUBLIC_URL.replace(/\/$/, '') + '/api' : 'https://e32376a97ce7.ngrok-free.app/api');

const mapLeadStatus = (status) => {
    if (!status) return 'New';
    const mappings = {
        'CALL_IDLE': 'New',
        'CALL_CONNECTED': 'In Process',
        'CALL_INTERESTED': 'In Process',
        'CALL_NOT_INTERESTED': 'Recycled',
        'CALL_COMPLETED': 'In Process',
        'SMS_IDLE': 'New',
        'SMS_SENT': 'In Process',
        'NEW_INBOUND': 'New'
    };
    return mappings[status] || 'Assigned';
};

async function syncLead(lead) {
    if (!CRM_BASE_URL) return null;
    const authHeader = { Authorization: 'Basic ' + Buffer.from('admin:admin').toString('base64') };

    // 1. If we have a lead_id, verify it exists
    if (lead.lead_id) {
        try {
            await axios.get(`${CRM_BASE_URL}/v1/Lead/${lead.lead_id}`, { headers: authHeader });
            return lead.lead_id;
        } catch (e) {
            if (e.response && e.response.status !== 404) throw e;
            // If 404, we need to find it by phone/email
        }
    }

    // 2. Search by Phone or Email
    try {
        const searchParams = {
            select: 'id',
            limit: 1
        };
        if (lead.phone) {
            const rawPhone = lead.phone.replace('+', '');
            searchParams['where[0][type]'] = 'in';
            searchParams['where[0][attribute]'] = 'phoneNumber';
            searchParams['where[0][value]'] = [lead.phone, rawPhone];
        } else if (lead.email) {
            searchParams['where[0][type]'] = 'equals';
            searchParams['where[0][attribute]'] = 'emailAddress';
            searchParams['where[0][value]'] = lead.email;
        }

        const res = await axios.get(`${CRM_BASE_URL}/v1/Lead`, { params: searchParams, headers: authHeader, timeout: 5000 });
        if (res.data.list && res.data.list.length > 0) {
            const newId = res.data.list[0].id;
            console.log(`   🔄 CRM Sync: Found lead ${lead.name || lead.phone} with new ID: ${newId}`);
            lead.lead_id = newId;
            return newId;
        }
    } catch (e) {
        console.warn(`   ⚠️ CRM Sync Search Failed: ${e.message}`);
    }

    // 3. Create if not found
    try {
        const createPayload = {
            lastName: lead.name || lead.phone || 'Unknown Lead',
            phoneNumber: lead.phone,
            source: 'Other'
        };
        // Optional fields
        if (lead.email) createPayload.emailAddress = lead.email;
        if (lead.name && lead.name.includes(' ')) {
            createPayload.firstName = lead.name.split(' ')[0];
            createPayload.lastName = lead.name.split(' ').slice(1).join(' ');
        }
        const res = await axios.post(`${CRM_BASE_URL}/v1/Lead`, createPayload, { headers: authHeader });
        const newId = res.data.id;
        console.log(`   📥 CRM Sync: Created new lead ${lead.name || lead.phone} on server. ID: ${newId}`);
        lead.lead_id = newId;
        return newId;
    } catch (e) {
        let details = '';
        if (e.response && e.response.data) {
            details = JSON.stringify(e.response.data);
        }
        console.error(`   ❌ CRM Sync Create Failed: ${e.message} ${details}`);
        return null;
    }
}

async function pushUnifiedEvent(lead, eventType, data) {
    if (!CRM_BASE_URL) return;

    // Ensure lead is synced with server CRM before pushing
    const serverId = await syncLead(lead);
    if (!serverId) {
        console.warn(`   ⚠️ CRM Push Skipped: Could not sync lead ${lead.name} with server.`);
        return;
    }

    // Update payload with correct server ID for associations
    if (data.parentId) data.parentId = serverId;
    if (data.leadId) data.leadId = serverId;

    // CONFIGURATION MAP
    const ENTITY_CONFIG = {
        'LEAD_UPDATE': { endpoint: `/v1/Lead/${serverId}`, method: 'PUT', entity: 'Lead' },
        TASK_LOG: { endpoint: '/v1/Task', method: 'POST', entity: 'Task' },
        OPPORTUNITY: { endpoint: '/v1/Opportunity', method: 'POST', entity: 'Opportunity' },
        CASE: { endpoint: '/v1/Case', method: 'POST', entity: 'Case' },
        MEETING: { endpoint: '/v1/Meeting', method: 'POST', entity: 'Meeting' },
        NOTE: { endpoint: '/v1/Note', method: 'POST', entity: 'Note' }
    };

    const config = ENTITY_CONFIG[eventType];
    if (!config) {
        console.error(`   ❌ CRM Error: Unsupported event type: ${eventType}`);
        return;
    }

    // Sanitize URL: Remove any double slashes or trailing slashes that might cause 403 directory listing errors
    let endpoint = config.endpoint.replace(/\/$/, ''); // Remove trailing slash
    const url = `${CRM_BASE_URL}${endpoint}`;
    const method = config.method;
    const authHeader = { Authorization: 'Basic ' + Buffer.from('admin:admin').toString('base64') };

    try {
        // SANITIZE PAYLOAD
        if (data.status && config.entity === 'Lead') {
            data.status = mapLeadStatus(data.status);
        }
        if (data.status && config.entity === 'Task' && data.status === 'Held') {
            data.status = 'Completed'; // tasks use different enums
        }
        if (data.description && typeof data.description === 'string') {
            try {
                const parsed = JSON.parse(data.description);
                if (parsed.text_summary) data.description = parsed.text_summary;
            } catch (e) { /* keep original if not JSON */ }
        }

        await axios({
            method,
            url,
            data,
            headers: {
                ...authHeader,
                'Content-Type': 'application/json',
                'X-Event-Type': eventType
            }
        });
        // console.log(`   ✅ CRM Push Success: ${eventType} for ${lead.phone || lead.email}`);
    } catch (error) {
        let details = '';
        if (error.response && error.response.data) {
            details = JSON.stringify(error.response.data);
        }
        console.error(`   ❌ CRM Push Failed [${eventType}]: ${error.message} ${details}`);
    }
}

async function pushLeadUpdate(lead, data) {
    await pushUnifiedEvent(lead, 'LEAD_UPDATE', data);
}

const getAdminUserId = async () => {
    try {
        const authHeader = { Authorization: 'Basic ' + Buffer.from('admin:admin').toString('base64') };
        const res = await axios.get(`${CRM_BASE_URL}/v1/User`, {
            headers: authHeader,
            params: {
                select: 'id',
                where: [{ type: 'equals', attribute: 'userName', value: 'admin' }]
            }
        });
        return res.data.list?.[0]?.id || null;
    } catch (e) { return null; }
};

async function pushCallLog(lead, data) {
    const adminId = await getAdminUserId();
    const payload = {
        name: `Call with ${lead.name || lead.phone}`,
        parentType: 'Lead',
        parentId: lead.lead_id || lead.id,
        status: 'Held',
        direction: 'Outbound',
        dateStart: new Date().toISOString().replace('T', ' ').substring(0, 19),
        duration: data.duration || 60,
        description: data.summary || 'No summary provided.',
        assignedUserId: adminId // REQUIRED FIELD
    };
    await pushUnifiedEvent(lead, 'TASK_LOG', payload);
}

async function pushOpportunity(lead) {
    const payload = {
        name: `Opportunity for ${lead.name || lead.phone}`,
        leadId: lead.lead_id || lead.id,
        stage: 'Prospecting',
        amount: 1499,
        probability: 50
    };
    await pushUnifiedEvent(lead, 'OPPORTUNITY', payload);
}

async function pushCase(lead, description) {
    const payload = {
        name: `Support Case: ${lead.name || lead.phone}`,
        parentId: lead.lead_id || lead.id,
        parentType: 'Lead',
        description: description || 'User requested assistance.'
    };
    await pushUnifiedEvent(lead, 'CASE', payload);
}

async function pushMeeting(lead, dateStart) {
    const payload = {
        name: `Meeting with ${lead.name || lead.phone}`,
        parentId: lead.lead_id || lead.id,
        parentType: 'Lead',
        dateStart: dateStart || new Date().toISOString(),
        duration: 1800
    };
    await pushUnifiedEvent(lead, 'MEETING', payload);
}

async function pullNewLeads() {
    if (!CRM_BASE_URL) return 0;
    try {
        const authHeader = { Authorization: 'Basic ' + Buffer.from('admin:admin').toString('base64') };
        const res = await axios.get(`${CRM_BASE_URL}/v1/Lead`, {
            headers: authHeader,
            params: {
                where: [{ type: 'equals', attribute: 'status', value: 'New' }],
                select: 'id,firstName,lastName,phoneNumber,emailAddress,description'
            }
        });

        const crmLeads = res.data.list || [];
        if (crmLeads.length === 0) return 0;

        const LEADS_FILE = path.join(__dirname, '../processed_leads/clean_leads.json');
        let localLeads = [];
        try {
            if (fs.existsSync(LEADS_FILE)) {
                const content = fs.readFileSync(LEADS_FILE, 'utf8').trim();
                localLeads = content ? JSON.parse(content) : [];
            }
        } catch (parseErr) {
            console.warn(`   ⚠️ CRM: Failed to parse ${LEADS_FILE}, starting fresh.`);
            localLeads = [];
        }

        let added = 0;
        crmLeads.forEach(cl => {
            const phone = cl.phoneNumber;
            if (phone && !localLeads.find(l => l.phone === phone)) {
                localLeads.push({
                    lead_id: cl.id,
                    name: `${cl.firstName} ${cl.lastName}`.trim(),
                    phone: phone,
                    email: cl.emailAddress,
                    status: 'SMS_IDLE',
                    source: 'CRM_IMPORT',
                    score: 50,
                    imported_at: new Date().toISOString()
                });
                added++;
            }
        });

        if (added > 0) {
            fs.writeFileSync(LEADS_FILE, JSON.stringify(localLeads, null, 2));
            console.log(`   📥 CRM: Imported ${added} new leads.`);
        }
        return added;
    } catch (e) {
        console.error(`   ❌ CRM Pull Failed: ${e.message}`);
        return 0;
    }
}

async function pushInteractionToStream(lead, channel, data) {
    if (!CRM_BASE_URL) return;

    const timestamp = new Date().toLocaleString();

    let conversationText = "No transcript available.";
    if (data.conversation) {
        conversationText = data.conversation.map(m => `${m.role.toUpperCase()}: ${m.message}`).join('\n');
    }

    const content = `
[${channel.toUpperCase()} INTERACTION - ${timestamp}]
--------------------------------------------------
SUMMARY: ${data.summary || 'N/A'}
INTENT: ${data.intent || 'N/A'}
--------------------------------------------------
CONTENT / TRANSCRIPT:
${data.transcription || data.content || conversationText}
--------------------------------------------------
NEXT STEP / REPLY: ${data.nextPrompt || data.next_action || 'N/A'}
--------------------------------------------------
    `.trim();

    const payload = {
        post: content,
        parentId: lead.lead_id || lead.id,
        parentType: 'Lead',
        type: 'Post'
    };

    if (!payload.parentId && lead.email) {
        try {
            const authHeader = { Authorization: 'Basic ' + Buffer.from('admin:admin').toString('base64') };
            const searchRes = await axios.get(`${CRM_BASE_URL}/v1/Lead`, {
                params: {
                    select: 'id',
                    'where[0][type]': 'equals',
                    'where[0][attribute]': 'emailAddress',
                    'where[0][value]': lead.email
                },
                headers: authHeader
            });
            if (searchRes.data.list && searchRes.data.list.length > 0) {
                payload.parentId = searchRes.data.list[0].id;
            }
        } catch (e) { /* ignore */ }
    }

    if (!payload.parentId) {
        return;
    }

    try {
        await pushUnifiedEvent(lead, 'NOTE', payload);
        console.log(`   📝 CRM: Logged ${channel.toUpperCase()} interaction to Stream for ${lead.email || lead.phone}`);
    } catch (error) {
        console.error(`   ❌ CRM: Stream Logging Failed: ${error.message}`);
    }
}

async function checkConnection() {
    process.stdout.write(`🔌 CRM: Checking Connectivity to ${CRM_BASE_URL}... `);
    try {
        const authHeader = { Authorization: 'Basic ' + Buffer.from('admin:admin').toString('base64') };
        await axios.get(`${CRM_BASE_URL}/v1/Metadata`, {
            headers: authHeader,
            params: { select: 'scopes' },
            timeout: 3000
        });
        console.log("✅ ONLINE");
        return true;
    } catch (e) {
        console.log("⚠️ OFFLINE");
        return false;
    }
}

module.exports = {
    checkConnection,
    pullNewLeads,
    pushLeadUpdate,
    pushCallLog,
    pushOpportunity,
    pushCase,
    pushMeeting,
    pushInteractionToStream
};
