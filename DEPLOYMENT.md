# Deployment Guide for bristolpubcrawl.xyz

## Prerequisites
- Domain registered and DNS A records pointing to your Digital Ocean droplet IP
- Docker and docker-compose installed on your droplet
- SSH access to your droplet

## Deployment Steps

### Step 1: Verify DNS Configuration
Before deploying, ensure your domain is pointing to your droplet:

```bash
# From your local machine
nslookup bristolpubcrawl.xyz
# Should return your droplet's IP address
```

Wait 5-15 minutes for DNS propagation if you just updated the records.

### Step 2: Deploy Services
On your Digital Ocean droplet:

```bash
# Navigate to project directory
cd /path/to/crawl-planner

# Pull latest code
git pull origin main

# Build and start all services (osrm, app, nginx)
docker-compose up -d --build

# Verify services are running
docker-compose ps

# Check logs
docker-compose logs -f nginx
docker-compose logs -f app
docker-compose logs -f osrm
```

### Step 3: Obtain SSL Certificate
Once services are running and your domain is pointing to your server:

```bash
# SSH into your droplet and run:
cd /path/to/crawl-planner

# Execute the certificate setup script
docker-compose exec nginx bash /init-certbot.sh

# OR manually run certbot inside the nginx container:
docker-compose exec nginx certbot certonly \
    --webroot \
    -w /var/www/certbot \
    -d bristolpubcrawl.xyz \
    -d www.bristolpubcrawl.xyz \
    --agree-tos \
    --email webmaster@bristolpubcrawl.xyz
```

The script will:
- Validate your domain
- Generate an SSL certificate from Let's Encrypt
- Reload nginx with HTTPS enabled

### Step 4: Verify HTTPS
```bash
# Test your site
curl -I https://bristolpubcrawl.xyz
# Should return 200 OK

# Visit in browser
# https://bristolpubcrawl.xyz
# https://www.bristolpubcrawl.xyz
```

### Step 5: Configure Auto-Renewal (Recommended)
Set up automatic certificate renewal on your droplet:

```bash
# SSH into droplet
crontab -e

# Add this line to renew certificates daily at 3 AM:
0 3 * * * cd /path/to/crawl-planner && docker-compose exec -T nginx certbot renew --quiet && docker-compose exec -T nginx nginx -s reload
```

## Service Architecture

- **nginx** (Port 80, 443): Reverse proxy and static file server
  - Serves HTML, CSS, JS
  - Proxies API requests to FastAPI
  - Handles HTTPS with Let's Encrypt
  - Redirects HTTP → HTTPS

- **app** (Port 8000, internal): FastAPI application
  - REST API endpoints
  - Route planning logic
  - Pub data management

- **osrm** (Port 5005, internal): Open Source Routing Machine
  - Walking distance calculations
  - Route optimization
  - Distance matrix precomputation

## Troubleshooting

### Certificate won't obtain
```bash
# Check DNS is resolving
docker-compose exec nginx nslookup bristolpubcrawl.xyz

# Check certbot logs
docker-compose exec nginx certbot certificates

# Try again with verbose output
docker-compose exec nginx certbot certonly \
    --webroot \
    -w /var/www/certbot \
    -d bristolpubcrawl.xyz \
    -d www.bristolpubcrawl.xyz \
    -v
```

### nginx won't start
```bash
# Check nginx configuration
docker-compose exec nginx nginx -t

# View logs
docker-compose logs nginx

# Rebuild and restart
docker-compose up -d --build nginx
```

### App not responding
```bash
# Check app status
docker-compose logs app

# Restart app
docker-compose restart app

# Verify OSRM is running
docker-compose logs osrm
```

## Monitoring

```bash
# View all service logs
docker-compose logs -f

# Check certificate expiration
docker-compose exec nginx certbot certificates

# Monitor resource usage
docker stats

# Check disk space
df -h
```

## File Locations on Droplet

- **Project**: `/path/to/crawl-planner`
- **SSL Certificates**: `./letsencrypt/live/bristolpubcrawl.xyz/`
- **Data**: `./data.json`, `./pub_distances.pkl`
- **Logs**: `docker-compose logs [service-name]`

## Environment Variables

**For app service** (in docker-compose.yml):
- `OSRM_URL=http://osrm:5005` (internal routing to OSRM)

These are automatically set in docker-compose.yml. No manual configuration needed.

## Updating Code

To deploy code changes:

```bash
# Pull latest code
git pull origin main

# Rebuild and restart affected services
docker-compose up -d --build

# Or specific service
docker-compose up -d --build app
```

## Backup

To backup your data:

```bash
# Backup data files
cp data.json data.json.backup
cp pub_distances.pkl pub_distances.pkl.backup

# Backup SSL certificates (important!)
tar -czf letsencrypt-backup.tar.gz letsencrypt/
```

## Support

For issues with:
- **FastAPI**: Check `docker-compose logs app`
- **OSRM**: Check `docker-compose logs osrm`
- **nginx**: Check `docker-compose logs nginx`
- **SSL**: Check `docker-compose exec nginx certbot certificates`
