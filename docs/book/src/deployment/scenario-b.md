# Scenario B: Existing Server & Subdomain

*This scenario is for you if your server already runs other websites or services (such as a main institutional website), and you want to add SoilFER-LIMS as a new subdomain (like `lims.your-institute.org`) alongside the existing sites.*

The key difference from Scenario A is that **your server already has NGINX or Apache running** on ports 80 and 443, so we can't start a second web server on those ports. Instead, we'll add LIMS as a new site in your existing web server configuration.

> **Prerequisites:** Make sure you've completed:
> - [Preparing Your Server](../installation/prepare-server.md) (Docker + Git installed)
> - [Downloading SoilFER-LIMS](../installation/download.md)
> - [Configuration](../installation/configuration.md) (.env file created)
> - [DNS Setup](../installation/dns.md) (subdomain pointing to your server)

---

## B1: Start LIMS Without the Built-in NGINX

Use only the **base** Docker Compose file — this starts LIMS on port 3000 without its own NGINX:

```bash
cd /opt/soilfer-lims
docker compose up -d
```

> **Why not use the global override?** Because `docker-compose.global.yml` starts its own NGINX container on ports 80/443, which would conflict with the NGINX already running on your server.

Verify it's running:

```bash
docker ps
curl http://localhost:3000/api/health
```

You should see one container (`soilfer-lims`) and a health response.

---

## B2: Add LIMS to Your Existing NGINX

Now tell your server's existing NGINX to forward requests for `lims.your-institute.org` to the LIMS application on port 3000.

### Create a New Site Configuration

```bash
sudo nano /etc/nginx/sites-available/lims.your-institute.org
```

Paste the following (replace `lims.your-institute.org` with your actual subdomain):

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

        # WebSocket support (needed for real-time notifications)
        proxy_read_timeout 86400;
    }

    # Allow large file uploads (spectral data files can be big)
    client_max_body_size 100M;
}
```

> **What does this do?** It tells NGINX: "When someone visits `lims.your-institute.org`, forward their request to the LIMS application running on port 3000. Also handle WebSocket connections (used for real-time features like notifications)."

### Enable the Site

```bash
# Create a symbolic link to enable the site
sudo ln -s /etc/nginx/sites-available/lims.your-institute.org /etc/nginx/sites-enabled/

# Test the configuration for errors
sudo nginx -t
```

If you see `syntax is ok` and `test is successful`, reload NGINX:

```bash
sudo systemctl reload nginx
```

---

## B3: Test It

Open your browser and go to **http://lims.your-institute.org**

You should see the SoilFER-LIMS login page! 🎉

Log in with:
- **Username:** `admin`
- **Password:** `<generated-initial-password>` (check startup logs with `docker logs soilfer-lims | grep "INITIAL ADMIN CREDENTIALS" -A 4`)

---

## B4: Add SSL (HTTPS)

If your server already uses Certbot (which is likely if it hosts other HTTPS websites), adding SSL is a single command:

```bash
sudo certbot --nginx -d lims.your-institute.org
```

Certbot will automatically:
1. Verify you own the domain
2. Obtain an SSL certificate from Let's Encrypt
3. Update your NGINX configuration to use HTTPS
4. Set up automatic certificate renewal

Visit **https://lims.your-institute.org** — you should see the green lock icon! 🔒

> **If Certbot isn't installed yet:**
> ```bash
> sudo apt install -y certbot python3-certbot-nginx
> sudo certbot --nginx -d lims.your-institute.org
> ```

---

## B-alt: Using Apache Instead of NGINX

If your server uses **Apache** instead of NGINX, the process is slightly different:

### Enable Required Apache Modules

```bash
sudo a2enmod proxy proxy_http proxy_wstunnel rewrite ssl headers
```

### Create a Virtual Host

```bash
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

### Enable and Reload

```bash
sudo a2ensite lims.your-institute.org.conf
sudo systemctl reload apache2
```

### Add SSL with Apache

```bash
sudo apt install -y certbot python3-certbot-apache
sudo certbot --apache -d lims.your-institute.org
```

---

## Important: Change the Port if Needed

If port 3000 is already used by another application on your server, you can change it:

1. Edit your `.env` file:
   ```bash
   nano /opt/soilfer-lims/.env
   ```
   Change `PORT=3000` to another port (e.g., `PORT=3001`)

2. Update your NGINX/Apache config to proxy to the new port

3. Restart:
   ```bash
   cd /opt/soilfer-lims && docker compose up -d
   sudo systemctl reload nginx  # or apache2
   ```

---

## Your Existing Sites Are Not Affected

Adding SoilFER-LIMS as a new site in NGINX/Apache does **not** affect your other websites. Each site has its own configuration file and responds only to its own domain/subdomain. Your main website at `your-institute.org` continues to work exactly as before.
