# Setting Up HTTPS (SSL)

**HTTPS** encrypts the connection between your users' browsers and your server. Without it, everything — including login passwords — travels over the internet in plain text, readable by anyone who intercepts the traffic.

All production websites should use HTTPS. The good news: it's **free** and takes about 5 minutes.

---

## How It Works

**Let's Encrypt** is a free, automated certificate authority run by a nonprofit organization. It provides SSL/TLS certificates at no cost. The tool **Certbot** automates the process of obtaining and renewing these certificates.

> 📖 [What is SSL/TLS? (Cloudflare)](https://www.cloudflare.com/learning/ssl/what-is-ssl/)

---

## For Scenario A (Fresh Server with Docker NGINX)

### Step 1: Install Certbot

```bash
sudo apt install -y certbot
```

### Step 2: Stop the Docker NGINX Temporarily

Certbot needs to briefly use port 80 to verify your domain. Stop the Docker NGINX container:

```bash
cd /opt/soilfer-lims
docker compose -f docker-compose.yml -f docker-compose.global.yml stop nginx
```

### Step 3: Get Your Certificate

Replace `soillab.org` with your actual domain:

```bash
# For a fresh domain:
sudo certbot certonly --standalone -d soillab.org -d www.soillab.org

# For a subdomain:
sudo certbot certonly --standalone -d lims.your-institute.org
```

Certbot will ask for:
1. **Your email address** — for renewal reminders (important!)
2. **Agreement to terms** — type `Y`
3. **Share email with EFF** — your choice, `N` is fine

If successful, you'll see:

```
Congratulations! Your certificate and chain have been saved at:
  /etc/letsencrypt/live/soillab.org/fullchain.pem
```

### Step 4: Update NGINX for HTTPS

```bash
nano /opt/soilfer-lims/deploy/nginx.conf
```

**Replace the entire contents** with this (change `soillab.org` to your domain everywhere it appears):

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

        # WebSocket support for real-time notifications
        proxy_read_timeout 86400;
    }

    # Allow large file uploads (spectral data)
    client_max_body_size 100M;
}
```

### Step 5: Restart Everything

```bash
cd /opt/soilfer-lims
docker compose -f docker-compose.yml -f docker-compose.global.yml up -d
```

### Step 6: Verify

Open **https://soillab.org** in your browser. You should see:
- The SoilFER-LIMS login page
- A **green lock icon** 🔒 in the address bar

---

## For Scenario B (Existing Server NGINX)

SSL setup is simpler because you add it through Certbot's NGINX plugin:

```bash
sudo certbot --nginx -d lims.your-institute.org
```

Certbot handles everything automatically — you just follow the prompts. Done!

---

## Automatic Certificate Renewal

Let's Encrypt certificates are valid for **90 days**. You should set up automatic renewal so you don't have to remember to do it manually.

### For Scenario A

```bash
sudo tee /etc/cron.d/lims-certbot << 'EOF'
0 3 * * 1 root certbot renew --pre-hook "cd /opt/soilfer-lims && docker compose -f docker-compose.yml -f docker-compose.global.yml stop nginx" --post-hook "cd /opt/soilfer-lims && docker compose -f docker-compose.yml -f docker-compose.global.yml start nginx" >> /var/log/certbot-renew.log 2>&1
EOF
```

> This checks every Monday at 3 AM. Certbot only renews if the certificate is within 30 days of expiring.

### For Scenario B

Certbot usually sets up auto-renewal automatically. Verify with:

```bash
sudo certbot renew --dry-run
```

If it says "Congratulations, all simulated renewals succeeded", you're all set.

---

## Troubleshooting SSL

### "Challenge failed" during certificate generation

The most common cause is that your domain doesn't point to the server yet, or a firewall is blocking port 80.

```bash
# Check if port 80 is open
sudo ufw status

# If UFW is active, allow port 80
sudo ufw allow 80
sudo ufw allow 443
```

### Certificate expires (site shows warning)

Force renewal:

```bash
sudo certbot renew --force-renewal
```

Then restart NGINX.

> 📖 **More about Let's Encrypt and Certbot:**
> - [Let's Encrypt — How It Works](https://letsencrypt.org/how-it-works/)
> - [Certbot documentation](https://certbot.eff.org/)
> - [Certbot for Ubuntu + NGINX (step-by-step)](https://certbot.eff.org/instructions?ws=nginx&os=ubuntufocal)
