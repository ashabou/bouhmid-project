#!/bin/bash
# Deploy Bouhmid API to Cloud Run (MVP Configuration)
# Usage: ./deploy-to-cloudrun.sh [environment]

set -e

# Configuration
PROJECT_ID="bouhmid-mvp"
REGION="us-central1"
SERVICE_NAME="bouhmid-api"
ENVIRONMENT="${1:-production}"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}Deploying Bouhmid API to Cloud Run${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""

# Check if gcloud is installed
if ! command -v gcloud &> /dev/null; then
    echo -e "${RED}Error: gcloud CLI not found${NC}"
    echo "Install from: https://cloud.google.com/sdk/docs/install"
    exit 1
fi

# Check if logged in
if ! gcloud auth list --filter=status:ACTIVE --format="value(account)" &> /dev/null; then
    echo -e "${YELLOW}Not logged in to gcloud. Running login...${NC}"
    gcloud auth login
fi

# Set project
echo -e "${YELLOW}Setting project: ${PROJECT_ID}${NC}"
gcloud config set project "${PROJECT_ID}"

# Verify secrets exist
echo -e "${YELLOW}Verifying secrets...${NC}"
REQUIRED_SECRETS=("DATABASE_URL" "JWT_SECRET" "JWT_REFRESH_SECRET")

for SECRET in "${REQUIRED_SECRETS[@]}"; do
    if ! gcloud secrets describe "${SECRET}" &> /dev/null; then
        echo -e "${RED}Error: Secret '${SECRET}' not found${NC}"
        echo "Create it with: gcloud secrets create ${SECRET} --data-file=-"
        exit 1
    fi
done

echo -e "${GREEN}✓ All required secrets exist${NC}"

# Get frontend URL (update if custom domain)
FRONTEND_URL="https://bouhmid-mvp.web.app"
echo -e "${YELLOW}CORS Origin: ${FRONTEND_URL}${NC}"

# Deploy to Cloud Run
echo ""
echo -e "${GREEN}Deploying to Cloud Run...${NC}"
echo ""

gcloud run deploy "${SERVICE_NAME}" \
  --source ../../backend/api \
  --region "${REGION}" \
  --platform managed \
  --allow-unauthenticated \
  --min-instances 0 \
  --max-instances 5 \
  --cpu 1 \
  --memory 512Mi \
  --timeout 60s \
  --concurrency 80 \
  --port 8080 \
  --set-env-vars "\
NODE_ENV=production,\
PORT=8080,\
CORS_ORIGIN=${FRONTEND_URL},\
FRONTEND_URL=${FRONTEND_URL},\
LOG_LEVEL=info,\
REDIS_ENABLED=false,\
RATE_LIMIT_MAX=100,\
RATE_LIMIT_WINDOW_MS=60000" \
  --set-secrets "\
DATABASE_URL=DATABASE_URL:latest,\
JWT_SECRET=JWT_SECRET:latest,\
JWT_REFRESH_SECRET=JWT_REFRESH_SECRET:latest"

# Get service URL
SERVICE_URL=$(gcloud run services describe "${SERVICE_NAME}" \
  --region "${REGION}" \
  --format "value(status.url)")

echo ""
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}Deployment Complete!${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""
echo -e "Service URL: ${GREEN}${SERVICE_URL}${NC}"
echo ""

# Test health endpoint
echo -e "${YELLOW}Testing health endpoint...${NC}"
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" "${SERVICE_URL}/health")

if [ "${HTTP_CODE}" = "200" ]; then
    echo -e "${GREEN}✓ Health check passed (200 OK)${NC}"
else
    echo -e "${RED}✗ Health check failed (HTTP ${HTTP_CODE})${NC}"
    echo "Check logs: gcloud run services logs read ${SERVICE_NAME} --region ${REGION}"
fi

echo ""
echo -e "${YELLOW}Next steps:${NC}"
echo "1. Update frontend VITE_API_BASE_URL to: ${SERVICE_URL}/api"
echo "2. Test API: curl ${SERVICE_URL}/api/products"
echo "3. View logs: gcloud run services logs read ${SERVICE_NAME} --region ${REGION}"
echo "4. Monitor costs: https://console.cloud.google.com/billing/reports"
echo ""
