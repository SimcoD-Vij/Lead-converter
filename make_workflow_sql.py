import subprocess
import csv
import io

def pg_escape_string(s):
    if s is None:
        return 'NULL'
    # Escape backslashes first, then single quotes
    return s.replace('\\', '\\\\').replace("'", "''")

cmd_csv = 'docker exec dograh-postgres-1 psql -U postgres -d postgres -c "COPY (SELECT organization_id, user_id, name, status, workflow_definition, template_context_variables, workflow_configurations, call_disposition_codes FROM workflows WHERE id = 10) TO STDOUT WITH CSV"'
result_csv = subprocess.run(cmd_csv, capture_output=True, text=True, shell=True)
reader = csv.reader(io.StringIO(result_csv.stdout))
w_parts = next(reader)

sql = f"""DELETE FROM workflows WHERE id = 10;
INSERT INTO workflows (id, organization_id, user_id, name, status, workflow_definition, template_context_variables, workflow_configurations, call_disposition_codes) 
VALUES (10, {w_parts[0]}, {w_parts[1]}, E'{pg_escape_string(w_parts[2])}', E'{pg_escape_string(w_parts[3])}', E'{pg_escape_string(w_parts[4])}', E'{pg_escape_string(w_parts[5])}', E'{pg_escape_string(w_parts[6])}', E'{pg_escape_string(w_parts[7])}');
"""

with open('D:/Hivericks/workflows_sync.sql', 'w', encoding='utf-8') as f:
    f.write(sql)

print("Generated D:/Hivericks/workflows_sync.sql")
