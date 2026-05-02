import subprocess
import json
import csv
import io

def pg_escape_string(s):
    if s is None:
        return 'NULL'
    return s.replace('\\', '\\\\').replace("'", "''")

def get_sql_output_single(cmd):
    result = subprocess.run(cmd, capture_output=True, text=True, shell=True)
    return result.stdout.strip()

def get_csv_output(cmd):
    result = subprocess.run(cmd, capture_output=True, text=True, shell=True)
    return result.stdout

# IDs
user_id = 3
api_key_id = 6
workflow_id = 10

# Data Extraction
# User
user_row = get_sql_output_single(f'docker exec dograh-postgres-1 psql -U postgres -d postgres -t -c "SELECT provider_id FROM users WHERE id = {user_id};"')
# Org
org_row = get_sql_output_single(f'docker exec dograh-postgres-1 psql -U postgres -d postgres -t -c "SELECT provider_id FROM organizations WHERE id = {user_id};"')
# API Key
api_key_csv = get_csv_output(f'docker exec dograh-postgres-1 psql -U postgres -d postgres -c "COPY (SELECT organization_id, created_by, key_prefix, key_hash, name FROM api_keys WHERE id = {api_key_id}) TO STDOUT WITH CSV"')
# Workflow
workflow_csv = get_csv_output(f'docker exec dograh-postgres-1 psql -U postgres -d postgres -c "COPY (SELECT organization_id, user_id, name, status, workflow_definition, template_context_variables, workflow_configurations, call_disposition_codes FROM workflows WHERE id = {workflow_id}) TO STDOUT WITH CSV"')
# User Config
user_config_row = get_sql_output_single(f'docker exec dograh-postgres-1 psql -U postgres -d postgres -t -c "SELECT configuration FROM user_configurations WHERE user_id = {user_id};"')
# Org Config (Telephony)
org_config_csv = get_csv_output(f'docker exec dograh-postgres-1 psql -U postgres -d postgres -c "COPY (SELECT key, value FROM organization_configurations WHERE organization_id = {user_id}) TO STDOUT WITH CSV"')

sql_lines = []
sql_lines.append(f"INSERT INTO users (id, provider_id) VALUES ({user_id}, '{pg_escape_string(user_row)}') ON CONFLICT (id) DO UPDATE SET provider_id = EXCLUDED.provider_id;")
sql_lines.append(f"INSERT INTO organizations (id, provider_id) VALUES ({user_id}, '{pg_escape_string(org_row)}') ON CONFLICT (id) DO UPDATE SET provider_id = EXCLUDED.provider_id;")
sql_lines.append(f"INSERT INTO organization_users (user_id, organization_id) VALUES ({user_id}, {user_id}) ON CONFLICT DO NOTHING;")

# Parse API Key
reader = csv.reader(io.StringIO(api_key_csv))
try:
    k = next(reader)
    sql_lines.append(f"INSERT INTO api_keys (id, organization_id, created_by, key_prefix, key_hash, name, is_active) VALUES ({api_key_id}, {k[0]}, {k[1]}, '{pg_escape_string(k[2])}', '{pg_escape_string(k[3])}', '{pg_escape_string(k[4])}', true) ON CONFLICT (id) DO UPDATE SET key_hash = EXCLUDED.key_hash;")
except: pass

# Parse Workflow
reader = csv.reader(io.StringIO(workflow_csv))
try:
    w = next(reader)
    sql_lines.append(f"DELETE FROM workflows WHERE id = {workflow_id};")
    sql_lines.append(f"INSERT INTO workflows (id, organization_id, user_id, name, status, workflow_definition, template_context_variables, workflow_configurations, call_disposition_codes) VALUES ({workflow_id}, {w[0]}, {w[1]}, E'{pg_escape_string(w[2])}', E'{pg_escape_string(w[3])}', E'{pg_escape_string(w[4])}', E'{pg_escape_string(w[5])}', E'{pg_escape_string(w[6])}', E'{pg_escape_string(w[7])}');")
except: pass

# User Config
sql_lines.append(f"DELETE FROM user_configurations WHERE user_id = {user_id};")
sql_lines.append(f"INSERT INTO user_configurations (user_id, configuration) VALUES ({user_id}, E'{pg_escape_string(user_config_row)}');")

# Org Config
reader = csv.reader(io.StringIO(org_config_csv))
for row in reader:
    sql_lines.append(f"DELETE FROM organization_configurations WHERE organization_id = {user_id} AND key = '{pg_escape_string(row[0])}';")
    sql_lines.append(f"INSERT INTO organization_configurations (organization_id, key, value) VALUES ({user_id}, '{pg_escape_string(row[0])}', E'{pg_escape_string(row[1])}');")

sql_lines.append("SELECT setval('users_id_seq', (SELECT MAX(id) FROM users));")
sql_lines.append("SELECT setval('organizations_id_seq', (SELECT MAX(id) FROM organizations));")
sql_lines.append("SELECT setval('api_keys_id_seq', (SELECT MAX(id) FROM api_keys));")
sql_lines.append("SELECT setval('workflows_id_seq', (SELECT MAX(id) FROM workflows));")

with open('D:/Hivericks/total_repair.sql', 'w', encoding='utf-8') as f:
    f.write('\n'.join(sql_lines))

print("Generated D:/Hivericks/total_repair.sql")
