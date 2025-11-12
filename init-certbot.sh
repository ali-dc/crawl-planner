#!/bin/bash
# Script to initialize SSL certificates with Let's Encrypt for bristolpubcrawl.xyz

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

DOMAIN_NAME="bristolpubcrawl.xyz"
EMAIL="alexjohnchapman@gmail.com"

echo -e "${YELLOW}Setting up SSL certificate for: $DOMAIN_NAME${NC}"

# Reload nginx to apply changes
echo -e "${YELLOW}Reloading nginx...${NC}"
nginx -s reload || true

# Run certbot to get certificate
echo -e "${YELLOW}Running certbot to obtain certificate...${NC}"
certbot certonly \
  --webroot \
  -w /var/www/certbot \
  -d $DOMAIN_NAME \
  -d www.$DOMAIN_NAME \
  --non-interactive \
  --agree-tos \
  --email $EMAIL

if [ $? -eq 0 ]; then
  echo -e "${GREEN}SSL certificate obtained successfully!${NC}"
  echo -e "${GREEN}Certificate path: /etc/letsencrypt/live/$DOMAIN_NAME/${NC}"

  # Reload nginx with SSL config
  echo -e "${YELLOW}Reloading nginx with SSL configuration...${NC}"
  nginx -s reload

  echo -e "${GREEN}Setup complete! Your site is now accessible at https://$DOMAIN_NAME${NC}"
  echo -e "${GREEN}Certificate auto-renewal is enabled${NC}"
else
  echo -e "${RED}Error obtaining certificate. Please check your domain configuration.${NC}"
  echo -e "${YELLOW}Make sure your domain is pointing to this server's IP address.${NC}"
  echo -e "${YELLOW}You can test DNS with: nslookup $DOMAIN_NAME${NC}"
  exit 1
fi
