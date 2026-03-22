#!/bin/bash
echo "--- api/services/auth/depends.py ---"
docker exec dograh-api-1 cat /app/api/services/auth/depends.py
echo "--- api/db/user_client.py ---"
docker exec dograh-api-1 cat /app/api/db/user_client.py
