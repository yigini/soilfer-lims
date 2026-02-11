# 📦 SoilFER-LIMS — Installation Guide

Complete installation guide for deploying SoilFER-LIMS on any server.

---

## System Requirements

| Component | Minimum | Recommended |
|-----------|---------|-------------|
| **Node.js** | v18+ | v20 LTS |
| **RAM** | 512 MB | 1 GB+ |
| **Disk** | 500 MB | 2 GB+ (for spectral data) |
| **OS** | Any (Linux, Windows, macOS) | Ubuntu 22.04+ / Debian 12+ |

> **Docker deployment** only requires Docker Engine 20+ and Docker Compose v2.

---

## Table of Contents

1. [Docker Deploy (Recommended)](#1-docker-deploy-recommended)
2. [Manual Deploy — Linux](#2-manual-deploy--linux)
3. [Manual Deploy — Windows](#3-manual-deploy--windows)
4. [Reverse Proxy & SSL](#4-reverse-proxy--ssl)
5. [Process Management (PM2)](#5-process-management-pm2)
6. [Backup & Restore](#6-backup--restore)
7. [Updating](#7-updating)
8. [Troubleshooting](#8-troubleshooting)

---

## 1. Docker Deploy (Recommended)

The fastest way to get running. Works on any OS with Docker.

### Prerequisites

- [Docker Engine](https://docs.docker.com/engine/install/) 20+
- [Docker Compose](https://docs.docker.com/compose/install/) v2+

### Steps

```bash
# 1. Clone the repository
git clone https://github.com/yigini/soilfer-lims.git
cd soilfer-lims

# 2. Create your environment file
cp .env.example .env

# 3. Generate a secure JWT secret
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
# Copy the output and paste it as JWT_SECRET in .env

# 4. Set your deployment mode in .env
#    DEPLOYMENT_MODE=local   (single laboratory — default)
#    DEPLOYMENT_MODE=global  (multi-laboratory network)
```

### Start — Local Mode

```bash
docker compose up -d
```

### Start — Global Mode (with NGINX)

```bash
docker compose -f docker-compose.yml -f docker-compose.global.yml up -d
```

### Verify

```bash
# Check container health
docker ps

# Check API
curl http://localhost:3000/api/health

# View logs
docker logs soilfer-lims -f
```

Open **http://localhost:3000** and log in with `admin` / `password`.

---

## 2. Manual Deploy — Linux

### Prerequisites

```bash
# Ubuntu/Debian
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

# Verify
node -v   # Should show v20.x
npm -v    # Should show 10.x+
```

### Install

```bash
# Clone
git clone https://github.com/yigini/soilfer-lims.git
cd soilfer-lims

# Run setup (choose mode)
chmod +x setup.sh
./setup.sh          # Local mode (default)
# OR
./setup.sh global   # Global mode

# Start
cd server && node index.js
```

### Run as a Service (systemd)

```bash
sudo tee /etc/systemd/system/soilfer-lims.service <<EOF
[Unit]
Description=SoilFER-LIMS
After=network.target

[Service]
Type=simple
User=www-data
WorkingDirectory=/opt/soilfer-lims/server
ExecStart=/usr/bin/node index.js
Restart=on-failure
RestartSec=10
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
EOF

sudo systemctl daemon-reload
sudo systemctl enable soilfer-lims
sudo systemctl start soilfer-lims
```

---

## 3. Manual Deploy — Windows

### Prerequisites

1. Download and install [Node.js 20 LTS](https://nodejs.org/)
2. Open **PowerShell** as Administrator

### Install

```powershell
# Clone
git clone https://github.com/yigini/soilfer-lims.git
cd soilfer-lims

# Install server dependencies
cd server
npm install
npx prisma generate
npx prisma db push --skip-generate
cd ..

# Install and build client
cd client
npm install
npm run build
cd ..

# Create environment file
copy .env.example .env
# Edit .env with notepad: notepad .env
# Set JWT_SECRET to a long random string
# Set DEPLOYMENT_MODE to 'local' or 'global'

# Seed the database
cd server
node seed.js
cd ..

# Start
cd server
node index.js
```

Open **http://localhost:3000** in your browser.

---

## 4. Reverse Proxy & SSL

### NGINX (included in Global mode Docker)

If deploying manually, install NGINX and use the provided config:

```bash
sudo cp deploy/nginx.conf /etc/nginx/sites-available/soilfer-lims
sudo ln -s /etc/nginx/sites-available/soilfer-lims /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
```

Edit the file to set your domain name in `server_name`.

### SSL with Let's Encrypt

```bash
# Install certbot
sudo apt install certbot python3-certbot-nginx

# Obtain certificate
sudo certbot --nginx -d your-domain.com

# Auto-renewal is configured automatically
sudo certbot renew --dry-run
```

After obtaining the certificate, uncomment the HTTPS block in `deploy/nginx.conf` and update the domain.

---

## 5. Process Management (PM2)

For production manual deployments, use PM2 to keep the server running:

```bash
# Install PM2
npm install -g pm2

# Start LIMS
cd /opt/soilfer-lims/server
pm2 start index.js --name soilfer-lims

# Auto-start on boot
pm2 startup
pm2 save

# Useful commands
pm2 status
pm2 logs soilfer-lims
pm2 restart soilfer-lims
```

---

## 6. Backup & Restore

LIMS uses SQLite — backups are simple file copies.

### Manual Backup

```bash
# Create backup directory
mkdir -p backups

# Backup database
cp server/prisma/dev.db backups/lims-$(date +%Y%m%d-%H%M).db

# Backup uploads (if any)
tar -czf backups/uploads-$(date +%Y%m%d).tar.gz server/uploads/
```

### Docker Backup

```bash
docker cp soilfer-lims:/app/server/prisma/dev.db ./backup-$(date +%Y%m%d).db
```

### Restore

```bash
# Manual
cp backups/lims-20240101-0900.db server/prisma/dev.db

# Docker
docker cp ./backup-20240101.db soilfer-lims:/app/server/prisma/dev.db
docker restart soilfer-lims
```

### Automated Daily Backup (cron)

```bash
# Edit crontab
crontab -e

# Add this line (daily backup at 2 AM)
0 2 * * * cp /opt/soilfer-lims/server/prisma/dev.db /opt/backups/lims-$(date +\%Y\%m\%d).db
```

---

## 7. Updating

### Docker

```bash
cd soilfer-lims
git pull origin main
docker compose down
docker compose up -d --build
```

### Manual

```bash
cd soilfer-lims
git pull origin main
./setup.sh        # Re-runs full build
cd server && node index.js
```

> **Note:** The seed script is safe to re-run — it skips if users already exist.

---

## 8. Troubleshooting

### Port already in use

```bash
# Find what's using port 3000
lsof -i :3000          # Linux/macOS
netstat -ano | findstr 3000  # Windows

# Use a different port
PORT=8080 node index.js
```

### Database locked

```bash
# Stop all LIMS processes, then restart
pkill -f "node index.js"
cd server && node index.js
```

### Prisma client not found

```bash
cd server
npx prisma generate
node index.js
```

### Docker build fails

```bash
# Clean rebuild
docker compose down
docker system prune -f
docker compose up -d --build
```

### Check logs

```bash
# Docker
docker logs soilfer-lims -f --tail 100

# Manual
# Server logs directly to console
```

---

## Environment Variables Reference

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `3000` | Server port |
| `JWT_SECRET` | *(required)* | Secret for JWT tokens. Generate with `node -e "..."` |
| `NODE_ENV` | `production` | `production` or `development` |
| `DEPLOYMENT_MODE` | `local` | `local` (single lab) or `global` (multi-lab) |
