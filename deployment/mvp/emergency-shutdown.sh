#!/bin/bash
# EMERGENCY COST SHUTDOWN
# Immediately scales down all services to minimum to prevent cost explosion
# Usage: ./emergency-shutdown.sh

set -e

PROJECT_ID="bouhmid-mvp"
REGION="us-central1"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${RED}========================================${NC}"
echo -e "${RED}🚨 EMERGENCY COST SHUTDOWN 🚨${NC}"
echo -e "${RED}========================================${NC}"
echo ""
echo -e "${YELLOW}This will immediately:${NC}"
echo "  • Scale API to max 1 instance (min 0)"
echo "  • Disable all agent services"
echo "  • Stop any running Cloud Run jobs"
echo ""
read -p "Continue? (yes/no): " CONFIRM

if [ "${CONFIRM}" != "yes" ]; then
    echo "Cancelled."
    exit 0
fi

# Set project
gcloud config set project "${PROJECT_ID}"

echo ""
echo -e "${RED}Scaling down services...${NC}"
echo ""

# Scale down main API (keep accessible but minimal)
echo -e "${YELLOW}Scaling down API to minimum...${NC}"
gcloud run services update bouhmid-api \
  --region "${REGION}" \
  --min-instances 0 \
  --max-instances 1 \
  --quiet

echo -e "${GREEN}✓ API scaled to max 1 instance${NC}"

# Disable agent services (if they exist)
echo -e "${YELLOW}Checking for agent services...${NC}"

if gcloud run services describe prospector --region "${REGION}" &> /dev/null; then
    echo -e "${YELLOW}Disabling Prospector agent...${NC}"
    gcloud run services update prospector \
      --region "${REGION}" \
      --max-instances 0 \
      --no-allow-unauthenticated \
      --quiet
    echo -e "${GREEN}✓ Prospector disabled${NC}"
fi

if gcloud run services describe orion --region "${REGION}" &> /dev/null; then
    echo -e "${YELLOW}Disabling Orion agent...${NC}"
    gcloud run services update orion \
      --region "${REGION}" \
      --max-instances 0 \
      --no-allow-unauthenticated \
      --quiet
    echo -e "${GREEN}✓ Orion disabled${NC}"
fi

# List all running Cloud Run jobs and cancel them
echo -e "${YELLOW}Checking for running jobs...${NC}"
RUNNING_JOBS=$(gcloud run jobs executions list --region "${REGION}" --filter="status.phase=RUNNING" --format="value(name)" 2>/dev/null || true)

if [ ! -z "${RUNNING_JOBS}" ]; then
    echo -e "${YELLOW}Cancelling running jobs...${NC}"
    for JOB in ${RUNNING_JOBS}; do
        echo "  • Cancelling ${JOB}"
        gcloud run jobs executions cancel "${JOB}" --region "${REGION}" --quiet || true
    done
    echo -e "${GREEN}✓ All jobs cancelled${NC}"
else
    echo -e "${GREEN}✓ No running jobs${NC}"
fi

# Get current cost estimate
echo ""
echo -e "${YELLOW}Current billing status:${NC}"
echo "View real-time costs: https://console.cloud.google.com/billing/reports?project=${PROJECT_ID}"
echo ""

# List current services
echo -e "${YELLOW}Current service status:${NC}"
gcloud run services list --region "${REGION}" --format="table(metadata.name,status.url,status.conditions[0].type,spec.template.spec.containers[0].resources.limits.memory)"

echo ""
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}Emergency Shutdown Complete${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""
echo -e "${YELLOW}What's running:${NC}"
echo "  • Main API: Scaled to max 1 instance (scale-to-zero enabled)"
echo "  • Agents: Disabled"
echo "  • Jobs: Cancelled"
echo ""
echo -e "${YELLOW}To restore normal operation:${NC}"
echo "  ./deploy-to-cloudrun.sh"
echo ""
echo -e "${YELLOW}Next steps:${NC}"
echo "  1. Identify cost spike cause"
echo "  2. Fix the issue"
echo "  3. Monitor for 24h before restoring"
echo "  4. Review budget alerts"
echo ""
