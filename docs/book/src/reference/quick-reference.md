# Quick Reference Card

> *Time:* 2 minutes.
> *Who can do this:* All laboratory staff and IT administrators.

A single-page cheat sheet for daily laboratory statuses, result flags, configurable code patterns, and server maintenance commands.

---

## 1. Key Sample & Test Task Statuses at a Glance

| On-Screen Status Badge | Where You See It | What It Means | Who Acts Next |
| :--- | :--- | :--- | :--- |
| **Expected** | **Sample Reception** / **Projects** | Pre-registered from a field survey or shipping list; the physical bag has not arrived at the counter yet | **Sample Reception Officer** |
| **Received** / **Accepted** | **Sample Reception** | Physical bag inspected and accepted; barcode label ready for drying and preparation | **Sample Reception Officer** / **Laboratory Technician** |
| **Assigned** / **Pending** | **My Work** / **Workbench** | Test task created and waiting for the technician to start | **Laboratory Technician** |
| **In Progress** / **Processing** | **Workbench** | Drying and preparation finished; bench readings actively being entered | **Laboratory Technician** |
| **Submitted** / **Review Pending** | **Manager Task List** | Technician sent the completed batch for review | **Laboratory Manager** / **Quality & Audit Officer** |
| **Returned** / **Redo** | **My Work** / **Workbench** | Reviewer sent the item back for a repeat measurement try | **Laboratory Technician** |
| **Approved** | **Manager Task List** / **Samples** | Approved by reviewer; **Final report value** locked; ready for PDF certificate | **Laboratory Manager** |
| **Published** / **Released** | **Reports** (**Result Reports**) | Official **Certificate of Analysis** PDF issued and ready to download | Client / **Project Manager** |

---

## 2. Common Result Flags & Symbols on Reports

| Symbol or Setting | Plain-Language Meaning |
| :--- | :--- |
| `< LOD` *(below detection limit)* | The nutrient level is below the lowest amount the method can detect (not detected). |
| **< LOQ** *(**Report below quantification limit**)* | The nutrient was detected, but fell below the lowest amount the method can measure reliably (limit of quantification, LOQ) when your lab's **Values between detection and quantification limits** setting is **Report below quantification limit**. |
| *Flagged trace value (**Report value with a flag**)* | Estimated concentration between the detection and quantification limits when your lab's setting is **Report value with a flag**. |
| *Amended result marker on Revision 2+* | On an updated **Certificate of Analysis**, highlights a result that was corrected or newly added compared to the **Replaced by newer version** report along with the **Amended report statement**. |

---

## 3. Barcode & Number Patterns (Configurable per Lab)

All four numbering patterns below are configurable per laboratory in **Policies** (alongside **Sample sequence reset**, **Reset delivery box numbering**, and **Container sequence reset**):

| Setting in Policies | What It Identifies |
| :--- | :--- |
| **Delivery box number format** | A box or delivery of incoming samples checked in together in **Sample Reception** |
| **Sample code pattern** | The main laboratory sample barcode printed on **Standard (101 × 54 mm)** labels |
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
