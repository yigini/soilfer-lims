# Backing Up Your Data

SoilFER-LIMS stores all database records in SQLite with Write-Ahead Logging (WAL) enabled.

> [!WARNING]
> **Do not directly copy a live `dev.db` file while the system is running.** Direct file copying while SQLite has active WAL transactions can produce an incomplete or corrupted backup file. Always use the built-in online backup script.

---

## Creating an Online Backup

SoilFER-LIMS includes an online backup script that uses SQLite's transactional backup API to take a non-blocking, consistent snapshot and compress it with gzip:

```bash
# Run the online backup script inside the container
docker exec soilfer-lims node scripts/backup_db.js
```

This creates a compressed backup archive inside the container at:
`/app/server/backups/soilfer_lims_backup_<timestamp>.db.gz`
(stored within the Docker volume `lims-backups`).

### Copying to the Host Server
To copy the generated backup file to host storage:

```bash
mkdir -p /opt/backups
docker cp soilfer-lims:/app/server/backups/ /opt/
```

### Verifying Backup Integrity
Verify that the backup archive decompresses cleanly and passes SQLite `PRAGMA integrity_check`:

```bash
docker exec soilfer-lims node scripts/verify_backup.js /app/server/backups/<backup-filename>.db.gz
```

---

## Automatic Daily Backups

Set up a daily cron job to run the backup script automatically every day at 2 AM UTC:

```bash
# Set up the daily backup cron job
echo '0 2 * * * root docker exec soilfer-lims node scripts/backup_db.js' | sudo tee /etc/cron.d/lims-backup
```

The backup script automatically rotates old backups according to retention policy.

---

## Restoring from a Backup

To restore a database safely without connection conflicts:

```bash
# 1. Stop the application container
cd /opt/soilfer-lims
docker compose stop

# 2. Run the restore utility against the named volume
docker run --rm -v lims-data:/app/server/prisma -v lims-backups:/app/server/backups \
  soilfer-lims-app node scripts/restore_db.js /app/server/backups/<backup-filename>.db.gz

# 3. Start the application container
docker compose start

# 4. Verify system health
curl -f http://localhost/api/health
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
