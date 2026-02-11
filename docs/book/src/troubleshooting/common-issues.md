# Common Problems & Solutions

This page lists the most common problems you might encounter and how to fix them. If your issue isn't listed here, check the logs (`docker logs soilfer-lims --tail 50`) and look for error messages.

---

## The Website Doesn't Load

### Symptom: "This site can't be reached" or "Connection refused"

**Possible causes and solutions:**

1. **Containers aren't running**
   ```bash
   docker ps
   ```
   If no containers are listed, start them:
   ```bash
   cd /opt/soilfer-lims
   docker compose -f docker-compose.yml -f docker-compose.global.yml up -d
   ```

2. **Firewall blocking ports 80/443**
   ```bash
   sudo ufw allow 80
   sudo ufw allow 443
   sudo ufw reload
   ```

3. **DNS not propagated yet** — try accessing by IP instead: `http://YOUR_SERVER_IP`

---

### Symptom: "502 Bad Gateway"

The web server (NGINX) is running, but the LIMS application inside Docker hasn't finished starting yet.

**Solution:** Wait 30-60 seconds and refresh the page.

Check if the container is healthy:
```bash
docker inspect soilfer-lims --format='{{.State.Health.Status}}'
```

If it says `starting`, wait. If it says `unhealthy`, check the logs:
```bash
docker logs soilfer-lims --tail 30
```

---

## Docker Issues

### "docker: command not found"

Docker isn't installed. Install it:
```bash
curl -fsSL https://get.docker.com | sh
```

### "docker compose: command not found"

Install the Docker Compose plugin:
```bash
sudo apt install -y docker-compose-plugin
```

Or try the older syntax with a hyphen: `docker-compose` instead of `docker compose`.

### "Permission denied" when running docker

Add your user to the docker group:
```bash
sudo usermod -aG docker $USER
```

Then log out and log back in.

---

## Port Conflicts

### "Port 80 already in use"

Another web server is running on port 80.

```bash
sudo lsof -i :80
```

If it's Apache:
```bash
sudo systemctl stop apache2
```

If it's NGINX from a previous installation:
```bash
sudo systemctl stop nginx
```

Then use **Scenario B** (add LIMS to your existing web server) instead of **Scenario A**.

### "Port 3000 already in use"

Change the LIMS port in your `.env` file:
```bash
nano /opt/soilfer-lims/.env
```
Change `PORT=3000` to `PORT=3001` (or any available port).

---

## SSL Certificate Issues

### "Certificate expired" browser warning

Force renewal:
```bash
sudo certbot renew --force-renewal
```

Then restart NGINX:
```bash
cd /opt/soilfer-lims
docker compose -f docker-compose.yml -f docker-compose.global.yml restart nginx
```

### "Challenge failed" during certificate setup

Make sure:
1. Your domain's DNS points to this server (check at [whatsmydns.net](https://www.whatsmydns.net/))
2. Port 80 is open in the firewall (`sudo ufw allow 80`)
3. No web server is running on port 80 during the Certbot challenge

---

## Database Issues

### "Database is locked"

This usually means a previous process didn't shut down cleanly.

```bash
cd /opt/soilfer-lims
docker compose restart
```

### "Table not found" or "Column not found"

The database schema might be out of date. Rebuild:
```bash
cd /opt/soilfer-lims
docker compose down
docker compose up -d --build
```

The entrypoint script automatically runs `prisma db push` which updates the schema.

---

## Performance Issues

### The LIMS is slow

1. **Check server resources:**
   ```bash
   htop    # or: top
   ```
   If CPU or RAM is consistently at 100%, consider upgrading your server.

2. **Check disk space:**
   ```bash
   df -h
   ```
   If the disk is full, clean up old Docker images:
   ```bash
   docker system prune -f
   ```

---

## Getting More Help

If none of these solutions work:

1. **Check the logs** — they almost always contain the answer:
   ```bash
   docker logs soilfer-lims --tail 100
   ```

2. **Search or open an issue on GitHub:** [github.com/yigini/soilfer-lims/issues](https://github.com/yigini/soilfer-lims/issues)

3. **Contact the SoilFER team** through the [FAO Global Soil Partnership](https://www.fao.org/global-soil-partnership)
