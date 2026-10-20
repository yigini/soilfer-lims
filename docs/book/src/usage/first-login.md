# First Login & Lab Setup

After your SoilFER LIMS server is running, follow these seven steps to sign in for the first time and configure your laboratory for daily operations.

---

## Step 1: Open SoilFER LIMS in Your Browser

Navigate to your LIMS address:
- `https://soillab.org` (production domain with HTTPS)
- `http://YOUR_SERVER_IP:3000` (direct server IP before DNS/SSL setup)

---

## Step 2: Sign In with the Initial Admin Account

| Field | Value |
| :--- | :--- |
| **Username** | `admin` |
| **Password** | `<generated-initial-password>` (or the value set in `ADMIN_INITIAL_PASSWORD`) |

To view the auto-generated initial password on your server, run:
```bash
docker logs soilfer-lims | grep "INITIAL ADMIN CREDENTIALS" -A 4
```

Click **Sign In**.

---

## Step 3: Change Your Password

On first login, the LIMS requires you to set a new personal password before accessing any screens:
- Use at least **12 characters** mixing uppercase, lowercase, numbers, and symbols.
- Store the password safely in your institution's password manager.

---

## Step 4: Configure Laboratory Identity & Choose a Policy Preset

1. Go to **Settings → Laboratory** to enter your laboratory's official name, code (e.g., `NRL`), physical address, country, timezone, and logo (which appears on PDF Certificates of Analysis).
2. Go to **Settings → Laboratory Policy** and choose the baseline preset that matches your laboratory's quality system:
   - **`ISO17025_STRICT`**: Blocking batch QC, mandatory second-person review, Shewhart control charts, and 5-minute bench idle lock.
   - **`BASIC`**: Routine batch blanks and duplicates with warning enforcement and second-person review.
   - **`ADVISORY`**: Lightweight advisory workflow without mandatory QC blocking.
3. Fine-tune any individual setting (such as sample numbering format `sample.codeFormat`, retention period `sample.retentionDaysAfterReport`, or decimal separator `numbers.decimalSeparator`) and click **Save Policy Changes**.
   *(See [Per-Lab Settings, Presets & Method Overrides](./lab-settings-and-presets.md) for every available option.)*

---

## Step 5: Enable Your Analytical Methods & QC Rules

1. Go to **Settings → Analyses & Methods**.
2. Enable the soil parameters and SOPs your laboratory performs (for example, *pH 1:2.5 Water*, *Walkley–Black Organic Carbon*, *Olsen P*, *Ammonium Acetate Cations*, *Hydrometer Particle Size*).
3. Review or customize the method-level **QC Rules (`QcRule`)** (blank limits, duplicate RPD thresholds, LRM/CRM recovery windows, and repeatability limits $r$) to match your validated laboratory SOPs.

---

## Step 6: Register Instruments, Reference Materials & Staff Accounts

1. **Staff Accounts (`Settings → Users`)**:
   - Create accounts for your **Sample Reception** staff, **Lab Technicians**, **Reviewers**, and **Lab Managers** (see [Roles, Permissions & Separation of Duties](./roles.md)).
   - If your laboratory uses shared tablets or PCs in the wet lab (`bench.pinAtRecord = true`), have each technician set their **4–6 digit Bench PIN** in their user profile.
2. **Instruments (`Equipment → Instruments`)**:
   - Register your analytical balances, pH/EC meters, spectrophotometers, AAS/ICP instruments, and drying ovens along with their calibration due dates and criticality level (`CRITICAL`, `IMPORTANT`, `NON_CRITICAL`).
3. **Reference Materials (`QC → Reference Materials`)**:
   - Register your active **CRM** and **In-House Control (`LRM`)** soil lots and their target analyte concentrations so technicians can select them when building analytical batches.

---

## Step 7: Create Your First Project

1. Go to **Projects → New Project**.
2. Enter the **Project Name**, **Project Code**, optional **Client / Sponsor**, and—if field teams use mobile data collection—configure the **KoboToolbox** form connection.
3. Click **Create**.

Your laboratory is now ready to receive samples! Continue to [The Sample Workflow (End-to-End)](./sample-workflow.md) and [Sample Reception & Intake](./reception-and-intake.md).
