#!/bin/bash
# Setup Budget Alerts for Bouhmid GCP Project
# Usage: ./setup-budget-alerts.sh

set -e

PROJECT_ID="bouhmid-mvp"
BUDGET_AMOUNT=300  # $300 monthly limit
ALERT_EMAIL="admin@bouhmid.tn"  # Change to your email

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}Setting up Budget Alerts${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""

# Get billing account
BILLING_ACCOUNT=$(gcloud billing projects describe "${PROJECT_ID}" --format="value(billingAccountName)" | cut -d'/' -f2)

if [ -z "${BILLING_ACCOUNT}" ]; then
    echo -e "${YELLOW}No billing account linked to project${NC}"
    echo "Link billing account at: https://console.cloud.google.com/billing/linkedaccount?project=${PROJECT_ID}"
    exit 1
fi

echo -e "${YELLOW}Billing Account: ${BILLING_ACCOUNT}${NC}"
echo -e "${YELLOW}Monthly Budget: \$${BUDGET_AMOUNT}${NC}"
echo ""

# Create budget.yaml
cat > budget.yaml <<EOF
displayName: "Bouhmid \$${BUDGET_AMOUNT} Monthly Limit"
budgetFilter:
  projects:
    - projects/${PROJECT_ID}
  calendarPeriod: MONTH
amount:
  specifiedAmount:
    currencyCode: USD
    units: "${BUDGET_AMOUNT}"
thresholdRules:
  - thresholdPercent: 0.5
    spendBasis: CURRENT_SPEND
  - thresholdPercent: 0.75
    spendBasis: CURRENT_SPEND
  - thresholdPercent: 0.9
    spendBasis: CURRENT_SPEND
  - thresholdPercent: 1.0
    spendBasis: CURRENT_SPEND
allUpdatesRule:
  pubsubTopic: projects/${PROJECT_ID}/topics/budget-alerts
  monitoringNotificationChannels:
    - projects/${PROJECT_ID}/notificationChannels/email
EOF

echo -e "${YELLOW}Creating Pub/Sub topic for budget alerts...${NC}"
gcloud pubsub topics create budget-alerts --project="${PROJECT_ID}" 2>/dev/null || true

echo -e "${YELLOW}Creating budget...${NC}"
gcloud billing budgets create \
  --billing-account="${BILLING_ACCOUNT}" \
  --budget-from-file=budget.yaml

echo -e "${GREEN}✓ Budget alerts configured${NC}"
echo ""

# Setup notification channel for email
echo -e "${YELLOW}Setting up email notification channel...${NC}"
echo ""
echo "To receive email alerts:"
echo "1. Go to: https://console.cloud.google.com/monitoring/alerting/notifications?project=${PROJECT_ID}"
echo "2. Click 'Add Notification Channel'"
echo "3. Select 'Email' and enter: ${ALERT_EMAIL}"
echo "4. Save the notification channel"
echo ""

# Create alert policy for high costs
echo -e "${YELLOW}Creating cost spike alert...${NC}"

cat > alert-policy.yaml <<EOF
displayName: "Daily Cost Spike Alert"
conditions:
  - displayName: "Daily cost exceeds \$10"
    conditionThreshold:
      filter: 'metric.type="billing.googleapis.com/cost/amount" resource.type="billing_account"'
      comparison: COMPARISON_GT
      thresholdValue: 10
      duration: 0s
      aggregations:
        - alignmentPeriod: 86400s
          perSeriesAligner: ALIGN_SUM
notificationChannels: []
alertStrategy:
  autoClose: 86400s
enabled: true
EOF

gcloud alpha monitoring policies create --policy-from-file=alert-policy.yaml --project="${PROJECT_ID}" || true

# Clean up
rm -f budget.yaml alert-policy.yaml

echo ""
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}Budget Alerts Setup Complete!${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""
echo "Alert thresholds:"
echo "  • 50% of \$${BUDGET_AMOUNT} = \$$(echo "${BUDGET_AMOUNT} * 0.5" | bc)"
echo "  • 75% of \$${BUDGET_AMOUNT} = \$$(echo "${BUDGET_AMOUNT} * 0.75" | bc)"
echo "  • 90% of \$${BUDGET_AMOUNT} = \$$(echo "${BUDGET_AMOUNT} * 0.9" | bc)"
echo "  • 100% of \$${BUDGET_AMOUNT} = \$${BUDGET_AMOUNT}"
echo ""
echo "Monitor costs: https://console.cloud.google.com/billing/reports?project=${PROJECT_ID}"
echo ""
