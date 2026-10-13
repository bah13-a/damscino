#!/bin/bash

set -e

echo "🚀 Starting deployment of Damascino..."

# Color output
RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if running on AWS EC2 or locally
if [ ! -d ".git" ]; then
    log_error "Not in a git repository. Please run this script from the project root."
    exit 1
fi

# Configuration
GITHUB_REPO="bah13-a/damscino"
GITHUB_TOKEN="${GITHUB_TOKEN:-}"
RELEASE_TAG="android-test"
APK_FILENAME="damascino-privileges-test.apk"
DOWNLOADS_DIR="./app-downloads"

log_info "Pulling latest code from repository..."
git fetch origin
git checkout claude/serene-faraday-tqmxat
git pull origin claude/serene-faraday-tqmxat
log_success "Code updated"

# Create app-downloads directory for serving APK
log_info "Setting up downloads directory..."
mkdir -p "$DOWNLOADS_DIR"
log_success "Downloads directory ready at $DOWNLOADS_DIR"

# Download APK from GitHub release
log_info "Downloading APK from GitHub release '$RELEASE_TAG'..."
if [ -n "$GITHUB_TOKEN" ]; then
    AUTH_HEADER="Authorization: token $GITHUB_TOKEN"
else
    AUTH_HEADER=""
    log_warning "No GITHUB_TOKEN set; API rate limits may apply"
fi

# Get the latest release info
RELEASE_INFO=$(curl -s -H "$AUTH_HEADER" \
    "https://api.github.com/repos/$GITHUB_REPO/releases/tags/$RELEASE_TAG")

# Extract the APK download URL
APK_URL=$(echo "$RELEASE_INFO" | grep -o '"browser_download_url": "[^"]*\.apk"' | head -1 | cut -d'"' -f4)

if [ -z "$APK_URL" ]; then
    log_error "Could not find APK in release '$RELEASE_TAG'"
    log_info "Available releases: https://github.com/$GITHUB_REPO/releases"
    exit 1
fi

log_info "Downloading from: $APK_URL"
curl -s -L -o "$DOWNLOADS_DIR/$APK_FILENAME" "$APK_URL"

if [ -f "$DOWNLOADS_DIR/$APK_FILENAME" ]; then
    APK_SIZE=$(du -h "$DOWNLOADS_DIR/$APK_FILENAME" | cut -f1)
    log_success "APK downloaded successfully ($APK_SIZE)"
else
    log_error "Failed to download APK"
    exit 1
fi

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
echo "  📥 APK Download: http://localhost:3000/downloads/$APK_FILENAME"
echo ""
echo -e "${GREEN}APK Details:${NC}"
echo "  Location: $DOWNLOADS_DIR/$APK_FILENAME"
echo "  Size: $(du -h "$DOWNLOADS_DIR/$APK_FILENAME" | cut -f1)"
echo ""
echo -e "${GREEN}Services running:${NC}"
docker-compose ps
echo ""
log_info "APK is accessible at: http://your-domain/downloads/$APK_FILENAME"
log_info "Admin login: admin / 4bvuBqtCx9VnOngL"
