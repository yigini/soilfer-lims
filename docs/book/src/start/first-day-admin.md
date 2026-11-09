# Your First Day as a Laboratory Administrator

## What This Is For

Set up your laboratory in SoilFER LIMS before your team starts live testing. In many soil laboratories, the Laboratory Manager also wears the Laboratory Administrator hat.

---

## Before You Start

- Sign in with your initial administrator or **Laboratory Manager** account on the **Sign in to SoilFER LIMS** screen.
- Complete the **Security Update Required** window on first sign-in by setting a personal password of at least 12 characters and clicking **Update & Access System**.
- Have your laboratory's official name, logo image, list of staff members, active analytical methods, instruments, and reference soil certificates ready.

---

## Steps

### Step 1: Set Up Your Laboratory Identity and Branding

1. Click **My Laboratory** (or **Lab Management**) in the left menu.
2. Enter your laboratory's official name, short code, physical address, country, and time zone, then click **Save**.
3. Click **Admin Panel** in the left menu and open **Branding** to upload your laboratory logo so it appears on the top bar and on printed PDF Certificates of Analysis.

### Step 2: Choose Your Laboratory Quality Rules

1. Click **Policies** in the left menu.
2. Choose the quality preset that matches how your laboratory works, and adjust any individual setting (such as **Maximum analytical batch size**, **Blanks per batch**, **Duplicate interval**, or **Minimum new password length**).
   *Your laboratory decides its own batch size and quality control rules (many laboratories use 20 samples per batch; see [Per-Lab Settings, Presets & Method Overrides](../usage/lab-settings-and-presets.md)).*
3. Click **Save** and enter a brief note describing your policy update.

### Step 3: Switch On Analytical Methods and Check Limits

1. Open **Admin Panel** and click **Analysis Configuration** (or open your laboratory's methods page).
2. Enable the soil tests your laboratory performs (such as pH, electrical conductivity, organic carbon, extractable phosphorus, exchangeable cations, and particle size).
3. Check the method quality control rules (**Maximum blank value**, **Minimum control recovery**, **Maximum control recovery**, and **Maximum duplicate RPD**) so they match your laboratory's validated standard operating procedures.

### Step 4: Register Equipment, Reference Soils, and Staff Accounts

1. Click **Equipment** in the left menu and click **Register New Asset** to add each balance, pH meter, spectrophotometer, and drying oven.
2. For each instrument, click **Log Event / Calibration** to record its **Last Calibration** and **Next Due Date** so its **ISO Readiness** shows **Ready / Calibrated**.
3. Register your active reference soil lots (**Reference Standards (CRM)** and in-house control soils) with their target values so technicians can bind them when starting a run.
4. Click **Laboratory Staff** in the left menu and click **Add User** to create an account for each reception clerk, technician, reviewer, and manager:
   - Fill in **Full Name**, **Username**, **Email Address**, **System Role**, **Assigned Laboratory**, and a **Temporary Password** of at least 12 characters.
   - Give each staff member their username and temporary password so they can sign in and set their own personal password.

### Step 5: Run One End-to-End Practice Test

1. Follow the [Lab Go-Live Checklist](../admin/go-live-checklist.md) to receive one practice sample in **Sample Reception**, print a test barcode label, record a practice run in **Workbench**, approve it in **Manager Task List**, and download the test PDF in **Reports**.

---

## What Happens Next

Your laboratory is ready for staff training and pilot launch! Open the [Lab Go-Live Checklist](../admin/go-live-checklist.md) and [Pilot Launch Kit](../launch/index.md) to run your team's training sessions.

---

## If Something Goes Wrong

- **If a staff member forgets their password or is paused after several wrong tries →** Open **Laboratory Staff**, find their row, click **Reset Password**, and give them the new **Temporary Password**. They will be prompted to choose a new 12-character password on their next sign-in.
- **If an instrument shows Calibration Overdue / Blocked at the bench →** Open **Equipment**, select the instrument, and click **Log Event / Calibration** to record the latest calibration date.
- **If a policy change warns of a conflict with a method rule →** Check the highlighted method rule in **Policies** or **Analysis Configuration** so the method has complete limits before enabling blocking quality control.

---

## For the QA Person

- All changes to **Policies**, **Analysis Configuration**, **Equipment**, and **Laboratory Staff** are versioned and recorded in the audit log with the administrator's name and timestamp.
- Updating a laboratory policy or method rule applies only to new runs started after the change; historical runs and issued **Reports** keep the exact rules that were active when they were recorded.
