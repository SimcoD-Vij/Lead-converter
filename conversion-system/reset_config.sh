#!/bin/bash
# Reset user AI configuration so Dograh auto-generates fresh service keys via the new tunnel
docker exec dograh_postgres psql -U postgres -d dograh -c "UPDATE user_configurations SET configuration = '{}'::jsonb WHERE user_id = 1;"
echo "Config cleared."
docker exec dograh_postgres psql -U postgres -d dograh -c "SELECT user_id, configuration FROM user_configurations WHERE user_id = 1;"
