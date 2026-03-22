#!/bin/sh
# Certificate renewal script for Let's Encrypt
# This script should be run periodically via cron

# Attempt to renew certificates
certbot renew --quiet --deploy-hook "nginx -s reload"

# Log the renewal attempt
echo "Certificate renewal check completed at $(date)" >> /var/log/certbot-renew.log
