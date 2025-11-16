# Quick Deployment Setup for Bristol Pub Crawl

This is your personalized setup guide based on your configuration:
- **Hostname**: bristolpubcrawl.xyz
- **Project Path**: /root/crawl-planner-app
- **SSH User**: root
- **SSH Port**: 22 (default)

## GitHub Secrets to Add

Go to your GitHub repository → **Settings** → **Secrets and variables** → **Actions** and add these 5 secrets:

| Secret Name | Value | Notes |
|---|---|---|
| `DO_HOST` | `bristolpubcrawl.xyz` | Your droplet hostname |
| `DO_USER` | `root` | SSH username |
| `DO_PROJECT_PATH` | `/root/crawl-planner-app` | Full path to cloned repo |
| `DO_PRIVATE_KEY` | *Your private SSH key* | Paste entire contents of your SSH private key file |
| `DO_SSH_PORT` | `22` | (Optional - only if using non-default port) |

**`GITHUB_TOKEN`** is already provided automatically by GitHub Actions.

## Getting Your SSH Private Key

If you already have SSH access to your droplet:

```bash
# On your local machine, find your existing key
ls -la ~/.ssh/

# Display the private key (usually id_rsa or id_ed25519)
cat ~/.ssh/id_rsa
# OR
cat ~/.ssh/id_ed25519
```

Copy the entire output including `-----BEGIN` and `-----END` lines, and paste it as the `DO_PRIVATE_KEY` secret.

## Step-by-Step Setup

### 1. Ensure Your Droplet is Ready

```bash
# SSH into your droplet
ssh root@bristolpubcrawl.xyz

# Verify Docker is running
docker --version
docker-compose --version

# Navigate to project directory
cd /root/crawl-planner-app
git status

# Exit back to local machine
exit
```

### 2. Add GitHub Secrets

1. Go to https://github.com/YOUR_USERNAME/crawl-planner/settings/secrets/actions
2. Click **New repository secret**
3. Add each secret from the table above
4. Click **Add secret**

### 3. Verify SSH Access Works (Test Before First Deploy)

```bash
# On your local machine, test SSH with your private key
ssh -i ~/.ssh/id_rsa root@bristolpubcrawl.xyz "cd /root/crawl-planner-app && pwd"
```

If this works, your setup is correct!

### 4. Update docker-compose.yml on Droplet

Your `docker-compose.yml` on the droplet needs to use the correct image names. Update it to use:

```yaml
services:
  app:
    image: ghcr.io/YOUR_GITHUB_USERNAME/crawl-planner-app:latest
    # ... rest of config stays the same

  nginx:
    image: ghcr.io/YOUR_GITHUB_USERNAME/crawl-planner-nginx:latest
    # ... rest of config stays the same
```

Replace `YOUR_GITHUB_USERNAME` with your actual GitHub username.

## How Deployment Works

### Automatic (Recommended)

1. Make code changes locally
2. Commit and push to `main` branch
3. GitHub Actions automatically:
   - ✅ Builds Docker images
   - ✅ Pushes to GHCR
   - ✅ SSHs into your droplet
   - ✅ Pulls new images
   - ✅ Runs `docker-compose up -d`
4. Your site updates automatically

### Manual (On-Demand)

1. Go to your GitHub repo → **Actions**
2. Select **Deploy to Digital Ocean** workflow
3. Click **Run workflow** button
4. Deployment starts immediately

## Monitoring Your Deployment

### View Logs in GitHub

1. Go to **Actions** tab
2. Click the latest workflow run
3. Click **Deploy to Digital Ocean** job
4. Scroll through the output

### Check Status on Droplet

```bash
ssh root@bristolpubcrawl.xyz

# View container status
docker-compose -f /root/crawl-planner-app/docker-compose.yml ps

# View app logs
docker-compose -f /root/crawl-planner-app/docker-compose.yml logs -f app

# View nginx logs
docker-compose -f /root/crawl-planner-app/docker-compose.yml logs -f nginx
```

## Troubleshooting

### SSH Key Issues

```bash
# Test SSH login
ssh -v root@bristolpubcrawl.xyz

# If permission denied:
# 1. Check public key is in /root/.ssh/authorized_keys on droplet
# 2. Verify DO_PRIVATE_KEY secret is exactly correct (including BEGIN/END lines)
# 3. Ensure file permissions: chmod 600 ~/.ssh/authorized_keys
```

### Image Pull Failures

```bash
# On your droplet, test GHCR login
docker login ghcr.io
# Use your GitHub username and personal access token (if private repo)

# Then test pull
docker pull ghcr.io/YOUR_USERNAME/crawl-planner-app:latest
```

### Services Not Starting

```bash
# On droplet, check full logs
docker-compose logs

# Verify environment variables
docker-compose config

# Restart manually
docker-compose down
docker-compose up -d
```

## Next Steps

1. ✅ Add all 5 secrets to GitHub (DO_HOST, DO_USER, DO_PROJECT_PATH, DO_PRIVATE_KEY, DO_SSH_PORT)
2. ✅ Test SSH access: `ssh root@bristolpubcrawl.xyz`
3. ✅ Update docker-compose.yml with correct image names
4. ✅ Make a test commit and push to main
5. ✅ Watch deployment in GitHub Actions

Your deployment is ready to go! 🚀

---

For more detailed information, see `DEPLOYMENT.md` in the repository.
