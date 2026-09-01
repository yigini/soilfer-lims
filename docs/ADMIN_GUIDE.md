# 🔧 SoilFER-LIMS — Comprehensive Administration Guide

A complete guide for System Administrators and Laboratory Managers configuring, operating, and maintaining SoilFER-LIMS.

---

## 1. First Login & Initial Setup

1. Open your LIMS URL (e.g., `https://lims.your-domain.org` or `http://localhost`).
2. Log in with initial credentials:
   * **Username:** `admin`
   * **Password:** `password`
3. You will be prompted to set a new, strong password (minimum 8 characters with alphanumeric requirements).

---

## 2. Roles & Permissions Matrix (RBAC)

SoilFER-LIMS uses strict, type-safe Role-Based Access Control and multi-tenancy lab isolation:

| Role | Scope | Key Responsibilities |
| :--- | :--- | :--- |
| **`SUPER_ADMIN`** | Global (All Labs) | Manage all physical laboratories, create lab managers, generate SIS API keys, manage global GloSIS catalogs, system backups. |
| **`LAB_MANAGER`** | Single Laboratory (e.g. `GTM-LAB1`) | Assign work items to technicians, review and approve test results, configure laboratory test packages, manage lab equipment and reagents. |
| **`LAB_TECHNICIAN`** | Personal Work Queue | Access personal bench queue ("My Work"), enter test measurements on the Workbench, save autosaving drafts, log instrument usage. |
| **`SAMPLE_RECEPTION`** | Lab Reception Desk | Perform physical sample intake, check compliance/condition, assign generated Lab IDs (e.g. `S001`), print barcode/QR labels. |
| **`PROJECT_MANAGER`** | Project-specific Scope | View sample progress, inspect 3D field coordinates, export project data reports. |

---

## 3. FAO GloSIS & Analytical Methods Configuration

SoilFER-LIMS natively implements the **FAO Global Soil Information System (GloSIS)** code and procedure ontology:

Navigate to **Admin Panel → Lab Configuration** (`/admin?tab=lab-config`):

### A. Analyses & Methods Tab
* **Soil Property (Code):** The canonical soil property code (e.g. `pH`, `carbonOrganic`, `nitrogenTotal`, `pSA`, `exchangeableBases`).
* **Analytical Method (Label):** The exact laboratory procedure from `glosis_procedure.csv` (e.g. `pHH2O_ratio1-2.5`, `OrgC_wc-cro3-walkleyblack`, `pipette-dispersion`).
* **Validation Bounds:** Set realistic minimum and maximum physical thresholds to trigger real-time bench warnings.

### B. Analysis Packages (Suites)
Group individual tests into standard packages for 1-click reception:
* **Basic Soil Fertility Package:** `pH`, `carbonOrganic`, `nitrogenTotal`, `extractableElements`, `exchangeableBases`, `electricalConductivity`.
* **Physical & Texture Properties:** `pSA` (`SAND`, `SILT`, `CLAY`), `bulkDensityWholeSoil`, `soilWaterContent`.
* **Exchangeable Cations & CEC:** `CA_EXCH`, `MG_EXCH`, `K_EXCH`, `NA_EXCH`, `cationExchangeCapacitySoil`.

### C. GloSIS Procedure Explorer
* Live search and explore all **275 official FAO analytical procedures** with definitions, citations (ISO, USDA-NRCS, GLOSOLAN), and URI links.

---

## 4. Machine-to-Machine SIS API & External Data Exchange

To securely exchange soil analytical data with National Soil Information Systems (SIS) or FAO central repositories:

1. Navigate to **Admin Panel → API Keys** (`/admin?tab=api-keys`).
2. Click **Generate New API Key**.
3. Specify a Name (e.g., `National-SIS-Sync-Service`), select the Lab Scope, and set expiration.
4. Use the API Key in the `X-API-Key` HTTP header:

```bash
# Fetch sample results formatted in GloSIS Linked-Data structure:
curl -H "X-API-Key: sis_live_abc123..." https://lims.your-domain.org/api/sis/samples/GTM0236-5-3C-T
```

---

## 5. Field Intake & KoboToolbox Integration

To connect field sampling teams with laboratory reception:

1. Go to **Admin Panel → KoboToolbox Config**.
2. Enter your KoboToolbox Server URL (e.g., `https://kf.soilfer-data.fao.org`) and API Access Token.
3. Select the active survey form.
4. Field records, GPS coordinates, depth layers (D1/D2), and land-feature photos will automatically populate in **Reception**.

---

## 6. Multi-Lingual Customization & Translation Editor

SoilFER-LIMS supports English, Spanish, Latin American Spanish, French, and Portuguese:

1. Navigate to **Admin Panel → Translations** (`/admin?tab=translations`).
2. Select your target language.
3. Edit any UI phrase or localized lab terminology in real time.
4. Click **Save Translations** — changes take effect immediately across all connected users.

---

## 7. Automated Backups & Maintenance

### Schedule an Automated Daily Cron Backup
```bash
# Add to host crontab (crontab -e):
0 2 * * * docker exec -w /app/server soilfer-lims node scripts/backup_db.js
```

Backups are timestamped and saved in `/opt/soilfer-lims/server/backups/`.

---

## 8. Security Checklist for Production

1. ✅ **HTTPS / SSL:** Always terminate TLS using Let's Encrypt / Certbot with HTTP $\rightarrow$ HTTPS redirection.
2. ✅ **JWT Secret:** Ensure `JWT_SECRET` in `.env` is a high-entropy string ($64+$ characters).
3. ✅ **Default Passwords:** Ensure `admin`, `mgr_*`, and `tech_*` accounts have custom passwords.
4. ✅ **Firewall:** Expose only port `80` and `443` externally. Protect SSH with key-based authentication.

