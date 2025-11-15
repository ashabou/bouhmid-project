#!/bin/bash
# Cost Monitoring Script
# Check current GCP costs and alert if approaching limits
# Usage: ./cost-monitor.sh

set -e

PROJECT_ID="bouhmid-mvp"
MONTHLY_BUDGET=300
DAILY_LIMIT=10  # Alert if daily cost > $10

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}Bouhmid Cost Monitor${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""

# Set project
gcloud config set project "${PROJECT_ID}" --quiet

# Get billing account
BILLING_ACCOUNT=$(gcloud billing projects describe "${PROJECT_ID}" --format="value(billingAccountName)" | cut -d'/' -f2)

if [ -z "${BILLING_ACCOUNT}" ]; then
    echo -e "${RED}Error: No billing account found${NC}"
    exit 1
fi

# Get current month costs (requires BigQuery export - manual check)
echo -e "${YELLOW}Monthly Budget: \$${MONTHLY_BUDGET}${NC}"
echo ""
echo "To view current costs:"
echo "  • Billing Dashboard: https://console.cloud.google.com/billing/${BILLING_ACCOUNT}"
echo "  • Cost Reports: https://console.cloud.google.com/billing/reports?project=${PROJECT_ID}"
echo ""

# Check Cloud Run metrics
echo -e "${YELLOW}Cloud Run Service Status:${NC}"
echo ""

SERVICES=$(gcloud run services list --platform managed --region us-central1 --format="value(metadata.name)" 2>/dev/null || true)

if [ -z "${SERVICES}" ]; then
    echo "No Cloud Run services deployed"
else
    for SERVICE in ${SERVICES}; do
        echo -e "${GREEN}Service: ${SERVICE}${NC}"

        # Get service details
        DETAILS=$(gcloud run services describe "${SERVICE}" --region us-central1 --format="json")

        # Extract key metrics
        MIN_INSTANCES=$(echo "${DETAILS}" | jq -r '.spec.template.metadata.annotations["autoscaling.knative.dev/minScale"] // "0"')
        MAX_INSTANCES=$(echo "${DETAILS}" | jq -r '.spec.template.metadata.annotations["autoscaling.knative.dev/maxScale"] // "100"')
        MEMORY=$(echo "${DETAILS}" | jq -r '.spec.template.spec.containers[0].resources.limits.memory')
        CPU=$(echo "${DETAILS}" | jq -r '.spec.template.spec.containers[0].resources.limits.cpu')

        echo "  • Min instances: ${MIN_INSTANCES}"
        echo "  • Max instances: ${MAX_INSTANCES}"
        echo "  • Memory: ${MEMORY}"
        echo "  • CPU: ${CPU}"

        # Cost estimate (rough)
        # Cloud Run pricing: $0.00002400/vCPU-second, $0.00000250/GiB-second
        # Assuming average 10% utilization over 30 days
        if [ "${MIN_INSTANCES}" = "0" ]; then
            echo -e "  • ${GREEN}Scale-to-zero: ✓ (cost-optimized)${NC}"
        else
            echo -e "  • ${YELLOW}Always-on: ${MIN_INSTANCES} instances (review if needed)${NC}"
        fi

        echo ""
    done
fi

# Check for Cloud SQL instances (should be NONE in MVP)
echo -e "${YELLOW}Cloud SQL Instances:${NC}"
SQL_INSTANCES=$(gcloud sql instances list --format="value(name)" 2>/dev/null || true)

if [ -z "${SQL_INSTANCES}" ]; then
    echo -e "${GREEN}✓ None (using Supabase - cost optimized)${NC}"
else
    echo -e "${RED}⚠ Found Cloud SQL instances (expensive!):${NC}"
    for INSTANCE in ${SQL_INSTANCES}; do
        echo "  • ${INSTANCE}"
        TIER=$(gcloud sql instances describe "${INSTANCE}" --format="value(settings.tier)")
        echo "    Tier: ${TIER}"
    done
    echo ""
    echo -e "${YELLOW}Consider migrating to Supabase to reduce costs${NC}"
fi
echo ""

# Check for other expensive resources
echo -e "${YELLOW}Other Resources:${NC}"

# Check for VMs (should be NONE)
VMS=$(gcloud compute instances list --format="value(name)" 2>/dev/null || true)
if [ -z "${VMS}" ]; then
    echo -e "  • Compute VMs: ${GREEN}None ✓${NC}"
else
    echo -e "  • Compute VMs: ${RED}${VMS}${NC} (consider stopping)"
fi

# Check for load balancers (should be NONE for MVP)
LBS=$(gcloud compute forwarding-rules list --format="value(name)" 2>/dev/null || true)
if [ -z "${LBS}" ]; then
    echo -e "  • Load Balancers: ${GREEN}None ✓${NC}"
else
    echo -e "  • Load Balancers: ${YELLOW}${LBS}${NC} (review if needed)"
fi

# Check for persistent disks
DISKS=$(gcloud compute disks list --format="value(name,sizeGb)" 2>/dev/null || true)
if [ -z "${DISKS}" ]; then
    echo -e "  • Persistent Disks: ${GREEN}None ✓${NC}"
else
    echo -e "  • Persistent Disks: ${YELLOW}Found${NC}"
    echo "${DISKS}" | while read disk; do
        echo "    - ${disk}"
    done
fi

echo ""

# Cost optimization recommendations
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}Cost Optimization Checklist${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""

# Check scale-to-zero configuration
HAS_ALWAYS_ON=false
for SERVICE in ${SERVICES}; do
    MIN=$(gcloud run services describe "${SERVICE}" --region us-central1 --format="value(spec.template.metadata.annotations['autoscaling.knative.dev/minScale'])" 2>/dev/null || echo "0")
    if [ "${MIN}" != "0" ] && [ ! -z "${MIN}" ]; then
        HAS_ALWAYS_ON=true
        echo -e "${YELLOW}⚠ ${SERVICE} has min instances = ${MIN}${NC}"
    fi
done

if [ "${HAS_ALWAYS_ON}" = false ]; then
    echo -e "${GREEN}✓ All services scale-to-zero${NC}"
else
    echo -e "${YELLOW}⚠ Some services always-on (consider scale-to-zero)${NC}"
fi

# Database check
if [ -z "${SQL_INSTANCES}" ]; then
    echo -e "${GREEN}✓ No Cloud SQL (using Supabase)${NC}"
else
    echo -e "${RED}⚠ Cloud SQL found (expensive - consider Supabase)${NC}"
fi

# Redis check
REDIS_INSTANCES=$(gcloud redis instances list --region us-central1 --format="value(name)" 2>/dev/null || true)
if [ -z "${REDIS_INSTANCES}" ]; then
    echo -e "${GREEN}✓ No Cloud Memorystore (use Upstash if needed)${NC}"
else
    echo -e "${YELLOW}⚠ Memorystore Redis found (consider Upstash serverless)${NC}"
fi

echo ""
echo -e "${YELLOW}Quick Links:${NC}"
echo "  • Cost Reports: https://console.cloud.google.com/billing/reports?project=${PROJECT_ID}"
echo "  • Budget Alerts: https://console.cloud.google.com/billing/budgets?project=${PROJECT_ID}"
echo "  • Cloud Run: https://console.cloud.google.com/run?project=${PROJECT_ID}"
echo ""
echo -e "${YELLOW}Emergency:${NC}"
echo "  • Run: ./emergency-shutdown.sh"
echo ""
