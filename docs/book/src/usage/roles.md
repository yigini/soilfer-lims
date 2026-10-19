# Roles, Permissions & Separation of Duties

SoilFER LIMS uses **Role-Based Access Control (RBAC)** together with configurable **Separation-of-Duties** rules so that every person in the laboratory sees the screens they need while preventing accidental or unauthorized changes to analytical records.

---

## 1. Overview of Laboratory Roles

| Role | Who Typically Holds It | Main Responsibilities |
| :--- | :--- | :--- |
| **Super Admin (`SUPER_ADMIN`)** | National programme coordinator or IT administrator *(Global multi-lab mode)* | Creates and manages laboratories, manages users across labs, configures branding, and issues/rotates Data Exchange API keys. |
| **Lab Manager / Admin (`LAB_MANAGER` / `ADMIN`)** | Head of laboratory, quality manager, or lab director | Configures laboratory policies and presets, manages lab staff and methods, approves batches and samples, issues and amends Certificates of Analysis, and manages equipment/proficiency testing. |
| **Technical Reviewer (`REVIEWER`)** | Senior chemist or section supervisor | Performs Stage 1 (batch/method) and Stage 2 (whole-sample) technical reviews, selects reported values, returns work items for repeat testing, and co-signs scientific amendments. |
| **Lab Technician (`TECHNICIAN`)** | Bench analyst, wet-chemistry technician, or spectroscopy operator | Performs drying and preparation gates, builds and runs analytical QC batches, records measurements on the workbench or shared bench terminals, performs self-repeats (`R2`), and uploads spectral files. |
| **Sample Reception (`SAMPLE_RECEPTION`)** | Sample intake clerk or reception officer | Registers incoming consignments and walk-in samples, synchronizes KoboToolbox field submissions, records arrival condition and archive storage locations, and prints container barcodes. |
| **Project Manager / Client (`PROJECT_MANAGER` / `CLIENT`)** | Project coordinator, agronomist, or institutional submitter | Tracks sample progress, views approved results and sampling maps, and downloads PDF Certificates of Analysis or CSV/Excel exports (read-only). |

---

## 2. Permission Matrix by Workflow Area

| Action / Screen | Reception | Technician | Reviewer | Lab Manager | Super Admin | Project Manager |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: |
| Register consignments, walk-ins & Kobo intake | ✅ | ❌ | ❌ | ✅ | ✅ | ❌ |
| Print sample & sub-sample container labels | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ |
| Record Drying (`DRYING`) & Prep (`PREPARATION`) gates | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ |
| Build analytical batches & record bench results | ❌ | ✅ | ✅ | ✅ | ✅ | ❌ |
| Trigger self-repeat (`R2`) before batch submission | ❌ | ✅* | ✅ | ✅ | ✅ | ❌ |
| Stage 1 Batch Review & QC Caveat acceptance | ❌ | ❌ | ✅* | ✅* | ✅* | ❌ |
| Stage 2 Sample Approval & Reported Value Selection | ❌ | ❌ | ✅* | ✅* | ✅* | ❌ |
| Issue PDF Certificates of Analysis | ❌ | ❌ | ✅ | ✅ | ✅ | ❌ |
| Authorize Post-Report Sample Amendment | ❌ | ❌ | ✅* | ✅* | ✅* | ❌ |
| Manage Equipment, Reference Materials & PT rounds | ❌ | View / Log | ✅ | ✅ | ✅ | ❌ |
| Change Laboratory Policy Settings & Presets | ❌ | ❌ | ❌ | ✅ | ✅ | ❌ |
| Manage Labs & External NSIS Data Exchange Keys | ❌ | ❌ | ❌ | ❌ | ✅ | ❌ |
| View Dashboards, Maps & Export Approved Data | ❌ | ❌ | ✅ | ✅ | ✅ | ✅ |

*\*Subject to your laboratory's configured Separation-of-Duties policy settings (see Section 3 below).*

---

## 3. Configurable Separation-of-Duties Rules

In accredited laboratories (ISO/IEC 17025), the person who performs a measurement must not be the same person who approves it. Because staffing varies across laboratories, these rules are configurable in **Settings → Laboratory Policy**:

1. **Independent Second-Person Review (`review.secondPersonRequired`)**:
   - **When `true`** *(default in `ISO17025_STRICT` and `BASIC` presets)*: Even if a user holds a Reviewer or Lab Manager role, the LIMS blocks them from reviewing or approving any batch or work item where they recorded the analytical results themselves. A second qualified Reviewer or Lab Manager must approve that work.
   - **When `false`** *(default in `ADVISORY` preset)*: A single Lab Manager in a small 1–2 person lab can both record and approve results.
2. **Second-Person Authorization for Amendments (`report.amendmentRequiresSecondPerson`)**:
   - **When `true`** *(default in `ISO17025_STRICT` and `BASIC` presets)*: Opening a post-report **Scientific Amendment** (`SCIENTIFIC`) on an already-reported sample requires a second Reviewer or Lab Manager to co-sign the amendment request.
3. **Second-Person Verification on Prep Gates (`gate.verificationRequired`)**:
   - Can be enabled independently for **`DRYING`** and **`PREPARATION`** so a supervisor must verify drying temperatures and sieving records before analytical work items unlock.
4. **Shared Bench Terminal PIN Attribution (`bench.pinAtRecord` & `bench.idleLockMinutes`)**:
   - When multiple technicians share a rugged tablet or balance terminal in the wet lab, `bench.pinAtRecord = true` prompts the operator for their personal **4–6 digit PIN** whenever they record a weight, moisture reading, or analytical measurement—ensuring the audit trail always attributes the measurement to the exact individual at the bench.
