# Common Problems & Solutions

This troubleshooting guide is divided into two sections:
1. *Everyday Laboratory Workflow Questions* (for **Laboratory Manager**, **Quality & Audit Officer**, **Laboratory Technician**, and **Sample Reception Officer** staff)
2. *Server, Docker, Network & Database Troubleshooting* (for IT Administrators)

---

## Part 1: Laboratory Workflow Troubleshooting

### 1. Why is a sample's test row locked in Workbench?

*Cause:* Required drying and preparation steps have not been completed yet. They may also be waiting for manager verification when **Require manager verification of preparation gates** is enabled in **Policies**.

*Solution:*
1. Open the sample in **My Work** or **Workbench**.
2. Complete the drying record (**Confirm Complete**) and the sieving or grinding preparation record. Have a manager verify them if required by your laboratory's **Policies**.
3. As soon as preparation is confirmed, the sample status moves from **Accepted** to **Processing**. Bench test rows unlock automatically.

---

### 2. Why does Workbench say an instrument is blocked and won't let me submit the run?

*Cause:* Your laboratory enforces **Required equipment** in **Policies**. The selected instrument either:
- Has a **Service Status** other than **In Service**, or
- Shows **Calibration Overdue / Blocked** under **ISO Readiness** because its **Next Due Date** has passed.

*Solution:*
1. Open **Equipment** (**Equipment & Instruments**) and find the instrument.
2. Click **Log Event / Calibration** to record a current **Calibration** or **Verification** event with a new **Next Due Date**. You can also select a backup calibrated instrument that shows **Ready / Calibrated**.
3. Return to **Workbench** and continue the run.

---

### 3. Why is the Approve button disabled for me even though I am a Laboratory Manager?

*Cause:* Your laboratory has **Require a second reviewer** enabled in **Policies** (switched on by default in **ISO 17025 strict** and **Basic**). You are the person who recorded or submitted one or more measurements in that batch.

*Solution:*
- Ask a second **Laboratory Manager** or **Quality & Audit Officer** to review and click **Approve** in **Manager Task List**. If your facility operates with only one senior reviewer, adjust **Require a second reviewer** in **Policies** with a written **Reason for change**.

---

### 4. A batch Blank, Duplicate, or Reference Soil failed QC, and approval is blocked. What should we do?

*Cause:* Your laboratory's **QC blocking mode** is set to **Required, blocking**. This prevents unverified results in a failed batch from being approved or reported.

*Solution:*
1. Follow the step-by-step decision guide in [Quality Control, Control Charts & Failed QC](../usage/qc-management.md):
   - Check for a typing mistake. Apply a reviewed transcription correction if **Allow reviewed transcription correction of undispositioned failed QC** is enabled in **Policies**.
   - Select **Repeat calibration bracket** if a mid-run calibration check drifted after earlier passing checks.
   - Reject the batch (**Fail batch**) and return the affected samples (**Returned**). Technicians can then record a fresh Attempt 2 in **Workbench**.

---

### 5. We already issued a Certificate of Analysis PDF, and now we need to fix a sample detail or re-run a test. Why are the fields locked?

*Cause:* Once a sample is **Approved** and its **Certificate of Analysis** is issued in **Reports**, all results are locked.

*Solution:*
1. Open the sample or report in **Reports** (**Result Reports**) and start a formal report amendment (see [Lab Manager & QA: Certificates of Analysis, PDF Reports & Amendments](../usage/reporting-pdf.md)).
2. Record the amendment reason. Obtain a second person's co-signature when **Require a second person for amendments** is enabled in **Policies**.
3. Issue the amended report to publish the new revision (**Current**). This automatically marks the previous PDF **Superseded** and retires its old public link.

---

### 6. An external NSIS harvester received HTTP 410 Gone from the Data Exchange change feed

*Cause:* More than 72 hours elapsed since the external harvester last polled the change feed. This also happens if the integration key's **Authorized Scopes** were modified or a database restore rotated the sync epoch.

*Solution:*
- Do not retry the expired cursor. Take a fresh baseline snapshot from the **Data Exchange** snapshots service to obtain a new starting cursor.

---

## Part 2: Server, Docker, Network & Database Troubleshooting (For IT)

### The Website Doesn't Load ("Connection refused")

1. *Check if containers are running:*
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
2. *Check firewall ports (80 and 443):*
   ```bash
   sudo ufw allow 80
   sudo ufw allow 443
   sudo ufw reload
   ```
3. *DNS not propagated yet:* Test with `http://<server-ip>:3000` or check [whatsmydns.net](https://www.whatsmydns.net/).

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

Another web server (such as host Apache or NGINX) is already listening on port 80 or 3000.

```bash
sudo ss -tlnp | grep -E ':(80|443|3000)\s'
```

Either stop the conflicting host service or follow [Scenario B: Existing Server & Subdomain](../deployment/scenario-b.md).
