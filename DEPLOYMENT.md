# GitHub Actions Deployment to Digital Ocean

This document explains how to set up continuous deployment of your pub crawl planner to your Digital Ocean droplet using GitHub Actions.

## Architecture

The deployment workflow consists of two parts:

1. **Build Workflow** (`build-push-docker.yml`): Builds and pushes Docker images to GitHub Container Registry (GHCR)
2. **Deploy Workflow** (`deploy.yml`): Pulls new images on your Digital Ocean droplet and restarts services

## Prerequisites

Before setting up deployment, ensure you have:

- A Digital Ocean droplet with Docker and Docker Compose installed
- SSH access to your droplet with a private key
- A GitHub repository with this code
- Git repository cloned on your Digital Ocean droplet

## Setup Instructions

### Step 1: Prepare Your Digital Ocean Droplet

SSH into your droplet and clone the repository:

```bash
# Connect to your droplet
ssh root@YOUR_DROPLET_IP

# Clone the repository
git clone https://github.com/YOUR_USERNAME/crawl-planner.git /path/to/crawl-planner
cd /path/to/crawl-planner

# Ensure Docker is running
systemctl status docker

# Test docker-compose
docker-compose --version
```

### Step 2: Generate SSH Key (if you don't have one)

If you don't already have an SSH key for deployment, generate one:

**On your local machine:**

```bash
# Generate a new SSH key
ssh-keygen -t ed25519 -f ~/.ssh/do_deploy -C "deployment@crawl-planner"

# Display the private key (you'll need this for GitHub)
cat ~/.ssh/do_deploy

# Display the public key (you'll need this for the droplet)
cat ~/.ssh/do_deploy.pub
```

**On your Digital Ocean droplet:**

```bash
# Add the public key to authorized_keys
mkdir -p ~/.ssh
echo "YOUR_PUBLIC_KEY_CONTENT" >> ~/.ssh/authorized_keys
chmod 600 ~/.ssh/authorized_keys
chmod 700 ~/.ssh

# Test that key-based login works
# From your local machine: ssh -i ~/.ssh/do_deploy root@YOUR_DROPLET_IP
```

### Step 3: Configure GitHub Repository Secrets

Go to your GitHub repository settings and add these secrets:

1. **`DO_HOST`** (Required)
   - Value: Your droplet's IP address or hostname
   - Example: `192.168.1.100` or `crawl-planner.example.com`

2. **`DO_USER`** (Required)
   - Value: SSH username (usually `root` or your deploy user)
   - Example: `root`

3. **`DO_PRIVATE_KEY`** (Required)
   - Value: The entire contents of your private SSH key file
   - How to get it:
     ```bash
     cat ~/.ssh/do_deploy
     ```
   - Include the `-----BEGIN OPENSSH PRIVATE KEY-----` and `-----END OPENSSH PRIVATE KEY-----` lines

4. **`DO_SSH_PORT`** (Optional)
   - Value: SSH port if not using default 22
   - Default: `22`
   - Example: `2222`

5. **`DO_PROJECT_PATH`** (Required)
   - Value: Full path where you cloned the repository on your droplet
   - Example: `/root/crawl-planner` or `/opt/crawl-planner`

6. **`GITHUB_TOKEN`** (Already configured by GitHub)
   - This is automatically provided by GitHub Actions
   - Used to authenticate with GitHub Container Registry

**How to add secrets in GitHub:**

1. Go to your repository on GitHub
2. Navigate to **Settings** → **Secrets and variables** → **Actions**
3. Click **New repository secret**
4. Add each secret with the name and value from above
5. Click **Add secret**

### Step 4: Verify Docker Image Names

The deployment workflow expects images to be pushed to GHCR with specific names. Verify your image names match:

From `build-push-docker.yml`:
```yaml
images: ${{ env.REGISTRY }}/${{ github.repository }}-${{ matrix.name }}
```

This creates images like:
- `ghcr.io/YOUR_USERNAME/crawl-planner-app:latest`
- `ghcr.io/YOUR_USERNAME/crawl-planner-nginx:latest`
- `ghcr.io/YOUR_USERNAME/crawl-planner-osrm-builder:latest`

If needed, update your `docker-compose.yml` on the droplet to use these image names:

```yaml
services:
  app:
    image: ghcr.io/YOUR_USERNAME/crawl-planner-app:latest
    # ... rest of config

  nginx:
    image: ghcr.io/YOUR_USERNAME/crawl-planner-nginx:latest
    # ... rest of config
```

## Deployment Flow

### Automatic Deployment (Recommended)

1. **Create a commit** with changes to:
   - `backend/**` - Python application code
   - `Dockerfile*` - Docker configurations
   - `docker-compose.yml` - Service definitions
   - `.github/workflows/` - Workflow files

2. **Push to main branch** - GitHub Actions automatically:
   - Builds the Docker images
   - Pushes to GHCR
   - Triggers the deploy workflow (waits for build to succeed)
   - SSHs into your droplet
   - Pulls new images
   - Restarts services with `docker-compose up -d`

3. **Verify deployment** - Check your application at `http://YOUR_DROPLET_IP`

### Manual Deployment (On-Demand)

If you want to deploy without code changes:

1. Go to your GitHub repository
2. Click **Actions**
3. Select **Deploy to Digital Ocean** workflow
4. Click **Run workflow** → **Run workflow**
5. The deployment starts immediately

## Monitoring Deployments

### In GitHub

1. Go to your repository **Actions** tab
2. Click on the latest workflow run
3. View logs for each step

### On Your Droplet

```bash
# View container status
docker-compose ps

# View app logs
docker-compose logs -f app

# View nginx logs
docker-compose logs -f nginx

# View all logs
docker-compose logs -f
```

## Troubleshooting

### Deployment fails with "Permission denied"

- Verify the private key is correctly copied to `DO_PRIVATE_KEY` secret
- Ensure public key is in `~/.ssh/authorized_keys` on the droplet
- Test SSH manually: `ssh -i ~/.ssh/do_deploy root@YOUR_DROPLET_IP`

### Images not found after deployment

- Ensure `GITHUB_TOKEN` is provided (it's automatic in GitHub Actions)
- Verify image names in `docker-compose.yml` match the built images
- Check that your repository is public or you're using a PAT with `packages:read` scope

### "docker-compose: command not found"

- Install Docker Compose on your droplet:
  ```bash
  curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
  chmod +x /usr/local/bin/docker-compose
  ```

### Services not starting after deployment

- Check health of services: `docker-compose ps`
- View logs: `docker-compose logs`
- Verify environment variables in `docker-compose.yml`
- Ensure OSRM data is available in `./osrm-data/`

## Rollback Procedures

If deployment introduces issues:

### Option 1: Manual Rollback (Droplet)

```bash
cd /path/to/crawl-planner

# Pull and checkout previous commit
git checkout <previous-commit-hash>

# Redeploy
docker-compose pull
docker-compose down
docker-compose up -d
```

### Option 2: GitHub Actions Rollback

1. Go to **Actions** → **Build and Push Docker Images**
2. Find the workflow run for the previous good commit
3. The images are still in GHCR with commit-specific tags
4. Manually trigger the deploy workflow with those older image tags

## Security Considerations

1. **Private Keys**: Keep `DO_PRIVATE_KEY` secret; never commit it to git
2. **Repository Access**: If using private repos, ensure the deploy key has appropriate permissions
3. **SSH Access**: Consider using SSH keys with restricted command execution for extra security
4. **GHCR Authentication**: The workflow uses `${{ secrets.GITHUB_TOKEN }}` which is scoped to the current run

## Advanced: Custom Deployment Script

For more complex deployments, you can replace the inline deployment script with a separate bash script:

1. Create `deploy.sh` in your repository:
   ```bash
   #!/bin/bash
   set -e
   cd $1
   git fetch origin
   git checkout origin/main
   docker-compose pull
   docker-compose down
   docker-compose up -d
   ```

2. Modify `.github/workflows/deploy.yml` to execute the script:
   ```yaml
   script: |
     bash /path/to/crawl-planner/deploy.sh ${{ secrets.DO_PROJECT_PATH }}
   ```

## Additional Resources

- [GitHub Actions Documentation](https://docs.github.com/en/actions)
- [Docker Compose Documentation](https://docs.docker.com/compose/)
- [Digital Ocean SSH Setup](https://docs.digitalocean.com/products/droplets/how-to/add-ssh-keys/)
- [GitHub Container Registry](https://docs.github.com/en/packages/working-with-a-github-packages-registry/working-with-the-container-registry)
