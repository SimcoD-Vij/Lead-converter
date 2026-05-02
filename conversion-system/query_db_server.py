import subprocess

def run_sql(sql):
    command = ["docker", "exec", "conversion-system-python-postgres-1", "psql", "-U", "postgres", "-d", "postgres", "-t", "-A", "-c", sql]
    result = subprocess.run(command, capture_output=True, text=True)
    return result.stdout.strip()

print("--- Tables List ---")
tables = run_sql("SELECT table_name FROM information_schema.tables WHERE table_schema = 'public';")
print(tables)

for table in tables.split('\n'):
    if not table: continue
    count = run_sql(f"SELECT COUNT(*) FROM {table};")
    print(f"Table {table}: {count} rows")

print("\n--- Integrations Content ---")
print(run_sql("SELECT * FROM integrations;"))

print("\n--- API Keys Content ---")
print(run_sql("SELECT organization_id, key_prefix FROM api_keys;"))
