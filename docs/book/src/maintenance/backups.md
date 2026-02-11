# Backing Up Your Data

All your LIMS data — samples, results, users, settings — is stored in a single SQLite database file called `dev.db`. Backing it up is as simple as copying that file.

---

## Manual Backup

Copy the database file from the Docker container to your server:

```bash
# Create a backup directory (first time only)
mkdir -p /opt/backups

# Create a backup with today's date
docker cp soilfer-lims:/app/server/prisma/dev.db /opt/backups/lims-$(date +%Y%m%d).db
```

This creates a file like `/opt/backups/lims-20260211.db`.

> 💡 **How often should you back up?** At minimum, back up before any system update. For active labs, daily backups are recommended.

---

## Automatic Daily Backups

Set up a cron job (scheduled task) to back up automatically every day at 2 AM:

```bash
# Create the backup directory
mkdir -p /opt/backups

# Set up the daily backup
echo '0 2 * * * root docker cp soilfer-lims:/app/server/prisma/dev.db /opt/backups/lims-$(date +\%Y\%m\%d).db' | sudo tee /etc/cron.d/lims-backup

# Also clean up backups older than 30 days (to save disk space)
echo '0 3 * * * root find /opt/backups -name "lims-*.db" -mtime +30 -delete' | sudo tee -a /etc/cron.d/lims-backup
```

---

## Restoring from a Backup

If something goes wrong and you need to restore:

```bash
# Stop the application
cd /opt/soilfer-lims
docker compose down

# Copy the backup into the container's data volume
docker cp /opt/backups/lims-20260210.db soilfer-lims:/app/server/prisma/dev.db

# Start the application
docker compose up -d
```

---

## Backing Up Uploaded Files

If your lab uploads spectral data, field photos, or other files, back those up too:

```bash
docker cp soilfer-lims:/app/server/uploads /opt/backups/uploads-$(date +%Y%m%d)
```

---

## Off-Site Backups (Recommended)

Keeping backups only on the same server is risky — if the server's disk fails, you lose both the database and the backups. Consider copying backups to another location:

- **Download to your computer:** `scp root@YOUR_SERVER_IP:/opt/backups/lims-20260211.db ./`
- **Copy to cloud storage:** Use tools like `rclone` to sync backups to Google Drive, Dropbox, or S3
- **Copy to another server:** Use `rsync` or `scp`

> 📖 [How to use SCP to transfer files (DigitalOcean)](https://www.digitalocean.com/community/tutorials/how-to-use-scp-command-to-securely-transfer-files)
