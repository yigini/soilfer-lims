# Quick Reference Card

> *Time:* 2 minutes.
> *Who can do this:* All laboratory staff and IT administrators.

A single-page cheat sheet for daily laboratory statuses, result qualifiers, configurable code formats, and server maintenance commands.

---

## 1. Key Sample & Work Item Statuses at a Glance

| On-Screen Status Badge | Where You See It | What It Means | Who Acts Next |
| :--- | :--- | :--- | :--- |
| **Expected** | **Sample Reception** / **Projects** | Pre-registered from field survey or manifest; physical bag has not arrived at the counter yet | **Sample Reception Officer** |
| **Received** / **Accepted** | **Sample Reception** | Physical bag inspected and accepted; barcode label ready for drying and preparation | **Sample Reception Officer** / **Laboratory Technician** |
| **Assigned** / **Pending** | **My Work** / **Workbench** | Test task created and waiting for the technician to start | **Laboratory Technician** |
| **In Progress** / **Processing** | **Workbench** | Drying and preparation finished; bench measurements actively being recorded | **Laboratory Technician** |
| **Submitted** / **Review Pending** | **Manager Task List** | Technician submitted the batch for review | **Laboratory Manager** / **Quality & Audit Officer** |
| **Returned** / **Redo** | **My Work** / **Workbench** | Reviewer returned the item for a repeat attempt (Attempt 2, Attempt 3) | **Laboratory Technician** |
| **Approved** | **Manager Task List** / **Samples** | Approved by reviewer; **Reported value** locked; ready for PDF certificate | **Laboratory Manager** |
| **Published** / **Released** | **Reports** (**Result Reports**) | Official **Certificate of Analysis** PDF issued and ready to download | Client / **Project Manager** |

---

## 2. Common Result Qualifiers & Symbols on Reports

| Qualifier | Plain-Language Meaning |
| :--- | :--- |
| *Below detection limit (< LOD)* | Concentration is below the method's detection limit (not detected). |
| **< LOQ** *(**Report below quantification limit**)* | Analyte was detected, but fell below the method's quantification limit when your laboratory's **Values between detection and quantification limits** policy is set to **Report below quantification limit**. |
| *Flagged trace value (**Report value with a flag**)* | Estimated concentration between detection and quantification limits when your laboratory's policy is set to **Report value with a flag**. |
| *Amended result marker on Revision 2+* | On an amended **Certificate of Analysis**, highlights a result that was updated or newly added compared to the **Superseded** revision along with the **Amended report statement**. |

---

## 3. Barcode & Number Patterns (Configurable per Lab)

All four numbering patterns below are configurable per laboratory in **Policies** (alongside **Sample sequence reset**, **Restart consignment numbering**, and **Container sequence reset**):

| Setting in Policies | What It Identifies |
| :--- | :--- |
| **Consignment number format** | A shipment or box of incoming samples registered together in **Sample Reception** |
| **Sample code pattern** | The primary laboratory sample barcode printed on **Standard (101 × 54 mm)** labels |
| **Container code format** | A specific sub-sample jar, fine-earth bag, or spectroscopy vial printed on **Compact (50 × 25 mm)** labels |
| **Report number pattern** | An official issued **Certificate of Analysis** PDF in **Reports** |

---

## 4. Common Server & Maintenance Commands (For IT Administrators)

| Task | Command |
| :--- | :--- |
| *Start LIMS (Global Multi-Lab Mode)* | `cd /opt/soilfer-lims && docker compose -f docker-compose.yml -f docker-compose.global.yml up -d` |
| *Start LIMS (Local Single-Lab Mode)* | `cd /opt/soilfer-lims && docker compose up -d` |
| *Stop LIMS* | `cd /opt/soilfer-lims && docker compose down` |
| *Restart LIMS* | `cd /opt/soilfer-lims && docker compose restart` |
| *View live server logs* | `docker logs soilfer-lims -f --tail 50` |
| *Check container status* | `docker ps` |
| *Check application health* | `curl -s http://localhost:3000/api/health` |
| *Create online database backup* | `docker exec soilfer-lims node scripts/backup_db.js` |
| *Verify backup archive integrity* | `docker exec soilfer-lims node scripts/verify_backup.js /app/server/backups/<file>.db.gz` |
| *Restore database backup* | `docker run --rm -v lims-data:/app/server/prisma -v lims-backups:/app/server/backups soilfer-lims-app node scripts/restore_db.js /app/server/backups/<file>.db.gz` |
| *Reset admin password* | See [Resetting the Admin Password](../maintenance/password-reset.md) |
