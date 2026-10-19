# Quick Reference Card

A single-page cheat sheet for laboratory staff and system administrators.

---

## 1. Sample & Work Item Statuses at a Glance

| Status Badge | Where You See It | What It Means | Who Acts Next |
| :--- | :--- | :--- | :--- |
| **`EXPECTED`** | Reception / Kobo | Synced from field survey; physical bag has not yet arrived at the lab | **Reception** (confirm arrival) |
| **`REGISTERED` / `IN_PREP`** | Reception / Prep | Arrived at lab; waiting for Air-Drying (`DRYING`) and Sieving (`PREPARATION`) | **Prep Technician** |
| **`READY_FOR_ANALYSIS`** | Workbench | Pre-analytical gates passed; test work items are unlocked | **Lab Technician** |
| **`IN_PROGRESS`** | Workbench | Assigned to an analytical batch/run; measurements being recorded | **Lab Technician** |
| **`SUBMITTED`** | Review Queue | Technician submitted batch/results for Stage 1 technical review | **Reviewer / Lab Manager** |
| **`REVIEWED`** | Sample Review | Method batch passed Stage 1 review; awaiting whole-sample Stage 2 approval | **Reviewer / Lab Manager** |
| **`NEEDS_REPEAT`** | Workbench | Returned by reviewer (or QC failure) for re-analysis (`R2`, `R3`) | **Lab Technician** |
| **`APPROVED`** | Sample / Reports | Whole sample approved; Reported Values locked; ready for PDF certificate | **Lab Manager / Reviewer** |
| **`REPORTED`** | Reports / Archive | Official PDF Certificate of Analysis issued (`Rev 1+`) | **Client / Archive** |

---

## 2. Common Result Flags & Symbols

| Flag / Symbol | Meaning |
| :--- | :--- |
| **`< LOD`** | Concentration is below the method's Limit of Detection (not detected). |
| **`< LOQ`** | Detected ($\ge \text{LOD}$) but below the Limit of Quantitation when `results.betweenLodLoq = REPORT_LT_LOQ`. |
| **`J`** | Estimated concentration between LOD and LOQ when `results.betweenLodLoq = REPORT_VALUE_FLAGGED`. |
| **`†` (Dagger on PDF)** | On an Amended Report (`Rev 2+`), indicates a result that **changed** compared to the previous revision. |
| **`‡` (Double Dagger on PDF)** | On an Amended Report (`Rev 2+`), indicates a result that was **newly added** in this revision. |

---

## 3. Standard Barcode & Number Prefixes

*(Configurable per laboratory in **Settings → Laboratory Policy**)*

| Code Example | Default Format | What It Identifies |
| :--- | :--- | :--- |
| `CSG-NRL-2026-00015` | `CSG-{LAB}-{YYYY}-{SEQ:5}` | **Consignment**: A shipment or batch of incoming samples |
| `NRL-26-000142C` | `{LAB}-{YY}-{SEQ:6}{CHK}` | **Laboratory Sample Code**: The primary sample accession ID |
| `C-NRL-26-000289K` | `C-{LAB}-{YY}-{SEQ:6}{CHK}` | **Sample Container**: A specific jar, bag, or sub-sample vial |
| `RPT-NRL-2026-00042` | `RPT-{LAB}-{YYYY}-{SEQ:5}` | **Certificate of Analysis**: An official issued PDF report |

---

## 4. Common Server & Maintenance Commands (Administrators)

| Task | Command |
| :--- | :--- |
| **Start LIMS (Global Mode)** | `cd /opt/soilfer-lims && docker compose -f docker-compose.yml -f docker-compose.global.yml up -d` |
| **Start LIMS (Local Single-Lab Mode)** | `cd /opt/soilfer-lims && docker compose up -d` |
| **Stop LIMS** | `cd /opt/soilfer-lims && docker compose down` |
| **Restart LIMS** | `cd /opt/soilfer-lims && docker compose restart` |
| **View live server logs** | `docker logs soilfer-lims -f --tail 50` |
| **Check container status** | `docker ps` |
| **Check application health** | `curl -s http://localhost:3000/api/health` |
| **Create database backup** | `docker exec soilfer-lims node scripts/backup_db.js` |
| **Verify backup integrity** | `docker exec soilfer-lims node scripts/verify_backup.js /app/server/backups/<file>.db.gz` |
| **Restore database backup** | `docker run --rm -v lims-data:/app/server/prisma -v lims-backups:/app/server/backups soilfer-lims-app node scripts/restore_db.js /app/server/backups/<file>.db.gz` |
| **Verify Data Exchange v2** | `docker exec soilfer-lims node scripts/data_exchange_reference_client.cjs --verify` |
| **Reset admin password** | See [Password Reset](../maintenance/password-reset.md) |

---

## 5. Key Server File Locations & Ports

| File / Volume / Port | Purpose |
| :--- | :--- |
| `/opt/soilfer-lims/` | Application root directory on the host server |
| `/opt/soilfer-lims/.env` | Environment variables and secrets |
| `/opt/soilfer-lims/deploy/nginx.conf` | NGINX reverse-proxy and TLS configuration |
| Docker volume `lims-data` | Persistent SQLite database (`prod.db`) |
| Docker volume `lims-assets` | Uploaded spectra, attachments, and logos |
| Docker volume `lims-backups` | Compressed database backup archives (`.db.gz`) |
| **Ports `80` / `443` / `22` / `3000`** | HTTP (`80`), HTTPS (`443`), SSH (`22`), internal app port (`3000`) |
