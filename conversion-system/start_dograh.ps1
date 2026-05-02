# Dograh AI Platform - Startup Script (Windows)
# Starts all Dograh services using Docker Compose

Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "  DOGRAH AI PLATFORM - STARTUP" -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host ""

# Check if Docker is running
try {
    docker info | Out-Null
    Write-Host "✓ Docker is running" -ForegroundColor Green
} catch {
    Write-Host "❌ Error: Docker is not running" -ForegroundColor Red
    Write-Host "   Please start Docker Desktop and try again" -ForegroundColor Yellow
    exit 1
}

Write-Host ""

# Pull latest images
Write-Host "📥 Pulling latest Dograh images..." -ForegroundColor Yellow
docker compose -f docker-compose.dograh.yml pull

Write-Host ""
Write-Host "🚀 Starting Dograh services..." -ForegroundColor Yellow
docker compose -f docker-compose.dograh.yml up -d

Write-Host ""
Write-Host "⏳ Waiting for services to be healthy..." -ForegroundColor Yellow
Start-Sleep -Seconds 10

# Check service status
Write-Host ""
Write-Host "🔍 Checking service status..." -ForegroundColor Yellow
docker compose -f docker-compose.dograh.yml ps

Write-Host ""
Write-Host "==========================================" -ForegroundColor Green
Write-Host "  DOGRAH AI PLATFORM - READY!" -ForegroundColor Green
Write-Host "==========================================" -ForegroundColor Green
Write-Host ""
Write-Host "Services:" -ForegroundColor Cyan
Write-Host "  • Dograh UI:  http://localhost:3010" -ForegroundColor White
Write-Host "  • Dograh API: http://localhost:8000" -ForegroundColor White
Write-Host "  • MinIO:      http://localhost:9001" -ForegroundColor White
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Cyan
Write-Host "  1. Open http://localhost:3010 to access Dograh UI" -ForegroundColor White
Write-Host "  2. Create your first workflow" -ForegroundColor White
Write-Host "  3. Test with 'node test_dograh.js'" -ForegroundColor White
Write-Host ""
Write-Host "To view logs:" -ForegroundColor Cyan
Write-Host "  docker compose -f docker-compose.dograh.yml logs -f" -ForegroundColor White
Write-Host ""
Write-Host "To stop:" -ForegroundColor Cyan
Write-Host "  docker compose -f docker-compose.dograh.yml down" -ForegroundColor White
Write-Host ""
