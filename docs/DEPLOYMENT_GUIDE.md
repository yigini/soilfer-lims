<div align="center">

<img src="./assets/soilfer-logo.png" alt="SoilFER LIMS Logo" width="320" />

# 🚀 SoilFER-LIMS — Complete Production & Deployment Guide

> **Version 1.4.0** · Laboratory Information Management System for Soil Analysis  
> *Developed under the FAO SoilFER Programme · Supported by GLOSOLAN & Global Soil Partnership*

[![License: MIT](https://img.shields.io/badge/License-MIT-emerald.svg)](../LICENSE)
[![Docker](https://img.shields.io/badge/Docker-Containerized-blue.svg)](../Dockerfile)
[![Tests](https://img.shields.io/badge/Tests-77%20Suites%20%7C%20555%20Passing-brightgreen.svg)](#)

</div>

---

## 📖 In-Repository & Local Documentation

* 📖 **[Administration Guide](ADMIN_GUIDE.md)** — Laboratory configuration, user RBAC, GloSIS procedures, and SIS API keys.
* 🚀 **[Deployment & Production Guide](DEPLOYMENT_GUIDE.md)** — Comprehensive VPS setup, Nginx reverse proxy, SSL/Certbot, and zero-downtime updates.
* 🛠️ **[Installation Quickstart](INSTALL.md)** — Step-by-step local and server installation.
* 🔄 **[Upgrading & Maintenance Guide](UPGRADING.md)** — Backup procedures, container updates, and database migration routines.
* 📚 **Interactive mdBook Site (Local)** — Run `mdbook serve docs/book` from repository root to launch the documentation site locally.

---

# Part 1: Introduction

## What Is SoilFER-LIMS?

SoilFER-LIMS (Laboratory Information Management System) is a web application that helps soil laboratories manage their daily work digitally. Instead of using paper forms, Excel spreadsheets, or disconnected tools, your entire laboratory workflow lives in one system that everyone on your team can access through a web browser.

### What Can It Do?

- **Track samples** from the moment they arrive at the lab until the final report is delivered
- **Assign work** to technicians and track who did what, and when
- **Record results** for soil analyses (pH, nutrients, organic carbon, texture, etc.)
- **Quality control** — built-in QC batches, review workflows, and approval chains
- **Sync field data** — automatic import from KoboToolbox mobile data collection
- **Spectral data** — upload and manage MIR/NIR spectral measurements
- **3D maps** — visualize sampling locations on an interactive globe
- **Equipment tracking** — manage instruments, calibrations, and maintenance schedules
- **Inventory** — track reagents, consumables, and stock levels
- **Reports** — export data to Excel, CSV, or PDF
- **Audit trail** — every action is logged for traceability
- **Multi-language** — English, French, Spanish, Portuguese

### Who Is It For?

- **National soil laboratories** managing thousands of samples per year
- **University research labs** running soil fertility studies
- **Agricultural extension services** providing soil testing to farmers
- **International soil programs** coordinating multiple laboratories across regions

### How Does It Work Technically?

SoilFER-LIMS is a **web application** — it runs on a server, and your team accesses it through any web browser (Chrome, Firefox, Edge, Safari). No software needs to be installed on individual computers. You can access it from desktops, laptops, tablets, or phones.

```
┌──────────────────────────────────────────────────┐
│                                                  │
│   Your team's computers/phones/tablets           │
│   (just use any web browser)                     │
│          ↕ internet or local network             │
│                                                  │
│   ┌──────────────────────────────────────────┐   │
│   │  Your server (cloud VPS or local)        │   │
│   │                                          │   │
│   │  ┌──────────────────────────────────┐    │   │
│   │  │  SoilFER-LIMS application        │    │   │
│   │  │  • Website (React frontend)      │    │   │
│   │  │  • API server (Node.js backend)  │    │   │
│   │  │  • Database (SQLite file)        │    │   │
│   │  └──────────────────────────────────┘    │   │
│   └──────────────────────────────────────────┘   │
│                                                  │
└──────────────────────────────────────────────────┘
```

The entire system runs inside a **Docker container** — think of it as a self-contained package that includes everything the application needs. You don't need to install Node.js, databases, or web servers separately.

---

## Two Deployment Modes

SoilFER-LIMS can run in two modes, depending on your organization:

### Local Mode — For a Single Laboratory

Best for: One laboratory that wants to digitize its workflow.

- One admin account (Lab Manager) manages the entire system
- All technicians and staff belong to the same lab
- Simple setup, quick to get started

### Global Mode — For Multiple Laboratories

Best for: National programs, research networks, or organizations with several labs.

- A Super Admin creates and manages multiple laboratories
- Each lab gets its own Lab Manager who manages their own staff
- Data is fully isolated — Lab A cannot see Lab B's samples
- Centralized oversight with decentralized lab management

| Feature | Local Mode | Global Mode |
|---------|-----------|-------------|
| Number of labs | 1 | Unlimited |
| Default admin role | Lab Manager | Super Admin |
| Data isolation | Single pool | Fully isolated per lab |
| Best for | Individual labs | Lab networks |

You choose the mode during setup. It can be changed later if needed.

---

# Part 2: What You Need Before Starting

## The Server

You need a **Linux server** — a computer that stays running 24/7 and is accessible over the internet. Almost all organizations use a **cloud server** (also called a VPS — Virtual Private Server) for this.

### Recommended Server Providers

| Provider | Cheapest Plan | Good For |
|----------|--------------|----------|
| [Hetzner](https://www.hetzner.com/cloud) | ~€4/month | Best price-performance in Europe |
| [DigitalOcean](https://www.digitalocean.com) | $6/month | Beginner-friendly, great docs |
| [OVH](https://www.ovhcloud.com) | ~€4/month | Popular in Africa and Europe |
| [Linode (Akamai)](https://www.linode.com) | $5/month | Reliable, good support |
| [AWS Lightsail](https://aws.amazon.com/lightsail/) | $5/month | Amazon's simple VPS |
| [Vultr](https://www.vultr.com) | $5/month | Many server locations worldwide |

### Minimum Server Specifications

| What | Minimum | Recommended |
|------|---------|-------------|
| CPU | 1 core | 2 cores |
| RAM | 1 GB | 2 GB |
| Disk | 10 GB | 20 GB+ (if storing spectral data) |
| OS | Ubuntu 22.04 LTS | Ubuntu 24.04 LTS |

> 💡 **Which OS to choose?** When creating your server, choose **Ubuntu 22.04 LTS** or **Ubuntu 24.04 LTS**. LTS means "Long Term Support" — it receives security updates for 5 years.

### How to Create a Server (Example: Hetzner)

1. Go to [hetzner.com/cloud](https://www.hetzner.com/cloud) and create an account
2. Click **"Add Server"**
3. Choose a location close to your users
4. Select **Ubuntu 22.04** as the operating system
5. Select the **CX22** plan (2 CPU, 4 GB RAM — about €4/month)
6. Under **SSH keys**, click "Add SSH Key" (or use password authentication)
7. Give your server a name (e.g., `soillab-server`)
8. Click **"Create & Buy now"**
9. Note down the **IP address** shown (e.g., `46.19.33.37`)

> The process is similar on other providers. They all give you an IP address and a way to log in.

---

## The Domain Name

A domain name (like `soillab.org` or `lims.your-institute.org`) makes your LIMS accessible through a memorable web address instead of an IP number.

### Option 1: Buy a New Domain

Buy from any domain registrar:
- [Namecheap](https://www.namecheap.com) — affordable, good interface
- [Cloudflare Registrar](https://www.cloudflare.com/products/registrar/) — no markup pricing
- [GoDaddy](https://www.godaddy.com) — popular, well-known

A `.org` or `.com` domain costs about $10-15/year.

### Option 2: Use a Subdomain of an Existing Domain

If your organization already has a domain (e.g., `your-institute.org`), ask your IT department to create a subdomain like `lims.your-institute.org`. This is free — it just requires adding a DNS record (explained below).

---

## The SSH Client (How to Connect to Your Server)

You'll type commands into your server through a program called an **SSH client**.

- **Mac/Linux**: Open the built-in **Terminal** app — it has SSH built in
- **Windows**: Download [PuTTY](https://www.putty.org/) (free) or use [Windows Terminal](https://apps.microsoft.com/store/detail/windows-terminal/9N0DX20HK701)

---

# Part 3: Setting Up Your Server

## 3.1 Connect to Your Server

Open your terminal and type:

```bash
ssh root@YOUR_SERVER_IP
```

Replace `YOUR_SERVER_IP` with the IP address from your server provider. For example:

```bash
ssh root@46.19.33.37
```

You'll be asked for your password. Type it (nothing will appear on screen — this is normal) and press Enter.

> 🎉 If you see a command prompt (something like `root@soillab-server:~#`), you're connected!

---

## 3.2 Update Your Server

Always update your server first:

```bash
sudo apt update && sudo apt upgrade -y
```

This downloads the latest security updates. It may take a few minutes.

---

## 3.3 Install Docker

Docker is the tool that will run SoilFER-LIMS. Install it with one command:

```bash
curl -fsSL https://get.docker.com | sh
```

Wait for it to finish. Verify it worked:

```bash
docker --version
```

You should see something like `Docker version 27.x.x`. If you see an error instead, try rebooting (`sudo reboot`) and reconnecting.

Also verify Docker Compose:

```bash
docker compose version
```

You should see `Docker Compose version v2.x.x`.

---

## 3.4 Install Git

```bash
sudo apt install -y git
```

---

## 3.5 Download SoilFER-LIMS

```bash
cd /opt
git clone https://github.com/yigini/soilfer-lims.git
cd soilfer-lims
```

---

## 3.6 Configure SoilFER-LIMS

```bash
cp .env.example .env
nano .env
```

You'll see a text editor with the configuration file. Change the `DEPLOYMENT_MODE` line if needed:

```
PORT=3000
JWT_SECRET=
NODE_ENV=production
DEPLOYMENT_MODE=local
```

- **PORT**: Leave as `3000` (the internal port, not what users see)
- **JWT_SECRET**: Leave blank — it will be auto-generated securely on first boot
- **NODE_ENV**: Leave as `production`
- **DEPLOYMENT_MODE**: Set to `local` for a single lab, or `global` for multiple labs

Save the file: press **Ctrl+O**, then **Enter**, then **Ctrl+X** to exit.

---

# Part 4: Connecting Your Domain

Before starting the application, you need to tell the internet that your domain should point to your server.

## 4.1 Adding a DNS Record

Log in to the website where you manage your domain (Namecheap, Cloudflare, GoDaddy, etc.) and find the **DNS settings** or **DNS records** page.

### If Using a Fresh Domain (e.g., `soillab.org`)

Add these records:

| Type | Name/Host | Value | TTL |
|------|-----------|-------|-----|
| **A** | `@` | `YOUR_SERVER_IP` | Auto |
| **A** | `www` | `YOUR_SERVER_IP` | Auto |

The `@` means the root domain (`soillab.org`). The `www` adds `www.soillab.org` as well.

### If Using a Subdomain (e.g., `lims.your-institute.org`)

Add one record:

| Type | Name/Host | Value | TTL |
|------|-----------|-------|-----|
| **A** | `lims` | `YOUR_SERVER_IP` | Auto |

> ⏳ **DNS propagation** takes 5 minutes to 1 hour. You can check if it's working at [whatsmydns.net](https://www.whatsmydns.net/) — enter your domain and see if it shows your server's IP.

## 4.2 Update the NGINX Configuration

Tell the web server about your domain:

```bash
cd /opt/soilfer-lims
nano deploy/nginx.conf
```

Find the line that says:

```
server_name _;
```

Replace `_` with your domain. Examples:

```nginx
# For a fresh domain:
server_name soillab.org www.soillab.org;

# For a subdomain:
server_name lims.your-institute.org;
```

Save (Ctrl+O, Enter) and exit (Ctrl+X).

---

# Part 5: Starting SoilFER-LIMS

## 5.1 Start the Application

```bash
cd /opt/soilfer-lims
docker compose -f docker-compose.yml -f docker-compose.global.yml up -d
```

> **What does this command do?**
> - `docker compose up` starts the application
> - `-f docker-compose.yml -f docker-compose.global.yml` tells Docker to use both the base config and the web server (NGINX) config
> - `-d` runs it in the background (so it keeps running after you close the terminal)

The **first time** you run this, Docker will:
1. Download the Node.js base image (~150 MB)
2. Install all dependencies
3. Build the frontend application
4. Create the database
5. Create the default admin account

This takes **3-5 minutes** on the first run. Subsequent starts take only a few seconds.

## 5.2 Verify It's Running

```bash
# Check that both containers are running
docker ps
```

You should see two containers:

```
CONTAINER ID   IMAGE              STATUS                     NAMES
abc123...      soilfer-lims-lims  Up 2 minutes (healthy)     soilfer-lims
def456...      nginx:alpine       Up 2 minutes               soilfer-nginx
```

The key is that `soilfer-lims` shows **"healthy"** in the status. If it says "starting", wait another 30 seconds and check again.

```bash
# Test the API directly
curl http://localhost/api/health
```

You should see: `{"status":"ok","uptime":...}`

## 5.3 Open Your LIMS

Open your web browser and go to:
- **http://soillab.org** (if using your own domain)
- **http://YOUR_SERVER_IP** (if DNS hasn't propagated yet)

You should see the SoilFER-LIMS login page.

### First Login

| Field | Value |
|-------|-------|
| Username | `admin` |
| Password | `<generated-initial-password>` (or value of `ADMIN_INITIAL_PASSWORD`) |

Check the container startup logs (`docker logs soilfer-lims | grep "INITIAL ADMIN CREDENTIALS" -A 4`) for your randomly generated password. You will be **immediately prompted to change your password** on first login. Choose a strong institutional password and remember it.

---

# Part 6: Securing Your Site with HTTPS

HTTPS encrypts the connection between your users' browsers and your server. Without it, passwords and data travel unencrypted. All production sites should use HTTPS.

The good news: SSL certificates are **free** thanks to [Let's Encrypt](https://letsencrypt.org/).

## 6.1 Install Certbot

```bash
sudo apt install -y certbot
```

## 6.2 Get Your Certificate

First, temporarily stop the NGINX container (Certbot needs port 80):

```bash
cd /opt/soilfer-lims
docker compose -f docker-compose.yml -f docker-compose.global.yml stop nginx
```

Now run Certbot (replace with your domain):

```bash
# For a fresh domain:
sudo certbot certonly --standalone -d soillab.org -d www.soillab.org

# For a subdomain:
sudo certbot certonly --standalone -d lims.your-institute.org
```

Certbot will ask for:
1. **Your email address** — for renewal notifications
2. **Agreement to terms** — type `Y`
3. **Share email with EFF** — your choice, `N` is fine

If successful, you'll see:

```
Congratulations! Your certificate has been saved at:
/etc/letsencrypt/live/soillab.org/fullchain.pem
```

## 6.3 Update NGINX for HTTPS

```bash
nano /opt/soilfer-lims/deploy/nginx.conf
```

**Replace the entire contents** with this (change `soillab.org` to your domain everywhere):

```nginx
# Redirect all HTTP traffic to HTTPS
server {
    listen 80;
    server_name soillab.org www.soillab.org;
    return 301 https://$host$request_uri;
}

# Main HTTPS server
server {
    listen 443 ssl http2;
    server_name soillab.org www.soillab.org;

    # SSL certificates from Let's Encrypt
    ssl_certificate /etc/letsencrypt/live/soillab.org/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/soillab.org/privkey.pem;

    # Forward requests to the LIMS application
    location / {
        proxy_pass http://lims:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        # WebSocket support (for real-time notifications)
        proxy_read_timeout 86400;
    }

    # Allow large file uploads (spectral data)
    client_max_body_size 100M;
}
```

## 6.4 Restart Everything

```bash
cd /opt/soilfer-lims
docker compose -f docker-compose.yml -f docker-compose.global.yml up -d
```

Visit **https://soillab.org** — you should see the green lock icon 🔒 in your browser!

## 6.5 Set Up Automatic Certificate Renewal

Let's Encrypt certificates expire every 90 days. Set up automatic renewal:

```bash
sudo tee /etc/cron.d/lims-certbot << 'EOF'
# Renew SSL certificate every Monday at 3 AM
0 3 * * 1 root certbot renew --pre-hook "cd /opt/soilfer-lims && docker compose -f docker-compose.yml -f docker-compose.global.yml stop nginx" --post-hook "cd /opt/soilfer-lims && docker compose -f docker-compose.yml -f docker-compose.global.yml start nginx" >> /var/log/certbot-renew.log 2>&1
EOF
```

This checks every Monday at 3 AM. It only renews if the certificate is close to expiring.

---

# Part 7: Deploying on an Existing Server (Subdomain)

If your server already hosts other websites and has NGINX installed directly (not in Docker), the setup is slightly different.

## 7.1 Start LIMS Without the Built-in NGINX

Use only the base Docker Compose (without the global override):

```bash
cd /opt/soilfer-lims
docker compose up -d
```

This starts LIMS on port 3000, but doesn't touch your existing web server.

## 7.2 Add LIMS to Your Existing NGINX

Create a new site configuration:

```bash
sudo nano /etc/nginx/sites-available/lims.your-institute.org
```

Paste this (replace `lims.your-institute.org` with your subdomain):

```nginx
server {
    listen 80;
    server_name lims.your-institute.org;

    location / {
        proxy_pass http://127.0.0.1:3000;
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

Enable the site and reload NGINX:

```bash
sudo ln -s /etc/nginx/sites-available/lims.your-institute.org /etc/nginx/sites-enabled/
sudo nginx -t            # Check for errors
sudo systemctl reload nginx
```

## 7.3 Add SSL Using Your Existing Certbot

```bash
sudo certbot --nginx -d lims.your-institute.org
```

Certbot will automatically update your NGINX config to use HTTPS.

## 7.4 For Apache Users

If your server uses Apache instead of NGINX:

```bash
# Enable required Apache modules
sudo a2enmod proxy proxy_http proxy_wstunnel rewrite ssl

# Create a virtual host configuration
sudo nano /etc/apache2/sites-available/lims.your-institute.org.conf
```

Paste:

```apache
<VirtualHost *:80>
    ServerName lims.your-institute.org

    ProxyPreserveHost On
    ProxyPass / http://127.0.0.1:3000/
    ProxyPassReverse / http://127.0.0.1:3000/

    # WebSocket support for real-time features
    RewriteEngine On
    RewriteCond %{HTTP:Upgrade} websocket [NC]
    RewriteRule /(.*) ws://127.0.0.1:3000/$1 [P,L]
</VirtualHost>
```

Enable and reload:

```bash
sudo a2ensite lims.your-institute.org.conf
sudo systemctl reload apache2

# Add SSL:
sudo certbot --apache -d lims.your-institute.org
```

---

# Part 8: Using SoilFER-LIMS

## 8.1 Roles and Permissions

SoilFER-LIMS uses role-based access — each user can only see and do what their role allows.

| Role | What They Can Do |
|------|-----------------|
| **Super Admin** | Everything. Creates laboratories, manages all users. Only exists in Global mode. |
| **Lab Manager** | Manages their laboratory: creates users, assigns work, reviews and approves results, configures analyses. |
| **Lab Technician** | Performs assigned analyses, enters results, submits work for review. |
| **Sample Reception** | Receives physical samples, assigns laboratory IDs, manages the intake queue. |
| **Project Manager** | Views project progress, exports reports. Read-only access to data. |

## 8.2 Getting Started After First Login

### Local Mode (Single Lab)

After logging in as `admin`:

1. **Update your laboratory details**
   - Go to **Settings → Laboratory**
   - Enter your lab name, address, country, and contact information

2. **Create user accounts for your team**
   - Go to **Settings → Users**
   - Click **"Create User"**
   - Fill in name, username, email, and select a role
   - Share the temporary password with the user — they'll change it on first login

3. **Configure your analyses**
   - Go to **Settings → Analyses**
   - Enable the soil tests your lab performs (pH, organic carbon, texture, etc.)
   - Customize method references and units

4. **Create your first project**
   - Go to **Projects → New Project**
   - Enter project name, code, client, expected sample count
   - This organizes your samples by study or client

### Global Mode (Multiple Labs)

After logging in as `admin` (Super Admin):

1. **Create laboratories**
   - Go to **Admin → Laboratories → Create**
   - Enter each lab's name, code, country, and contact

2. **Create Lab Managers**
   - Go to **Admin → Users → Create**
   - For each lab, create a user with the **LAB_MANAGER** role
   - Assign them to their laboratory

3. **Lab Managers take over**
   - Each Lab Manager logs in and sets up their lab (same steps as Local mode above)
   - They create their own technicians, configure analyses, and manage projects

## 8.3 The Sample Workflow

This is the core of LIMS — how a soil sample moves through the system:

```
 Field           Reception        Analysis          Review           Report
┌─────────┐    ┌───────────┐    ┌────────────┐    ┌──────────┐    ┌─────────┐
│ Collect  │ →  │  Receive  │ →  │  Analyze   │ →  │ Approve  │ →  │ Export  │
│ sample   │    │  & log    │    │  in lab    │    │ results  │    │ results │
│ in field │    │  sample   │    │  (pH etc.) │    │          │    │         │
└─────────┘    └───────────┘    └────────────┘    └──────────┘    └─────────┘
    📱              📋               🔬              ✅              📊
  KoboToolbox   Reception pg    Technician       Lab Manager    Data Results
```

### Step 1: Sample Arrives at the Lab

- **With KoboToolbox**: If field teams use KoboToolbox, samples appear automatically in the **Reception** queue after syncing
- **Manual entry**: Go to **Reception → New Sample** and enter the sample details manually

### Step 2: Reception Logs the Sample

The reception staff:
1. Inspects the physical sample
2. Assigns a **Laboratory ID** (auto-generated or custom)
3. Records any observations (damage, insufficient quantity, etc.)
4. Submits the sample for analysis

### Step 3: Lab Manager Assigns Work

1. Go to **Dashboard** or **Samples**
2. Select samples that need analysis
3. Assign them to specific technicians
4. Set priority and deadlines

### Step 4: Technician Performs Analyses

1. Go to **My Work** to see assigned samples
2. Select a sample and enter results for each test
3. Submit results for review

### Step 5: Review and Approval

1. Lab Manager goes to **Manager Queue**
2. Reviews submitted results
3. Approves or rejects each one (with comments if rejected)
4. Approved results become part of the final record

### Step 6: Export and Reporting

1. Go to **Data Results**
2. Filter by project, date range, or analysis type
3. Export to **Excel**, **CSV**, or **PDF**

## 8.4 KoboToolbox Integration

If your field teams collect samples using [KoboToolbox](https://www.kobotoolbox.org/), you can automatically import that data into LIMS.

### Setup

1. Go to **Settings → KoboToolbox**
2. Enter your KoboToolbox server URL (e.g., `https://kf.kobotoolbox.org`)
3. Enter your API token (found in KoboToolbox under Account → Security)
4. Select which form to sync with which project
5. Choose sync frequency (every 15 min, hourly, or manual)

### How Sync Works

When a field worker submits a form in KoboToolbox:
1. The data appears in LIMS automatically at the next sync
2. A sample entry is created in the **Reception** queue
3. Reception staff verify the details and log the physical sample
4. GPS coordinates appear on the 3D map

## 8.5 Spectral Data Management

For labs that perform MIR (Mid-Infrared) or NIR (Near-Infrared) spectroscopy:

1. Go to **Spectral Library → Upload**
2. Select your spectral files (CSV or OPUS format)
3. The system validates wavelength ranges, identifies duplicates, and flags QC issues
4. Link spectra to existing samples by lab ID
5. Spectra go through the same review/approval workflow as other results

## 8.6 Equipment and Inventory

### Equipment Module

Track all laboratory instruments:
- **Equipment list**: Add each instrument with model, serial number, location
- **Calibration schedules**: Set calibration due dates, get alerts when due
- **Maintenance logs**: Record maintenance activities and costs
- **Eligibility tracking**: Mark equipment as eligible or ineligible for use

### Inventory Module

Track consumables and reagents:
- **Item catalog**: Define items with categories, units, and minimum stock levels
- **Stock tracking**: Record additions and usage
- **Location management**: Track where items are stored
- **Alerts**: Get notified when stock falls below minimum level

---

# Part 9: Maintenance and Administration

## 9.1 Backing Up Your Data

Your LIMS data lives in a single file (`dev.db`). Backing it up is as simple as copying that file.

### Manual Backup

### Creating an Immediate Online Backup

SoilFER-LIMS runs SQLite in WAL (Write-Ahead Logging) mode. Never copy a live `dev.db` file directly while the container is running. Instead, trigger the online backup script:

```bash
# Trigger transactionally safe online backup
docker exec soilfer-lims node scripts/backup_db.js

# The backup is saved to /app/server/backups/soilfer_lims_backup_<timestamp>.db.gz
# Copy the generated archive to your host backup directory:
mkdir -p /opt/backups
docker cp soilfer-lims:/app/server/backups/ /opt/
```

### Verifying Backup Integrity

```bash
# Verify SQLite integrity check and table counts inside the backup archive:
docker exec soilfer-lims node scripts/verify_backup.js /app/server/backups/<backup-filename>.db.gz
```

### Automatic Daily Backups

Set up a daily cron job that triggers the online backup API:

```bash
# Add a daily backup job at 02:00 UTC
echo '0 2 * * * root docker exec soilfer-lims node scripts/backup_db.js' | sudo tee /etc/cron.d/lims-backup
```

### Restoring from a Backup

To restore a database safely:

```bash
# 1. Stop the application container to flush open connections
cd /opt/soilfer-lims
docker compose stop

# 2. Run the restore utility against the named volume
docker run --rm -v lims-data:/app/server/prisma -v lims-backups:/app/server/backups \
  soilfer-lims-app node scripts/restore_db.js /app/server/backups/<backup-filename>.db.gz

# 3. Restart the container
docker compose start

# 4. Verify application health
curl -f http://localhost/api/health
```

## 9.2 Updating SoilFER-LIMS

When a new version is released:

```bash
cd /opt/soilfer-lims

# Download the latest code
git pull origin main

# Rebuild and restart (your data is preserved)
docker compose down
docker compose -f docker-compose.yml -f docker-compose.global.yml up -d --build
```

> ⚠️ **Your database is safe** — it lives in a Docker volume that persists across rebuilds. But it's always good practice to back up before updating.

## 9.3 Checking Logs

If something seems wrong, check the logs:

```bash
# View the last 50 lines of server logs
docker logs soilfer-lims --tail 50

# Follow logs in real time (press Ctrl+C to stop)
docker logs soilfer-lims -f

# Check container health
docker ps
```

## 9.4 Restarting the Application

```bash
cd /opt/soilfer-lims

# Simple restart
docker compose restart

# Full restart (stop, then start)
docker compose down
docker compose -f docker-compose.yml -f docker-compose.global.yml up -d
```

## 9.5 Resetting the Admin Password

If you forget the admin password:

```bash
# Open a shell inside the container
docker exec -it soilfer-lims sh

# Reset the password to 'password'
cd /app/server
node -e "
const {PrismaClient}=require('./prisma_client');
const bcrypt=require('bcryptjs');
const crypto=require('crypto');
const p=new PrismaClient();
(async()=>{
  const tempPass = crypto.randomBytes(6).toString('base64url');
  const hash=await bcrypt.hash(tempPass,10);
  await p.user.updateMany({where:{username:'admin'},data:{password:hash,mustChangePassword:true}});
  console.log('Password reset successfully.');
  console.log('Temporary password:', tempPass);
  process.exit(0);
})()
"

# Exit the container shell
exit
```

Now log in with `admin` and your temporary password, then set a new institutional password.

---

# Part 10: Troubleshooting

## "I can't access the site"

| Symptom | Likely Cause | Solution |
|---------|-------------|----------|
| Browser shows "This site can't be reached" | DNS not configured, or containers not running | Check `docker ps`. If no containers, run `docker compose up -d`. Check DNS at [whatsmydns.net](https://www.whatsmydns.net/) |
| Browser shows "502 Bad Gateway" | LIMS container still starting | Wait 30-60 seconds and refresh. Check `docker logs soilfer-lims --tail 10` |
| Browser shows "Connection refused" on port 3000 | Firewall blocking the port | Run `sudo ufw allow 80 && sudo ufw allow 443` |
| Works by IP but not by domain | DNS not propagated yet | Wait up to 1 hour. Use IP in the meantime. |

## "Docker command not found"

```bash
# Reinstall Docker
curl -fsSL https://get.docker.com | sh
```

## "docker compose" doesn't work

You might have the old separate `docker-compose` tool instead of the newer plugin:

```bash
# Install the compose plugin
sudo apt install docker-compose-plugin

# Or use the old command (with hyphen):
docker-compose up -d   # note the hyphen
```

## "Port 80 already in use"

Another web server is already running:

```bash
# Find what's using port 80
sudo lsof -i :80
```

If it's Apache or NGINX from a previous installation:
```bash
sudo systemctl stop apache2   # if Apache
sudo systemctl stop nginx     # if NGINX
```

Then use the **Scenario B** approach (Part 7) instead.

## "SSL certificate errors"

```bash
# Check certificate status
sudo certbot certificates

# Force renewal
sudo certbot renew --force-renewal

# Restart NGINX after renewal
cd /opt/soilfer-lims
docker compose -f docker-compose.yml -f docker-compose.global.yml restart nginx
```

## "The database is locked"

This means two processes are trying to write to the database at the same time:

```bash
cd /opt/soilfer-lims
docker compose restart
```

## "Prisma client not found" error in logs

```bash
cd /opt/soilfer-lims
docker compose down
docker compose -f docker-compose.yml -f docker-compose.global.yml up -d --build
```

---

# Part 11: Security Best Practices

1. **Always use HTTPS** — follow Part 6 to set up SSL
2. **Change the default password** immediately after first login
3. **Keep your server updated** — run `sudo apt update && sudo apt upgrade -y` monthly
4. **Keep SoilFER-LIMS updated** — `git pull origin main` and rebuild (Part 9.2)
5. **Set up automatic backups** — follow Part 9.1
6. **Use strong passwords** — at least 12 characters, mix of letters, numbers, symbols
7. **Enable a firewall** — allow only the ports you need:
   ```bash
   sudo ufw allow ssh
   sudo ufw allow 80
   sudo ufw allow 443
   sudo ufw enable
   ```
8. **Don't share the admin account** — create individual accounts for each person

---

# Quick Reference Card

## Common Commands

| Action | Command |
|--------|---------|
| Start LIMS | `cd /opt/soilfer-lims && docker compose -f docker-compose.yml -f docker-compose.global.yml up -d` |
| Stop LIMS | `cd /opt/soilfer-lims && docker compose down` |
| Restart LIMS | `cd /opt/soilfer-lims && docker compose restart` |
| View logs | `docker logs soilfer-lims -f --tail 50` |
| Check status | `docker ps` |
| Backup database | `docker exec soilfer-lims node scripts/backup_db.js` |
| Verify backup | `docker exec soilfer-lims node scripts/verify_backup.js /app/server/backups/<file>.db.gz` |
| Restore database | `docker run --rm -v lims-data:/app/server/prisma -v lims-backups:/app/server/backups soilfer-lims-app node scripts/restore_db.js /app/server/backups/<file>.db.gz` |
| Update LIMS | `cd /opt/soilfer-lims && git pull && docker compose down && docker compose up -d --build` |

## Initial Administration Credentials

| Mode | Username | Initial Password | Role |
|------|----------|------------------|------|
| Local | `admin` | `<generated-initial-password>` (printed on startup) | Lab Manager |
| Global | `admin` | `<generated-initial-password>` (printed on startup) | Super Admin |

*Note: Initial password is generated randomly on first seed unless `ADMIN_INITIAL_PASSWORD` is supplied in `.env`. Password change is enforced on first login.*

## Key URLs

| What | URL |
|------|-----|
| Login page | `https://your-domain.com` |
| Health check | `https://your-domain.com/api/health` |
| GitHub repo | `https://github.com/yigini/soilfer-lims` |

---

## Scope & Validation Responsibility

SoilFER-LIMS provides analytical data management tools, calculation routines, and quality record structures. Each adopting laboratory remains responsible for:
- Validating analytical methods, calculations, and instruments prior to reporting operational results.
- Establishing and approving method-specific quality control acceptance thresholds (blanks, duplicates, and reference materials).
- Managing user access controls, role assignments, and password rotation policies according to institutional security standards.
- Ensuring compliance with national, regional, and international laboratory accreditation requirements (such as ISO/IEC 17025).
- Implementing routine off-site database backups and validating disaster recovery procedures.

---

*SoilFER-LIMS is open source software under the MIT License.*
