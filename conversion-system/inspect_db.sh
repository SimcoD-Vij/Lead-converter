#!/bin/bash
echo "--- UPDATING API KEY ---"
docker exec dograh-postgres-1 psql -U postgres -d postgres -c "UPDATE users SET api_key = 'TEST_KEY_123' WHERE email = 'admin@dograh.com';"

echo "--- VERIFYING UPDATE ---"
docker exec dograh-postgres-1 psql -U postgres -d postgres -x -c "SELECT email, api_key FROM users WHERE email = 'admin@dograh.com';"
