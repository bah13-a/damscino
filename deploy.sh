#!/bin/bash

set -e

echo "🚀 Starting deployment of Damascino..."

# Color output
RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if running on AWS EC2 or locally
if [ ! -d ".git" ]; then
    log_error "Not in a git repository. Please run this script from the project root."
    exit 1
fi

log_info "Pulling latest code from repository..."
git fetch origin
git checkout claude/serene-faraday-tqmxat
git pull origin claude/serene-faraday-tqmxat
log_success "Code updated"

log_info "Building Docker images with Aliyun Maven mirror..."
docker-compose build --no-cache
log_success "Docker images built successfully"

log_info "Starting services with docker-compose..."
docker-compose -f docker-compose.yml -f docker-compose.prod.yml up -d
log_success "Services started"

log_info "Waiting for services to be healthy..."
sleep 30

# Check gateway health
log_info "Checking gateway health..."
for i in {1..30}; do
    if docker-compose exec -T gateway wget -qO- http://localhost:8080/actuator/health 2>/dev/null | grep -q UP; then
        log_success "Gateway is healthy"
        break
    fi
    if [ $i -eq 30 ]; then
        log_error "Gateway failed to start after 30 attempts"
        exit 1
    fi
    echo "Waiting for gateway... ($i/30)"
    sleep 2
done

log_success "✅ Deployment completed successfully!"
echo ""
echo -e "${GREEN}Access the application:${NC}"
echo "  📱 Web Admin: http://localhost:3000"
echo "  🔧 API Gateway: http://localhost:8080"
echo ""
echo -e "${GREEN}Services running:${NC}"
docker-compose ps
