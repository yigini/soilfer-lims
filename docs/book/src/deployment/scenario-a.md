# Scenario A: Fresh Server & Domain

*This scenario is for you if you have a brand-new server with nothing else running on it, and a domain name (either new or a subdomain) that you want to use for SoilFER-LIMS.*

> **Prerequisites:** Make sure you've completed:
> - [Preparing Your Server](../installation/prepare-server.md) (Docker + Git installed)
> - [Downloading SoilFER-LIMS](../installation/download.md)
> - [Configuration](../installation/configuration.md) (.env file created)
> - [DNS Setup](../installation/dns.md) (domain pointing to your server)

---

## A1: Configure NGINX with Your Domain

Before starting the application, tell the web server about your domain:

```bash
cd /opt/soilfer-lims
nano deploy/nginx.conf
```

Find this line near the top:

```
server_name _;
```

The `_` is a placeholder. Replace it with your actual domain name:

```nginx
# For a fresh domain:
server_name soillab.org www.soillab.org;

# For a subdomain:
server_name lims.your-institute.org;
```

Save (**Ctrl+O**, **Enter**) and exit (**Ctrl+X**).

---

## A2: Start SoilFER-LIMS

Run this single command to start everything:

```bash
cd /opt/soilfer-lims
docker compose -f docker-compose.yml -f docker-compose.global.yml up -d
```

> **What does this command do?**
> - `docker compose up` — builds and starts the application
> - `-f docker-compose.yml -f docker-compose.global.yml` — uses both the base config and the NGINX web server config
> - `-d` — runs in "detached" mode (background), so it keeps running after you close the terminal

### What Happens During First Boot

The first time you run this, Docker performs several steps automatically:

1. **Downloads** the Node.js base image from the internet (~150 MB)
2. **Installs** all application dependencies (libraries the app needs)
3. **Builds** the React frontend (compiles the user interface)
4. **Creates** the SQLite database and its tables
5. **Seeds** the database with a default admin account
6. **Starts** the web server and NGINX

**This takes 3–5 minutes the first time.** Subsequent starts take only a few seconds because everything is already built.

You'll see output like:
```
[+] Building 180.3s (17/17) FINISHED
[+] Running 2/2
 ✔ Container soilfer-lims   Started
 ✔ Container soilfer-nginx  Started
```

---

## A3: Verify It's Working

### Check Container Status

```bash
docker ps
```

You should see **two containers** running:

```
CONTAINER ID   IMAGE              STATUS                    NAMES
abc123...      soilfer-lims-lims  Up 2 min (healthy)        soilfer-lims
def456...      nginx:alpine       Up 2 min                  soilfer-nginx
```

The important thing is that `soilfer-lims` shows `(healthy)` in the status. If it says `(health: starting)`, wait another 30 seconds and check again.

### Test the API

```bash
curl http://localhost/api/health
```

You should see:
```json
{"status":"ok","uptime":45,"mode":"local"}
```

### Open in Your Browser

Go to **http://soillab.org** (or whatever your domain is) in your web browser.

If DNS hasn't propagated yet, you can use your server's IP directly: **http://YOUR_SERVER_IP**

You should see the SoilFER-LIMS login page! 🎉

---

## A4: First Login

| Field | Value |
|-------|-------|
| **Username** | `admin` |
| **Password** | `password` |

You will be **immediately prompted to change your password**. Choose a strong password (at least 12 characters, with a mix of letters, numbers, and symbols) and remember it or store it securely.

---

## A5: Add HTTPS (Strongly Recommended)

At this point your site works, but it uses plain HTTP — which means data (including passwords) travels unencrypted between users' browsers and your server. You should add HTTPS to secure the connection.

→ Continue to [Setting Up HTTPS (SSL)](../security/ssl.md)

---

## Troubleshooting

### Nothing loads in the browser

Check if the containers are running:
```bash
docker ps
```

If they're not listed, check the logs:
```bash
docker compose -f docker-compose.yml -f docker-compose.global.yml logs --tail 30
```

### "502 Bad Gateway"

This means NGINX is running but the LIMS container hasn't finished starting. Wait 30-60 seconds and refresh.

### The site loads on the IP but not on the domain

DNS hasn't propagated yet. Wait up to 1 hour, or check at [whatsmydns.net](https://www.whatsmydns.net/).
