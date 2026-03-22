#!/bin/sh
# Custom entrypoint for Nginx with certificate auto-renewal

# Start cron daemon in the background
crond

# Execute the original nginx entrypoint
exec /docker-entrypoint.sh "$@"
