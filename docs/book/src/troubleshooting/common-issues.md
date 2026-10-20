# Common Problems & Solutions

This troubleshooting guide is divided into two sections:
1. **Everyday Laboratory Workflow Questions** (for Lab Managers, Reviewers, Technicians, and Receptionists)
2. **Server, Docker, Network & Database Troubleshooting** (for IT Administrators)

---

## Part 1: Laboratory Workflow Troubleshooting

### "Why is a sample's test work item locked on the Technician Workbench?"

**Cause**: Pre-analytical preparation gates (`DRYING` at $< 40^\circ\text{C}$ and `PREPARATION` $2\text{ mm}$ sieving) have not been completed yet, or are waiting for second-person verification (`gate.verificationRequired`).

**Solution**:
1. Open the **Preparation & Drying** page (or the **Preparation** tab on the sample).
2. Complete the **Air-Drying (`DRYING`)** and **Crushing & Sieving (`PREPARATION`)** steps (and have a second user verify them if your lab policy requires `gate.verificationRequired = true`).
3. As soon as both gates are marked `COMPLETED`, the bench work items unlock automatically.

---

### "Why does the Batch Builder say an instrument is `BLOCKED` and won't let me start the run?"

**Cause**: The selected instrument is marked `CRITICAL` (or `equipment.requireEquipment` is enforced) and either:
- Its **Calibration Due Date** has passed
- Its **Daily Verification Check** has not been logged today
- It has an open **Fault / Out-of-Service** ticket

**Solution**:
1. Go to **Equipment → Instruments** and select the instrument.
2. Log the current **Calibration Record** or **Daily Verification Check** (or select a backup calibrated instrument for the batch).
3. Once the instrument readiness badge returns to green (`READY`), return to the Batch Builder and start the run.

---

### "Why is the 'Approve Batch' or 'Approve Sample' button disabled for me even though I am a Lab Manager or Reviewer?"

**Cause**: Your laboratory has **Second-Person Review (`review.secondPersonRequired = true`)** enabled (standard in `ISO17025_STRICT` and `BASIC` presets), and you are the person who recorded one or more measurements in that batch or sample.

**Solution**:
- Ask another qualified **Reviewer** or **Lab Manager** to review and approve that batch/sample, or (if your laboratory operates as a single-person facility) adjust `review.secondPersonRequired` in **Settings → Laboratory Policy**.

---

### "A batch QC Blank or CRM failed (`QC_FAIL`), and the Submit/Approve button is blocked. What should I do?"

**Cause**: Your laboratory's `qc.mode` is set to `REQUIRED_BLOCKING`, which prevents unverified results from advancing when a quality control check fails.

**Solution**:
1. Follow the troubleshooting steps in [Quality Control, Control Charts & Failed QC](../usage/qc-management.md):
   - Check for a transcription typo before submission
   - Re-analyze the affected bracket (`REPEAT_BRACKET`) if a mid-run `CCV`/`CCB` drifted
   - Trigger a **Batch Repeat (`REANALYZE_BATCH`)** so new `R2` attempts are created for the unknown samples
   - Or, if a Lab Manager determines the results are scientifically fit for purpose with a documented caveat, record a **Managerial QC Disposition (`ACCEPT_WITH_DEVIATION`)** with a written justification.

---

### "We already issued a PDF Certificate of Analysis (`APPROVED` / `RELEASED`), and now we noticed a misspelled client name or need to re-run a test. Why are the fields locked?"

**Cause**: Once a Certificate of Analysis is issued, the sample is locked to preserve ISO/IEC 17025 report integrity.

**Solution**:
1. Open the sample and click **Amend Sample / Correct Report** (see [Certificates of Analysis, PDF Reports & Amendments](../usage/reporting-pdf.md)).
2. Choose **`CLERICAL`** (for metadata/name corrections) or **`SCIENTIFIC`** (to re-open analytical results; requires a second Reviewer/Manager signature when `report.amendmentRequiresSecondPerson = true`).
3. Make the correction, re-approve the sample, and click **Issue Amended Report** to publish **`Revision 2`** (`Rev 2`).

---

### "An external NSIS harvester received `HTTP 410 Gone (CURSOR_EXPIRED)` from `/api/v2/data-exchange/changes`."

**Cause**: Either more than **72 hours** elapsed since the harvester last polled the change feed, the API key's laboratory permissions were modified, or a database backup restore rotated the synchronization epoch.

**Solution**:
- Do not retry the expired cursor. Run a fresh baseline snapshot via `POST /api/v2/data-exchange/snapshots` (or run `data_exchange_reference_client.cjs --rebaseline-on-410`) to obtain a new starting cursor.

---

## Part 2: Server, Docker, Network & Database Troubleshooting

### The Website Doesn't Load ("Connection refused")

1. **Check if containers are running**:
   ```bash
   docker ps
   ```
   If no containers are listed, start them:
   ```bash
   cd /opt/soilfer-lims
   # Single-lab with NGINX:
   docker compose -f docker-compose.yml -f docker-compose.nginx.yml up -d
   # Or direct port 3000:
   docker compose up -d
   ```
2. **Check firewall ports (`80` and `443`)**:
   ```bash
   sudo ufw allow 80
   sudo ufw allow 443
   sudo ufw reload
   ```
3. **DNS not propagated yet**: Test with `http://YOUR_SERVER_IP:3000` or check [whatsmydns.net](https://www.whatsmydns.net/).

---

### "502 Bad Gateway" from NGINX

The NGINX reverse proxy is running, but the `soilfer-lims` application container is still starting up (or running startup additive migrations).

1. Wait 30–60 seconds and refresh the browser.
2. Check the container health status:
   ```bash
   docker inspect soilfer-lims --format='{{.State.Health.Status}}'
   ```
3. If it reports `unhealthy`, inspect the last 50 log lines:
   ```bash
   docker logs soilfer-lims --tail 50
   ```

---

### Port Conflicts ("Port 80 or 3000 already in use")

- **Port 80 in use**: Another web server (Apache or host NGINX) is already listening on port 80 (`sudo lsof -i :80`). Use **Scenario B** (`docker compose up -d` without `docker-compose.nginx.yml`) and proxy to `http://127.0.0.1:3000` from your existing web server.
- **Port 3000 in use**: Change `PORT=3001` in `/opt/soilfer-lims/.env` and restart (`docker compose up -d`).

---

### SSL Certificate Renewal Issues

If your Let's Encrypt HTTPS certificate expired:
```bash
sudo certbot renew --force-renewal
cd /opt/soilfer-lims
docker compose -f docker-compose.yml -f docker-compose.nginx.yml restart nginx
```

---

### Database Locked or Disk Full

- **"Database is locked"**: Restart the container cleanly so SQLite WAL checkpoints complete:
  ```bash
  cd /opt/soilfer-lims && docker compose restart
  ```
- **Disk space full**: Check free disk space with `df -h` and prune unused Docker build cache/images:
  ```bash
  docker system prune -f
  ```
