#!/bin/bash

# Dograh AI Platform - Startup Script
# Starts all Dograh services using Docker Compose

echo "=========================================="
echo "  DOGRAH AI PLATFORM - STARTUP"
echo "=========================================="
echo ""

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
    echo "❌ Error: Docker is not running"
    echo "   Please start Docker Desktop and try again"
    exit 1
fi

echo "✓ Docker is running"
echo ""

# Pull latest images
echo "📥 Pulling latest Dograh images..."
docker compose -f docker-compose.dograh.yml pull

echo ""
echo "🚀 Starting Dograh services..."
docker compose -f docker-compose.dograh.yml up -d

echo ""
echo "⏳ Waiting for services to be healthy..."
sleep 10

# Check service health
echo ""
echo "🔍 Checking service status..."
docker compose -f docker-compose.dograh.yml ps

echo ""
echo "=========================================="
echo "  DOGRAH AI PLATFORM - READY!"
echo "=========================================="
echo ""
echo "Services:"
echo "  • Dograh UI:  http://localhost:3010"
echo "  • Dograh API: http://localhost:8000"
echo "  • MinIO:      http://localhost:9001"
echo ""
echo "Next steps:"
echo "  1. Open http://localhost:3010 to access Dograh UI"
echo "  2. Create your first workflow"
echo "  3. Test with 'node test_dograh.js'"
echo ""
echo "To view logs:"
echo "  docker compose -f docker-compose.dograh.yml logs -f"
echo ""
echo "To stop:"
echo "  docker compose -f docker-compose.dograh.yml down"
echo ""
