#!/bin/bash
# ========================================
# SSL/TLS Certificate Setup Script
# Setup Let's Encrypt SSL certificates for Shabou Auto Pièces
# ========================================

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
DOMAIN="${DOMAIN:-shabouautopieces.tn}"
EMAIL="${SSL_EMAIL:-admin@shabouautopieces.tn}"
STAGING="${STAGING:-false}"

echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}SSL/TLS Certificate Setup${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""
echo "Domain: $DOMAIN"
echo "Email: $EMAIL"
echo "Staging: $STAGING"
echo ""

# Check if running as root
if [ "$EUID" -ne 0 ]; then
  echo -e "${RED}Error: This script must be run as root${NC}"
  exit 1
fi

# Function to check if a command exists
command_exists() {
  command -v "$1" >/dev/null 2>&1
}

# Install certbot if not already installed
install_certbot() {
  echo -e "${YELLOW}Checking for certbot...${NC}"

  if command_exists certbot; then
    echo -e "${GREEN}✓ certbot is already installed${NC}"
    certbot --version
  else
    echo -e "${YELLOW}Installing certbot...${NC}"

    # Detect OS and install accordingly
    if [ -f /etc/debian_version ]; then
      # Debian/Ubuntu
      apt-get update
      apt-get install -y certbot python3-certbot-nginx
    elif [ -f /etc/redhat-release ]; then
      # RHEL/CentOS
      yum install -y epel-release
      yum install -y certbot python3-certbot-nginx
    else
      echo -e "${RED}Error: Unsupported OS. Please install certbot manually.${NC}"
      exit 1
    fi

    echo -e "${GREEN}✓ certbot installed successfully${NC}"
  fi
}

# Obtain SSL certificate
obtain_certificate() {
  echo ""
  echo -e "${YELLOW}Obtaining SSL certificate...${NC}"

  local CERTBOT_ARGS=(
    --nginx
    --non-interactive
    --agree-tos
    --email "$EMAIL"
    --domains "$DOMAIN"
    --domains "www.$DOMAIN"
    --domains "api.$DOMAIN"
    --domains "staging.$DOMAIN"
    --domains "staging-api.$DOMAIN"
  )

  # Use staging server for testing
  if [ "$STAGING" = "true" ]; then
    echo -e "${YELLOW}Using Let's Encrypt staging server (test mode)${NC}"
    CERTBOT_ARGS+=(--staging)
  fi

  # Obtain certificate
  if certbot certonly "${CERTBOT_ARGS[@]}"; then
    echo -e "${GREEN}✓ SSL certificate obtained successfully${NC}"
  else
    echo -e "${RED}✗ Failed to obtain SSL certificate${NC}"
    exit 1
  fi
}

# Setup auto-renewal
setup_renewal() {
  echo ""
  echo -e "${YELLOW}Setting up automatic certificate renewal...${NC}"

  # Create renewal cron job
  CRON_JOB="0 0,12 * * * root certbot renew --quiet --post-hook 'systemctl reload nginx'"

  if ! grep -q "certbot renew" /etc/crontab 2>/dev/null; then
    echo "$CRON_JOB" >> /etc/crontab
    echo -e "${GREEN}✓ Auto-renewal cron job created${NC}"
  else
    echo -e "${GREEN}✓ Auto-renewal cron job already exists${NC}"
  fi

  # Test renewal (dry run)
  echo -e "${YELLOW}Testing certificate renewal (dry run)...${NC}"
  if certbot renew --dry-run; then
    echo -e "${GREEN}✓ Certificate renewal test successful${NC}"
  else
    echo -e "${YELLOW}⚠ Certificate renewal test failed (this is okay for initial setup)${NC}"
  fi
}

# Display certificate information
show_certificate_info() {
  echo ""
  echo -e "${GREEN}========================================${NC}"
  echo -e "${GREEN}Certificate Information${NC}"
  echo -e "${GREEN}========================================${NC}"

  certbot certificates

  echo ""
  echo -e "${GREEN}Certificate locations:${NC}"
  echo "  Certificate: /etc/letsencrypt/live/$DOMAIN/fullchain.pem"
  echo "  Private Key: /etc/letsencrypt/live/$DOMAIN/privkey.pem"
  echo "  Chain: /etc/letsencrypt/live/$DOMAIN/chain.pem"
  echo ""
}

# Main execution
main() {
  install_certbot
  obtain_certificate
  setup_renewal
  show_certificate_info

  echo ""
  echo -e "${GREEN}========================================${NC}"
  echo -e "${GREEN}SSL Setup Complete!${NC}"
  echo -e "${GREEN}========================================${NC}"
  echo ""
  echo "Next steps:"
  echo "1. Update Nginx configuration to use the SSL certificates"
  echo "2. Test the configuration: nginx -t"
  echo "3. Reload Nginx: systemctl reload nginx"
  echo "4. Verify HTTPS access: https://$DOMAIN"
  echo ""
  echo "Certificate will auto-renew via cron job"
  echo ""
}

# Run main function
main
