# GitHub Actions Workflows

This directory contains the GitHub Actions workflows that automate building and deploying your pub crawl planner application.

## Available Workflows

### 1. Build and Push Docker Images (`build-push-docker.yml`)

**Purpose**: Builds Docker images and pushes them to GitHub Container Registry (GHCR)

**Triggers**:
- Push to `main` or `develop` branches with changes to:
  - `Dockerfile`, `Dockerfile.nginx`, `Dockerfile.osrm-builder`
  - `backend/**` files
  - `nginx/**` files
  - `nginx.conf`, `nginx-https.conf`
  - `docker-compose.yml`
  - This workflow file itself
- Manual trigger via **Run workflow** button

**What it does**:
- Builds three Docker images: `app`, `nginx`, `osrm-builder`
- Pushes to `ghcr.io/YOUR_USERNAME/crawl-planner-{name}:tag`
- Uses layer caching for faster rebuilds
- Automatically tags images with:
  - Branch name (e.g., `main`, `develop`)
  - Semantic version tags (if using git tags)
  - Commit SHA
  - `latest` tag

**Output**:
- Container images in GitHub Container Registry
- Accessible at: `https://ghcr.io/YOUR_USERNAME/crawl-planner-app:latest`

### 2. Deploy to Digital Ocean (`deploy.yml`)

**Purpose**: Automatically deploys containers to your Digital Ocean droplet

**Triggers**:
- Automatically when "Build and Push Docker Images" workflow succeeds on `main` branch
- Manual trigger via **Run workflow** button (independent of build)

**Prerequisites**:
- GitHub repository secrets configured:
  - `DO_HOST`: Your droplet hostname (bristolpubcrawl.xyz)
  - `DO_USER`: SSH username (root)
  - `DO_PROJECT_PATH`: Path to cloned repo (/root/crawl-planner-app)
  - `DO_PRIVATE_KEY`: Your SSH private key
  - `DO_SSH_PORT`: SSH port (optional, defaults to 22)

**What it does**:
1. SSHs into your Digital Ocean droplet
2. Pulls latest code from `main` branch
3. Authenticates with GitHub Container Registry
4. Pulls latest Docker images
5. Restarts services with `docker-compose up -d`
6. Verifies services are running
7. Cleans up unused images

**Deployment time**: ~2-3 minutes depending on image size

## Setting Up Secrets

To enable the Deploy workflow, add these secrets to your GitHub repository:

**Steps**:
1. Go to your repo → **Settings** → **Secrets and variables** → **Actions**
2. Click **New repository secret** for each:

| Secret | Value |
|--------|-------|
| `DO_HOST` | `bristolpubcrawl.xyz` |
| `DO_USER` | `root` |
| `DO_PROJECT_PATH` | `/root/crawl-planner-app` |
| `DO_PRIVATE_KEY` | Contents of your SSH private key |
| `DO_SSH_PORT` | `22` (optional) |

## Workflow Diagram

```
Code Push to main
      ↓
Build Docker Images (build-push-docker.yml)
      ├─ Build app image
      ├─ Build nginx image
      ├─ Build osrm-builder image
      └─ Push to GHCR
            ↓
       [On Success]
            ↓
Deploy to Digital Ocean (deploy.yml)
      ├─ SSH into droplet
      ├─ Pull latest code
      ├─ Pull Docker images
      ├─ Restart services
      └─ Verify deployment
```

## Monitoring Workflows

### View Logs in GitHub

1. Go to your repository
2. Click **Actions** tab
3. Click the workflow run you want to inspect
4. Click the job name to expand logs
5. Scroll through output

### Helpful Status Indicators

- ✅ Green checkmark: Workflow succeeded
- ❌ Red X: Workflow failed
- ⏳ Yellow dot: Workflow running
- ⊘ Skipped: Workflow was skipped (conditions not met)

## Troubleshooting

### Build Workflow Issues

**Image build fails**:
- Check Dockerfile syntax: `docker build .`
- Review logs in Actions tab for specific errors
- Ensure all `COPY` instructions reference files that exist

**Push to GHCR fails**:
- Verify `GITHUB_TOKEN` secret is available (automatic in GitHub Actions)
- For private images, ensure you're using a valid PAT

### Deploy Workflow Issues

**SSH connection fails**:
- Verify SSH key in `DO_PRIVATE_KEY` secret is exact copy of private key
- Test manually: `ssh -i ~/.ssh/id_rsa root@bristolpubcrawl.xyz`
- Check that public key is in `/root/.ssh/authorized_keys` on droplet

**Image pull fails**:
- Verify image names in `docker-compose.yml` match built images
- Check GHCR login: `docker login ghcr.io`
- Ensure public key is in authorized_keys

**Services not starting**:
- SSH to droplet and check logs: `docker-compose logs`
- Verify environment variables: `docker-compose config`
- Check OSRM data exists: `ls -la osrm-data/`

## Manual Deployment

To deploy without code changes:

1. Go to **Actions** tab
2. Click **Deploy to Digital Ocean**
3. Click **Run workflow**
4. Select branch (defaults to main)
5. Click **Run workflow** button

## Rollback

If deployment causes issues:

**Option 1: Rollback using Git**
```bash
# On your droplet
cd /root/crawl-planner-app
git checkout <previous-commit-hash>
docker-compose pull
docker-compose down
docker-compose up -d
```

**Option 2: Redeploy Previous Commit**
1. In GitHub, find the Actions workflow for the previous commit
2. Click **Deploy to Digital Ocean** in that run (if manual deploy option available)
3. Or manually trigger deploy with previous image tags

## Performance Tips

1. **Layer Caching**: Workflows use registry cache for faster rebuilds. Reorganize Dockerfile to put frequently-changing files last.
2. **Parallel Builds**: The build workflow builds all three images in parallel.
3. **Scheduled Deployments**: Add scheduled workflow runs for off-peak hours if needed.

## Security Notes

- Never commit `DO_PRIVATE_KEY` to git
- Use deploy-specific SSH keys when possible
- Rotate keys periodically
- Keep GitHub Actions updated (`@v4`, `@v3`, etc. latest versions)
- Review workflow logs for sensitive information exposure

## Related Documentation

- See `DEPLOYMENT_SETUP.md` for your personalized setup guide
- See `DEPLOYMENT.md` for comprehensive deployment documentation
- See `CLAUDE.md` for project architecture and design notes

---

For questions or issues with workflows, check the [GitHub Actions documentation](https://docs.github.com/en/actions).
