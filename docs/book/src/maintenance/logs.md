# Checking Logs & Restarting

When something doesn't seem right, logs are your first diagnostic tool. They show you exactly what the application is doing and any errors that occur.

---

## Viewing Logs

### View Recent Logs

```bash
docker logs soilfer-lims --tail 50
```

This shows the last 50 lines of output from the LIMS application.

### Follow Logs in Real Time

```bash
docker logs soilfer-lims -f
```

This shows logs as they happen. Press **Ctrl+C** to stop watching.

### View NGINX Logs (Scenario A only)

```bash
docker logs soilfer-nginx --tail 30
```

---

## Checking Container Status

```bash
docker ps
```

Healthy output looks like:

```
CONTAINER ID   IMAGE              STATUS                   NAMES
abc123...      soilfer-lims-lims  Up 3 days (healthy)      soilfer-lims
def456...      nginx:alpine       Up 3 days                soilfer-nginx
```

If a container is missing from the list, it has stopped. Check why:

```bash
docker logs soilfer-lims --tail 30
```

---

## Restarting

### Simple Restart

```bash
cd /opt/soilfer-lims
docker compose restart
```

### Full Stop and Start

```bash
cd /opt/soilfer-lims
docker compose down

# Scenario A:
docker compose -f docker-compose.yml -f docker-compose.global.yml up -d

# Scenario B:
docker compose up -d
```

---

## Checking Disk Space

If the application suddenly stops working, you might be out of disk space:

```bash
df -h
```

Look at the `Use%` column for your main disk. If it's at 100%, you need to free up space or resize your server's disk.
