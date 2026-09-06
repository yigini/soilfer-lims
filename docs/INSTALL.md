<div align="center">

<img src="./assets/soilfer-logo.png" alt="SoilFER LIMS Logo" width="300" />

# 🛠️ SoilFER-LIMS — Installation Quickstart

**Step-by-Step Installation Guide for Developers & Laboratory IT Staff**  
*Written for non-IT users — no prior server experience needed.*

[![Quickstart](https://img.shields.io/badge/Quickstart-Beginner%20Friendly-emerald.svg)](#)
[![Docker](https://img.shields.io/badge/Docker-Ready-blue.svg)](../Dockerfile)
[![Node.js](https://img.shields.io/badge/Node.js-20%2B%20%7C%2022%2B-green.svg)](https://nodejs.org/)

</div>

---

## 📖 In-Repository & Local Documentation

* 📖 **[Administration Guide](ADMIN_GUIDE.md)** — Laboratory configuration, user RBAC, GloSIS procedures, and SIS API keys.
* 🚀 **[Deployment & Production Guide](DEPLOYMENT_GUIDE.md)** — Comprehensive VPS setup, Nginx reverse proxy, SSL/Certbot, and zero-downtime updates.
* 🛠️ **[Installation Quickstart](INSTALL.md)** — Step-by-step local and server installation.
* 🔄 **[Upgrading & Maintenance Guide](UPGRADING.md)** — Backup procedures, container updates, and database migration routines.
* 📚 **Interactive mdBook Site (Local)** — Run `mdbook serve docs/book` from the repository root to read the book locally.

---

## Which Scenario Are You?

| | **Scenario A** | **Scenario B** |
|---|---|---|
| **You have** | A fresh domain + fresh server | An existing server with other websites |
| **Example** | `soillab.org` (nothing running yet) | Adding `lims.mainsite.org` next to existing sites |
| **Server** | Brand new Linux VPS | Already has NGINX/Apache + other services |
| **Difficulty** | ⭐ Easier | ⭐⭐ Moderate |

**Both scenarios use Docker** — the recommended deployment method. It packages everything (Node.js, database, web server) into one container, so you don't need to install anything manually.

---

## Before You Start

You will need:

1. **A Linux server** — Ubuntu 22.04+ recommended (DigitalOcean, Hetzner, OVH, AWS, or any VPS provider)  
   - Minimum: 1 CPU, 1 GB RAM, 10 GB disk
2. **A domain name** — Either a new domain (`soillab.org`) or a subdomain (`lims.existing-site.org`)
3. **SSH access** — Your server's IP address, username, and password or SSH key
4. **An SSH client** — Terminal (Mac/Linux) or [PuTTY](https://www.putty.org/) (Windows)

---

## Step 0: Connect to Your Server

Open your terminal (or PuTTY) and connect:

```bash
ssh root@YOUR_SERVER_IP
# Example: ssh root@46.19.33.37
# Enter your password when prompted
```

> 💡 **Tip:** Most VPS providers email you the IP + password after you create a server.

---

## Step 1: Install Docker (Both Scenarios)

If Docker is not yet installed, run these commands one by one:

```bash
# Update your system
sudo apt update && sudo apt upgrade -y

# Install Docker
curl -fsSL https://get.docker.com | sh

# Allow your user to run Docker without sudo
sudo usermod -aG docker $USER

# IMPORTANT: Log out and log back in for the group change to take effect
exit
```

Log back in:

```bash
ssh root@YOUR_SERVER_IP
```

Verify Docker is working:

```bash
docker --version
# Should show: Docker version 24.x or higher

docker compose version
# Should show: Docker Compose version v2.x
```

> ⚠️ If `docker compose version` doesn't work, you may need to install it separately:
> ```bash
> sudo apt install docker-compose-plugin
> ```

---

## Step 2: Install Git (if not already installed)

```bash
sudo apt install -y git
```

---

## Step 3: Download SoilFER-LIMS

```bash
# Navigate to a good location
cd /opt

# Download the code
git clone https://github.com/yigini/soilfer-lims.git
cd soilfer-lims
```

---

## Step 4: Configure Your Environment

```bash
# Copy the example configuration
cp .env.example .env

# Edit the configuration
nano .env
```

In the editor, set these values:

```bash
PORT=3000
JWT_SECRET=          # LEAVE BLANK — auto-generated on first boot
NODE_ENV=production
DEPLOYMENT_MODE=local   # Use 'local' for single lab, 'global' for multi-lab
```

> 💡 **Which mode?**
> - `local` = One laboratory with one admin. Best for individual soil labs.
> - `global` = Multiple laboratories, each with their own manager. Best for national programs or research networks.

Press **Ctrl+O** to save, then **Ctrl+X** to exit nano.

---

# 🅰️ Scenario A: Fresh Domain + Fresh Server

*You just bought `soillab.org` and have a brand new server with nothing on it.*

### A1. Point Your Domain to Your Server

Go to your domain provider (GoDaddy, Namecheap, Cloudflare, etc.) and add a **DNS record**:

| Setting | Value |
|---------|-------|
| **Type** | A |
| **Name** | `@` (or leave blank — means the root domain) |
| **Value** | Your server's IP address (e.g. `46.19.33.37`) |
| **TTL** | Auto or 3600 |

> ⏳ DNS changes take **5 minutes to 1 hour** to propagate. You can check at [whatsmydns.net](https://www.whatsmydns.net/).

If you also want `www.soillab.org` to work, add a second record:

| Type | Name | Value |
|------|------|-------|
| A | `www` | Your server IP |

### A2. Update the NGINX Config with Your Domain

```bash
nano deploy/nginx.conf
```

Replace `server_name _;` with your actual domain:

```nginx
server_name soillab.org www.soillab.org;
```

Save and exit (Ctrl+O, Ctrl+X).

### A3. Start SoilFER-LIMS

```bash
# For single-lab deployment:
docker compose -f docker-compose.yml -f docker-compose.global.yml up -d

# Wait about 30-60 seconds for first boot (it downloads, builds, and seeds the database)
```

> **Why `docker-compose.global.yml`?** This adds NGINX (web server) which listens on port 80 — standard for websites. Without it, you'd access the site on port 3000, which is unusual and won't work with SSL.

Verify it's running:

```bash
docker ps
# You should see two containers: soilfer-lims and soilfer-nginx

# Check if the website responds:
curl http://localhost/api/health
# Should return: {"status":"ok", ...}
```

### A4. Open Your Browser

Go to **http://soillab.org** — you should see the LIMS login page!

- **Username:** `admin`
- **Password:** `<generated-initial-password>` (check startup logs with `docker logs soilfer-lims | grep "INITIAL ADMIN CREDENTIALS" -A 4`)
- You will be prompted to change your password immediately on first login.

### A5. Add SSL (HTTPS) — Recommended

This makes your site secure (`https://`) and removes browser warnings.

```bash
# Install Certbot (the free SSL tool)
sudo apt install -y certbot

# Stop NGINX temporarily so Certbot can verify your domain
docker compose -f docker-compose.yml -f docker-compose.global.yml stop nginx

# Get your SSL certificate (replace with YOUR domain)
sudo certbot certonly --standalone -d soillab.org -d www.soillab.org

# You'll be asked for your email and to agree to the terms
```

Certbot creates the certificate files at `/etc/letsencrypt/live/soillab.org/`.

Now update the NGINX config to use HTTPS:

```bash
nano deploy/nginx.conf
```

**Replace the entire file** with this (change `soillab.org` to your domain):

```nginx
# Redirect HTTP to HTTPS
server {
    listen 80;
    server_name soillab.org www.soillab.org;
    return 301 https://$host$request_uri;
}

# HTTPS server
server {
    listen 443 ssl http2;
    server_name soillab.org www.soillab.org;

    ssl_certificate /etc/letsencrypt/live/soillab.org/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/soillab.org/privkey.pem;

    location / {
        proxy_pass http://lims:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 86400;
    }

    client_max_body_size 100M;
}
```

Update `docker-compose.global.yml` to mount the SSL certificates:

```bash
nano docker-compose.global.yml
```

Uncomment the SSL volume line:

```yaml
    volumes:
      - ./deploy/nginx.conf:/etc/nginx/conf.d/default.conf:ro
      - /etc/letsencrypt:/etc/letsencrypt:ro     # ← ADD THIS LINE
```

Restart everything:

```bash
docker compose -f docker-compose.yml -f docker-compose.global.yml up -d
```

Visit **https://soillab.org** — you should see the green lock icon! 🔒

### A6. Auto-Renew SSL Certificates

Let's Encrypt certificates expire every 90 days. Set up automatic renewal:

```bash
# Create a renewal script
sudo tee /etc/cron.d/certbot-renew << 'EOF'
0 3 * * 1 root certbot renew --pre-hook "docker compose -f /opt/soilfer-lims/docker-compose.yml -f /opt/soilfer-lims/docker-compose.global.yml stop nginx" --post-hook "docker compose -f /opt/soilfer-lims/docker-compose.yml -f /opt/soilfer-lims/docker-compose.global.yml start nginx"
EOF
```

This checks every Monday at 3 AM and renews the certificate if needed.

---

# 🅱️ Scenario B: Existing Server with Subdomain

*Your server already runs other websites (e.g. `mainsite.org`). You want to add LIMS at `lims.mainsite.org`.*

### B1. Create a Subdomain DNS Record

Go to your domain provider and add:

| Setting | Value |
|---------|-------|
| **Type** | A |
| **Name** | `lims` |
| **Value** | Your server's IP address |
| **TTL** | Auto or 3600 |

This creates `lims.mainsite.org` pointing to your server.

### B2. Start LIMS (Without the Built-in NGINX)

Since your server already has a web server (NGINX or Apache), we'll use the **base** docker-compose only — LIMS runs on port 3000 and your existing NGINX/Apache handles the public-facing connection.

```bash
cd /opt/soilfer-lims

# Start LIMS on port 3000 (not exposed publicly yet)
docker compose up -d

# Verify it's running
curl http://localhost:3000/api/health
# Should return: {"status":"ok", ...}
```

### B3. Configure Your Existing NGINX

Add a new site configuration for the LIMS subdomain:

```bash
sudo nano /etc/nginx/sites-available/lims.mainsite.org
```

Paste this (replace `lims.mainsite.org` with your subdomain):

```nginx
server {
    listen 80;
    server_name lims.mainsite.org;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        # WebSocket support
        proxy_read_timeout 86400;
    }

    # Spectral data uploads can be large
    client_max_body_size 100M;
}
```

Enable the site:

```bash
# Link the config
sudo ln -s /etc/nginx/sites-available/lims.mainsite.org /etc/nginx/sites-enabled/

# Test for errors
sudo nginx -t

# If "syntax is ok" appears, reload:
sudo systemctl reload nginx
```

### B4. Test It

Open **http://lims.mainsite.org** in your browser. You should see the LIMS login page.

- **Username:** `admin`
- **Password:** `<generated-initial-password>` (from container logs, or set via `ADMIN_INITIAL_PASSWORD`)

### B5. Add SSL for the Subdomain

If you already use Certbot on this server:

```bash
sudo certbot --nginx -d lims.mainsite.org
```

Certbot will automatically:
1. Get a certificate for `lims.mainsite.org`
2. Update your NGINX config to use HTTPS
3. Set up auto-renewal

Visit **https://lims.mainsite.org** — done! 🔒

> ⚠️ **If you use Apache** instead of NGINX, the proxy config is different. See the section below.

### B5-alt. Using Apache Instead of NGINX

If your server uses Apache:

```bash
# Enable required modules
sudo a2enmod proxy proxy_http proxy_wstunnel rewrite ssl

# Create a virtual host
sudo nano /etc/apache2/sites-available/lims.mainsite.org.conf
```

Paste:

```apache
<VirtualHost *:80>
    ServerName lims.mainsite.org

    ProxyPreserveHost On
    ProxyPass / http://127.0.0.1:3000/
    ProxyPassReverse / http://127.0.0.1:3000/

    # WebSocket support
    RewriteEngine On
    RewriteCond %{HTTP:Upgrade} websocket [NC]
    RewriteRule /(.*) ws://127.0.0.1:3000/$1 [P,L]
</VirtualHost>
```

Enable and reload:

```bash
sudo a2ensite lims.mainsite.org.conf
sudo systemctl reload apache2

# For SSL:
sudo certbot --apache -d lims.mainsite.org
```

---

# 📋 After Deployment (Both Scenarios)

### First Login

1. Open your LIMS URL
2. Log in with `admin` and your `<generated-initial-password>`
3. **Change the password immediately** when prompted
4. Go to **Settings** → update your laboratory name, address, contact details
5. Create user accounts for your team under **Admin Panel → Users** (`/admin?tab=users`)

### Backup Your Database

SoilFER-LIMS uses SQLite in WAL mode. Never copy live `dev.db` files directly. Trigger the online backup script inside the container:

```bash
# Trigger an online compressed backup:
docker exec soilfer-lims node scripts/backup_db.js

# Copy the backup archive to host storage:
mkdir -p /opt/backups
docker cp soilfer-lims:/app/server/backups/ /opt/

# Verify backup integrity:
docker exec soilfer-lims node scripts/verify_backup.js /app/server/backups/<backup-filename>.db.gz

# Set up daily automated backup at 02:00 UTC:
echo "0 2 * * * root docker exec soilfer-lims node scripts/backup_db.js" | sudo tee /etc/cron.d/lims-backup
```

### Restoring from Backup

To restore safely:
```bash
# Stop the application container
cd /opt/soilfer-lims
docker compose stop

# Run restore utility in disposable container
docker run --rm -v lims-data:/app/server/prisma -v lims-backups:/app/server/backups \
  soilfer-lims-app node scripts/restore_db.js /app/server/backups/<backup-filename>.db.gz

# Restart application container
docker compose start
curl -f http://localhost/api/health
```

### Updating to a New Version

```bash
cd /opt/soilfer-lims
git pull origin main
docker compose down
docker compose up -d --build     # or add -f docker-compose.global.yml for Scenario A
```

> Your database is preserved across updates — it lives in the Docker volume `lims-data`.

---

## ⚖️ Scope & Validation Responsibility

SoilFER-LIMS provides analytical data management tools, calculation routines, and quality record structures. Each adopting laboratory remains responsible for:
- Validating analytical methods, calculations, and instruments prior to reporting operational results.
- Establishing and approving method-specific quality control acceptance thresholds (blanks, duplicates, and reference materials).
- Managing user access controls, role assignments, and password rotation policies according to institutional security standards.
- Ensuring compliance with national, regional, and international laboratory accreditation requirements (such as ISO/IEC 17025).
- Implementing routine off-site database backups and validating disaster recovery procedures.

### Checking Logs

```bash
# View live server logs
docker logs soilfer-lims -f --tail 50

# Check container status
docker ps

# Restart if needed
docker compose restart
```

---

## Troubleshooting

### "Connection refused" when opening the website

```bash
# Check if containers are running
docker ps

# If no containers, start them
cd /opt/soilfer-lims && docker compose up -d

# Check for errors in logs
docker logs soilfer-lims --tail 30
```

### "502 Bad Gateway" from NGINX

The LIMS container hasn't finished starting yet. Wait 30 seconds and refresh.

```bash
# Check if LIMS is healthy
docker inspect soilfer-lims --format='{{.State.Health.Status}}'
# Should say "healthy"
```

### DNS not working (can't access by domain name)

1. Check DNS propagation at [whatsmydns.net](https://www.whatsmydns.net/)
2. Verify the A record points to the correct server IP
3. Try accessing by IP directly: `http://YOUR_SERVER_IP:3000`

### SSL certificate errors

```bash
# Check certificate status
sudo certbot certificates

# Force renewal
sudo certbot renew --force-renewal
```

### Port 80 or 443 already in use

If another web server is using these ports (Scenario B), don't use the global docker-compose. Use the base compose and your existing NGINX/Apache.

```bash
# Check what's using port 80
sudo lsof -i :80
```

### Forgot admin password

```bash
# Access the container shell
docker exec -it soilfer-lims sh

# Reset via database (inside container)
cd /app/server
node -e "
const {PrismaClient}=require('./prisma_client');
const bcrypt=require('bcryptjs');
const p=new PrismaClient();
(async()=>{
  const hash=await bcrypt.hash('password',10);
  await p.user.updateMany({where:{username:'admin'},data:{password:hash,mustChangePassword:true}});
  console.log('Password reset to: password');
})()
"

# Exit container
exit
```

---

## System Requirements

| Component | Minimum | Recommended |
|-----------|---------|-------------|
| **CPU** | 1 core | 2 cores |
| **RAM** | 1 GB | 2 GB |
| **Disk** | 10 GB | 20 GB+ (for spectral data) |
| **OS** | Ubuntu 22.04+ / Debian 12+ | Ubuntu 24.04 LTS |
| **Docker** | 20+ | Latest stable |

---

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `3000` | Internal server port |
| `JWT_SECRET` | *(auto-generated)* | Secret for login tokens. Auto-generated if left blank |
| `NODE_ENV` | `production` | Leave as `production` |
| `DEPLOYMENT_MODE` | `local` | `local` (single lab) or `global` (multi-lab network) |
