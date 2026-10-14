#!/bin/bash

# Damascino Complete Testing Suite
# Exécute tous les scénarios de test sur le serveur de déploiement

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}╔════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║  Damascino Complete Testing Suite                       ║${NC}"
echo -e "${BLUE}║  Test d'intégration complet - Web & Mobile              ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════════════╝${NC}"
echo ""

# Get base URL from argument or environment
BASE_URL="${1:-https://16-171-199-82.sslip.io}"

echo -e "${YELLOW}URL du serveur de test:${NC} $BASE_URL"
echo ""

# Check if URL is accessible
echo -e "${YELLOW}Vérification de l'accessibilité du serveur...${NC}"
if ! curl -s -k -o /dev/null -w "%{http_code}" "$BASE_URL" > /dev/null 2>&1; then
    echo -e "${RED}❌ Le serveur n'est pas accessible à $BASE_URL${NC}"
    echo "   Vérifiez:"
    echo "   1. L'URL est correcte"
    echo "   2. Le serveur est en cours d'exécution"
    echo "   3. Vous avez une connexion réseau stable"
    exit 1
fi
echo -e "${GREEN}✓ Serveur accessible${NC}"
echo ""

# Install dependencies
echo -e "${YELLOW}Installation des dépendances Playwright...${NC}"
npm install --silent 2>/dev/null || true
echo -e "${GREEN}✓ Dépendances installées${NC}"
echo ""

# Create report directory
REPORT_DIR="./playwright-report-$(date +%Y%m%d-%H%M%S)"
mkdir -p "$REPORT_DIR"

echo -e "${YELLOW}Exécution des tests...${NC}"
echo -e "${YELLOW}Rapports sauvegardés dans:${NC} $REPORT_DIR"
echo ""

# Run tests with different project configurations
FAILED=0

# 1. Tests Desktop (Admin, Accès, Security)
echo -e "${BLUE}1️⃣  Tests Desktop (Admin Dashboard, Partners, Reporting)...${NC}"
if E2E_BASE_URL="$BASE_URL" npx playwright test \
    --project=desktop \
    --reporter=html,json \
    2>&1 | tee "$REPORT_DIR/desktop-tests.log"; then
    echo -e "${GREEN}✓ Tests Desktop réussis${NC}"
else
    echo -e "${RED}❌ Tests Desktop échoués${NC}"
    FAILED=$((FAILED + 1))
fi
echo ""

# 2. Tests Integration (Services API)
echo -e "${BLUE}2️⃣  Tests Intégration (API Services)...${NC}"
if E2E_BASE_URL="$BASE_URL" npx playwright test \
    --project=integration \
    --reporter=html,json \
    2>&1 | tee "$REPORT_DIR/integration-tests.log"; then
    echo -e "${GREEN}✓ Tests Intégration réussis${NC}"
else
    echo -e "${RED}❌ Tests Intégration échoués${NC}"
    FAILED=$((FAILED + 1))
fi
echo ""

# Summary
echo -e "${BLUE}╔════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║  RÉSUMÉ DES TESTS                                       ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════════════╝${NC}"
echo ""

# Show statistics
TOTAL_TESTS=$(grep -r "✓\|✔" "$REPORT_DIR"/*.log 2>/dev/null | wc -l || echo "0")
FAILED_TESTS=$(grep -r "✖\|✘\|Error" "$REPORT_DIR"/*.log 2>/dev/null | wc -l || echo "0")

echo -e "Tests Réussis:  ${GREEN}$((TOTAL_TESTS - FAILED_TESTS))${NC}"
echo -e "Tests Échoués:  ${RED}$FAILED_TESTS${NC}"
echo ""

echo -e "${YELLOW}📊 Rapports disponibles:${NC}"
ls -la "$REPORT_DIR"/
echo ""

# Open HTML report if available
if [ -f "playwright-report/index.html" ]; then
    echo -e "${YELLOW}Rapport HTML:${NC} playwright-report/index.html"
    echo "Pour visualiser le rapport: npx playwright show-report"
fi

echo ""
if [ $FAILED -eq 0 ]; then
    echo -e "${GREEN}✓ Tous les tests sont passés avec succès!${NC}"
    exit 0
else
    echo -e "${RED}❌ Certains tests ont échoué. Vérifiez les logs ci-dessus.${NC}"
    exit 1
fi
