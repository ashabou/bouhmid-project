#!/bin/bash
# Setup GCP Secret Manager for Bouhmid MVP
# Usage: ./setup-secrets.sh

set -e

PROJECT_ID="bouhmid-mvp"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}Setting up GCP Secret Manager${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""

# Check if .env.production exists
if [ ! -f .env.production ]; then
    echo -e "${RED}Error: .env.production not found${NC}"
    echo "Copy .env.production.template to .env.production and fill in values"
    exit 1
fi

# Load environment variables
export $(cat .env.production | grep -v '^#' | xargs)

# Set project
gcloud config set project "${PROJECT_ID}"

# Function to create or update secret
create_or_update_secret() {
    local SECRET_NAME=$1
    local SECRET_VALUE=$2

    if [ -z "${SECRET_VALUE}" ]; then
        echo -e "${YELLOW}⊘ Skipping ${SECRET_NAME} (empty value)${NC}"
        return
    fi

    if gcloud secrets describe "${SECRET_NAME}" &> /dev/null; then
        echo -e "${YELLOW}Updating secret: ${SECRET_NAME}${NC}"
        echo -n "${SECRET_VALUE}" | gcloud secrets versions add "${SECRET_NAME}" --data-file=-
    else
        echo -e "${YELLOW}Creating secret: ${SECRET_NAME}${NC}"
        echo -n "${SECRET_VALUE}" | gcloud secrets create "${SECRET_NAME}" --data-file=-
    fi

    echo -e "${GREEN}✓ ${SECRET_NAME} configured${NC}"
}

# Create required secrets
echo -e "${YELLOW}Creating/updating secrets...${NC}"
echo ""

create_or_update_secret "DATABASE_URL" "${DATABASE_URL}"
create_or_update_secret "JWT_SECRET" "${JWT_SECRET}"
create_or_update_secret "JWT_REFRESH_SECRET" "${JWT_REFRESH_SECRET}"

# Optional secrets
if [ ! -z "${SENTRY_DSN}" ]; then
    create_or_update_secret "SENTRY_DSN" "${SENTRY_DSN}"
fi

if [ ! -z "${SMTP_APP_PASSWORD}" ]; then
    create_or_update_secret "SMTP_APP_PASSWORD" "${SMTP_APP_PASSWORD}"
fi

# Grant Cloud Run access to secrets
echo ""
echo -e "${YELLOW}Granting Cloud Run access to secrets...${NC}"

# Get project number
PROJECT_NUMBER=$(gcloud projects describe "${PROJECT_ID}" --format="value(projectNumber)")
SERVICE_ACCOUNT="${PROJECT_NUMBER}-compute@developer.gserviceaccount.com"

for SECRET in "DATABASE_URL" "JWT_SECRET" "JWT_REFRESH_SECRET"; do
    gcloud secrets add-iam-policy-binding "${SECRET}" \
        --member="serviceAccount:${SERVICE_ACCOUNT}" \
        --role="roles/secretmanager.secretAccessor" \
        --quiet &> /dev/null
    echo -e "${GREEN}✓ ${SECRET} accessible by Cloud Run${NC}"
done

echo ""
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}Secret Manager Setup Complete!${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""
echo "Secrets created:"
gcloud secrets list --format="table(name,createTime)"
echo ""
