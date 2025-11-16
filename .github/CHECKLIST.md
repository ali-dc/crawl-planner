# Deployment Setup Checklist

Use this checklist to ensure your GitHub Actions deployment is properly configured.

## ✅ Phase 1: Prepare Your Droplet

- [ ] SSH into your Digital Ocean droplet
- [ ] Verify Docker is installed: `docker --version`
- [ ] Verify Docker Compose is installed: `docker-compose --version`
- [ ] Navigate to `/root/crawl-planner-app` directory
- [ ] Verify git is initialized: `git status`
- [ ] Test connectivity: `curl http://localhost:8000/health` (if app running)

**Troubleshooting**:
- If Docker not found: Install from https://docs.docker.com/engine/install/
- If Docker Compose not found: `curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose && chmod +x /usr/local/bin/docker-compose`

## ✅ Phase 2: SSH Key Setup

- [ ] Check if you have an existing SSH key locally: `ls -la ~/.ssh/id_*`
- [ ] If no key, generate one: `ssh-keygen -t ed25519 -f ~/.ssh/do_deploy -C "deployment@crawl-planner"`
- [ ] Display public key: `cat ~/.ssh/do_deploy.pub`
- [ ] Add to droplet: `ssh root@bristolpubcrawl.xyz` then `echo "YOUR_PUBLIC_KEY" >> ~/.ssh/authorized_keys`
- [ ] Set permissions on droplet: `chmod 600 ~/.ssh/authorized_keys && chmod 700 ~/.ssh`
- [ ] Test SSH: `ssh -i ~/.ssh/id_rsa root@bristolpubcrawl.xyz "pwd"`

**Should see**: `/root` (successful login)

## ✅ Phase 3: Add GitHub Secrets

Go to: https://github.com/YOUR_USERNAME/crawl-planner/settings/secrets/actions

- [ ] Click **New repository secret** for each:

| Name | Value | Example |
|------|-------|---------|
| `DO_HOST` | Your droplet hostname | `bristolpubcrawl.xyz` |
| `DO_USER` | SSH username | `root` |
| `DO_PROJECT_PATH` | Full path on droplet | `/root/crawl-planner-app` |
| `DO_PRIVATE_KEY` | Private key contents | `-----BEGIN OPENSSH PRIVATE KEY-----...` |
| `DO_SSH_PORT` | SSH port (optional) | `22` |

**Getting your private key**:
```bash
cat ~/.ssh/id_rsa    # or ~/.ssh/id_ed25519 or ~/.ssh/do_deploy
```

Copy the entire output including `-----BEGIN` and `-----END` lines.

## ✅ Phase 4: Update Docker Compose

On your droplet, edit `/root/crawl-planner-app/docker-compose.yml`:

Replace image names in the `app` service:
```yaml
app:
  image: ghcr.io/YOUR_GITHUB_USERNAME/crawl-planner-app:latest
  # ... rest stays the same
```

Replace image names in the `nginx` service:
```yaml
nginx:
  image: ghcr.io/YOUR_GITHUB_USERNAME/crawl-planner-nginx:latest
  # ... rest stays the same
```

**Replace `YOUR_GITHUB_USERNAME` with your actual GitHub username.**

## ✅ Phase 5: Verify Everything Works

### Test SSH Access Locally
```bash
ssh root@bristolpubcrawl.xyz "cd /root/crawl-planner-app && pwd"
```
Should output: `/root/crawl-planner-app`

### Test Docker on Droplet
```bash
ssh root@bristolpubcrawl.xyz
docker-compose -f /root/crawl-planner-app/docker-compose.yml ps
exit
```

### Check GitHub Secrets Added
```bash
# On GitHub, click the workflow file and hover over secrets - should see masked values
```

## ✅ Phase 6: Test Deployment

### Option A: Automatic Test (Recommended)
1. Make a small code change locally
2. Commit and push to main: `git add . && git commit -m "Test deployment" && git push`
3. Watch in GitHub: https://github.com/YOUR_USERNAME/crawl-planner/actions
4. Should see:
   - ✅ Build Docker Images (2-3 min)
   - ✅ Deploy to Digital Ocean (2-3 min)

### Option B: Manual Test
1. Go to https://github.com/YOUR_USERNAME/crawl-planner/actions
2. Click **Deploy to Digital Ocean**
3. Click **Run workflow**
4. Watch the deployment logs

### Verify Deployment Succeeded
```bash
# Check logs on droplet
ssh root@bristolpubcrawl.xyz "docker-compose -f /root/crawl-planner-app/docker-compose.yml ps"

# Should see containers running (healthy status)
```

## ⚠️ Common Issues & Fixes

### "Permission denied" in deployment logs
- Verify SSH key is correct in `DO_PRIVATE_KEY` secret
- Test manually: `ssh -i ~/.ssh/id_rsa root@bristolpubcrawl.xyz`

### "Image not found" errors
- Verify `YOUR_GITHUB_USERNAME` is correct in docker-compose.yml
- Check image names match build output: `ghcr.io/YOUR_USERNAME/crawl-planner-app:latest`

### Workflow doesn't trigger on push
- Verify `.github/workflows/deploy.yml` exists
- Check that changes are to monitored paths (backend/**, Dockerfile, docker-compose.yml)
- Push to `main` branch (not develop)

### Docker Compose not found on droplet
- SSH in and install: See Phase 1 troubleshooting

### Services not starting after deploy
- Check droplet: `docker-compose logs`
- Verify OSRM data: `ls /root/crawl-planner-app/osrm-data/`
- Check environment variables: `docker-compose config | grep OSRM`

## ✅ Final Verification

- [ ] GitHub Actions build succeeds
- [ ] GitHub Actions deploy succeeds  
- [ ] Application is accessible at https://bristolpubcrawl.xyz
- [ ] Check app health: `curl https://bristolpubcrawl.xyz/health`
- [ ] All containers running: `docker-compose ps` (on droplet)

## 🎉 You're Done!

Your deployment pipeline is ready. From now on:

1. Make code changes locally
2. Commit and push to main
3. GitHub Actions automatically builds and deploys
4. Changes live in 5-7 minutes

---

**Need help?** See `DEPLOYMENT_SETUP.md` or `DEPLOYMENT.md` in the repo root.
