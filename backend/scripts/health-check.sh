#!/bin/bash
set -e

# ========================================
# Shabou Auto Pièces - Health Check Script
# ========================================
# Checks the health of all services
#
# Usage:
#   ./health-check.sh [local|staging|production]
#
# Exit codes:
#   0 - All services healthy
#   1 - One or more services unhealthy
# ========================================

ENVIRONMENT=${1:-local}

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

# ========================================
# Configuration
# ========================================

case $ENVIRONMENT in
    local)
        API_URL="http://localhost:3000"
        PROSPECTOR_URL="http://localhost:8001"
        ORION_URL="http://localhost:8002"
        ;;
    staging)
        API_URL="https://staging-api.shabouautopieces.tn"
        PROSPECTOR_URL="https://staging-api.shabouautopieces.tn:8001"
        ORION_URL="https://staging-api.shabouautopieces.tn:8002"
        ;;
    production)
        API_URL="https://api.shabouautopieces.tn"
        PROSPECTOR_URL="https://api.shabouautopieces.tn:8001"
        ORION_URL="https://api.shabouautopieces.tn:8002"
        ;;
    *)
        echo "Usage: $0 [local|staging|production]"
        exit 1
        ;;
esac

# ========================================
# Health Check Functions
# ========================================

check_service() {
    local name=$1
    local url=$2
    local critical=${3:-true}

    echo -n "Checking $name... "

    if curl -f -s -m 10 "$url" > /dev/null 2>&1; then
        echo -e "${GREEN}✅ Healthy${NC}"
        return 0
    else
        if [ "$critical" = true ]; then
            echo -e "${RED}❌ Unhealthy (CRITICAL)${NC}"
            return 1
        else
            echo -e "${YELLOW}⚠️  Unhealthy (non-critical)${NC}"
            return 0
        fi
    fi
}

check_endpoint() {
    local name=$1
    local url=$2

    echo -n "  Testing $name... "

    response=$(curl -s -o /dev/null -w "%{http_code}" -m 10 "$url" 2>/dev/null)

    if [ "$response" = "200" ]; then
        echo -e "${GREEN}✅ OK${NC}"
        return 0
    else
        echo -e "${RED}❌ Failed (HTTP $response)${NC}"
        return 1
    fi
}

# ========================================
# Main Health Checks
# ========================================

echo "========================================="
echo "Health Check - $ENVIRONMENT"
echo "========================================="
echo ""

FAILED=0

# API Service
echo "📊 API Service:"
check_service "Health endpoint" "$API_URL/api/v1/health" true || FAILED=1
check_endpoint "Products endpoint" "$API_URL/api/v1/products" || FAILED=1
check_endpoint "Brands endpoint" "$API_URL/api/v1/brands" || FAILED=1
check_endpoint "Categories endpoint" "$API_URL/api/v1/categories" || FAILED=1
echo ""

# Prospector Agent
echo "🔍 Prospector Agent:"
check_service "Health endpoint" "$PROSPECTOR_URL/health" false || FAILED=1
echo ""

# Orion Agent
echo "🔮 Orion Agent:"
check_service "Health endpoint" "$ORION_URL/health" false || FAILED=1
echo ""

# Docker Services (local only)
if [ "$ENVIRONMENT" = "local" ]; then
    echo "🐳 Docker Services:"

    if command -v docker-compose &> /dev/null; then
        services=$(docker-compose ps --services 2>/dev/null)

        for service in $services; do
            echo -n "  $service... "
            status=$(docker-compose ps -q $service | xargs docker inspect -f '{{.State.Health.Status}}' 2>/dev/null || echo "unknown")

            case $status in
                healthy)
                    echo -e "${GREEN}✅ Healthy${NC}"
                    ;;
                starting)
                    echo -e "${YELLOW}🔄 Starting${NC}"
                    ;;
                unhealthy)
                    echo -e "${RED}❌ Unhealthy${NC}"
                    FAILED=1
                    ;;
                *)
                    echo -e "${YELLOW}⚠️  Unknown${NC}"
                    ;;
            esac
        done
    else
        echo "  Docker Compose not found, skipping"
    fi
    echo ""
fi

# ========================================
# Summary
# ========================================

echo "========================================="
if [ $FAILED -eq 0 ]; then
    echo -e "${GREEN}✅ All critical services are healthy${NC}"
    echo "========================================="
    exit 0
else
    echo -e "${RED}❌ Some services are unhealthy${NC}"
    echo "========================================="
    exit 1
fi
