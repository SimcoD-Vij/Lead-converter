#!/bin/bash
# deploy_to_server.sh — Runs on server after code is uploaded
# Sets up the environment, updates configs, and starts Docker

set -e
cd /home/ubuntu/conversion-system

echo "=== [1/6] Updating .env SERVER_URL and TRACKING_DOMAIN ==="
SERVER_IP="44.211.23.183"
sed -i "s|TRACKING_DOMAIN=.*|TRACKING_DOMAIN=http://${SERVER_IP}:3000|g" .env
sed -i "s|SERVER_URL=.*|SERVER_URL=http://${SERVER_IP}:3000|g" .env
sed -i "s|CRM_PUBLIC_URL=.*|CRM_PUBLIC_URL=http://${SERVER_IP}:8080|g" .env
echo "✅ .env updated"

echo "=== [2/6] Creating required data files if missing ==="
mkdir -p processed_leads voice/voice_conversations sms email
[ -f voice/call_logs.json ] || echo '[]' > voice/call_logs.json
[ -f voice/summary_calls.json ] || echo '[]' > voice/summary_calls.json
[ -f sms/sms_history.json ] || echo '[]' > sms/sms_history.json
[ -f email/email_history.json ] || echo '[]' > email/email_history.json
[ -f system_state.json ] || echo '{}' > system_state.json
echo "✅ Data files ready"

echo "=== [3/6] Pulling Dograh Docker images ==="
docker compose -f docker-compose.dograh.yml pull
echo "✅ Images pulled"

echo "=== [4/6] Starting Dograh stack ==="
docker compose -f docker-compose.dograh.yml up -d
echo "✅ Dograh stack started"

echo "=== [5/6] Waiting for Dograh services to become healthy (90s) ==="
sleep 90

echo "=== [6/6] Building and starting Hivericks core ==="
docker compose up -d --build
echo "✅ Hivericks core started"

echo ""
echo "============================================"
echo "✅ DEPLOYMENT COMPLETE"
echo "============================================"
echo "  Dograh UI:       http://${SERVER_IP}:3010"
echo "  Dograh API:      http://${SERVER_IP}:8000"
echo "  Voice Server:    http://${SERVER_IP}:3000"
echo "  Gateway:         http://${SERVER_IP}:8082"
echo "============================================"
docker ps --format 'table {{.Names}}\t{{.Status}}\t{{.Ports}}'
