# Lab Go-Live Checklist

> *Time:* 45–60 minutes before pilot day one.
> *Who can do this:* Laboratory Administrator and Laboratory Manager / QA Officer.

Use this one-page checklist before you receive your first real box of soil samples. Tick off each item in order. Your reception desk, bench technicians, and reviewers will then work smoothly on day one.

---

## 1. Laboratory Profile, Timezone & Report Branding

- [ ] Open **My Laboratory** (or **Lab Management**) and click the **Settings** tab under **Laboratory Configuration**.
- [ ] Enter your official **Laboratory Name**, **City**, **Physical Address**, **Phone**, and **Contact Email**.
- [ ] Select your local **IANA Timezone** and click **Save Profile Changes**. All reception dates, drying timers, and report timestamps will match your wall clock.
- [ ] Open **Admin Panel** and select the **Branding & Identity** tab.
- [ ] Under **Visual Identity**, click **Upload New** to upload your **Laboratory Logo** (PNG, SVG, or JPG under 2 MB).
- [ ] Under **Organization Details**, fill in **Lab Name (App Title)**, **Organization Legal Name**, **Tagline / Subtitle**, **Contact Email**, and **Footer Text**. Choose your **Default Language** and **Date Format**, then click **Save**.
- 👉 *Step-by-step guide:* [Set Up Your Laboratory Profile, Report Branding, and Support Contact](./lab-profile-and-branding.md)

---

## 2. Support Contact Set in the App

- [ ] Confirm that the **Contact Email** saved under **Branding & Identity** in **Admin Panel** is monitored by your pilot coordinator or laboratory administrator.
- [ ] Sign out briefly and check the bottom of the **Sign in to SoilFER LIMS** screen and the **Forgot password?** window (**Password Reset Instructions**). Verify that your support email appears clearly for staff.
- [ ] If your laboratory wants local contact notes inside specific help guides, open the Help Centre editor and save a laboratory note.
- 👉 *Step-by-step guides:* [Set Up Your Laboratory Profile, Report Branding, and Support Contact](./lab-profile-and-branding.md) and [Getting Help](../start/getting-help.md)

---

## 3. Staff Accounts Created & Signed In Once

- [ ] Open **Laboratory Staff** (or the **People & Access** tab in **My Laboratory**).
- [ ] Create an individual account for every reception clerk, bench technician, reviewer, and manager using **Invite Team Member** (which generates a **One-Time Activation Link**) or **Add User**.
- [ ] Verify that every person is assigned to the right **System Role** and **Assigned Laboratory**.
- [ ] Have each team member sign in once on their own computer or tablet. Ask them to set their personal **New Password** (at least 12 characters) and choose their **Preferred Language**.
- [ ] Confirm that no two people share a login. Make sure at least two people hold manager or reviewer permissions if your laboratory uses two-person review.
- 👉 *Step-by-step guide:* [Create Staff Accounts, Assign Roles, and Reset Passwords](./manage-users-and-roles.md)

---

## 4. Quality Preset Chosen & Policies Checked by QA

- [ ] Open **Policies** for your laboratory.
- [ ] Choose the **Starting rule set** that matches your current phase (**ISO 17025 strict**, **Basic**, or **Advisory**). Enter a **Reason for change**, and click **Save starting rule set**.
- [ ] Review key whole-laboratory settings with your QA Officer:
  - *Number format:* Check **Decimal separator** and **Thousands separator** so pasted spreadsheet numbers parse cleanly.
  - *Numbering & retention:* Check **Sample code pattern**, **Delivery box number format**, **Report number pattern**, and **Sample retention after report**.
  - *Bench & review rules:* Check **Allow technician repeat before submission**, **Require a second reviewer**, **Require a second person for amendments**, **Idle bench lock (0: off)**, and **Require PIN when recording**.
- 👉 *Step-by-step guide:* [Choose a Quality Preset and Customize Laboratory Policies](./configure-presets-and-policies.md)

---

## 5. Analytical Methods Switched On & QC Rules Verified

- [ ] Open **Admin Panel** and click **Analysis Configuration**.
- [ ] Under **Test Methods**, confirm that every soil parameter your laboratory will run during the pilot is **Active**. Check its **Reporting Unit**, **Plausible Minimum**, **Plausible Maximum**, and **Display Decimals**.
- [ ] Under **Analysis Packages**, click **Create Analysis Package** to create your lab's analysis packages. The standard GLOSOLAN analysis catalogue is loaded on install, and each laboratory creates its own packages for reception clerks to select in one click.
- [ ] Open **Laboratory Methodology Defaults** and confirm the **Active Methodology** for each parameter in your laboratory, then click **Save Defaults**.
- [ ] Open **Policies**, select each active analysis and method under **Custom rules per test or method**, and verify its **Versioned QC rules** with your QA Officer. Check **Blanks per batch**, **Duplicate interval**, **Laboratory reference materials per batch** (how many laboratory reference materials (your lab's own in-house check soils) to include per batch), **Certified reference material interval** (how often to include a certified reference material (official standard soil with a certified value)), and acceptance windows.
- 👉 *Step-by-step guide:* [Switch On Analytical Methods, Calculations, and QC Rules](./enable-methods-and-qc-rules.md)

---

## 6. Equipment Registered with Calibration Dates

- [ ] Open **Equipment** (**Equipment & Instruments**).
- [ ] Click **Register New Asset** for each balance, drying oven, pH/EC meter, spectrophotometer, flame photometer, AAS, ICP, or FTIR/NIR spectrometer used on the bench.
- [ ] Record the **Instrument Name**, **Internal Asset Tag**, **Instrument Type**, **Room / Bench Location**, and **Service Status** (**In Service**).
- [ ] Click **Log Event / Calibration** on each instrument to record its **Last Calibration** and **Next Due Date**. Make sure its **ISO Readiness** badge shows **Ready / Calibrated** so it does not block bench runs when **Required equipment** is enforced.
- 👉 *Step-by-step guide:* [Register Instruments, Log Calibrations, and Track Reagent Stock](./register-equipment-and-inventory.md)

---

## 7. Reference Materials, Assigned Values & Reagent Lots Entered

- [ ] Open **Admin Panel** and click the **Quality** tab (**Reference materials**).
- [ ] Click **Add reference lot** for every **Certified reference material (CRM)** (official standard soil with a certified value) and in-house **Laboratory reference material (LRM)** (your lab's own in-house check soil) check soil used on your benches. Confirm its status is **Active**.
- [ ] Under **Assigned values by analyte**, click **Add assigned value** for each parameter the reference soil controls. Enter the **Assigned value**, **Unit**, **Expanded uncertainty**, **Certificate coverage factor (k)**, and **Value type** (**Certified** or **Lab assigned**).
- [ ] Open **Inventory** (**Reagents & Inventory**) and click **Add Inventory Item** to log key reagents, standards, and expiration dates.
- 👉 *Step-by-step guide:* [Register Instruments, Log Calibrations, and Track Reagent Stock](./register-equipment-and-inventory.md)

---

## 8. Label Printer Tested & Practice Sample Run End to End

- [ ] Receive one test sample at **Sample Reception** (using a clearly marked practice project).
- [ ] Click **Print labels** and test both **Standard (101 × 54 mm)** and **Compact (50 × 25 mm)** layouts on your label printer. Check that your USB or camera barcode scanner reads the printed code back into the search box.
- [ ] Complete the drying and preparation checklists, enter a test bench run with a **Blank**, **Duplicate**, and **Control**, and submit it.
- [ ] Approve the test run in **Manager Task List** and generate a **Certificate of Analysis** PDF in **Reports**.
- [ ] Inspect the printed or downloaded PDF to confirm your **Laboratory Logo**, **Laboratory Name**, units, and QR verification code look right.
- 👉 *Step-by-step guides:* [Print and Reprint Barcode Labels](../reception/print-and-reprint-labels.md) and [Lab Manager & QA: Certificates of Analysis, PDF Reports & Amendments](../usage/reporting-pdf.md)

---

## 9. Server Backups & HTTPS Confirmed by IT

- [ ] Confirm with your IT administrator that your server is running over HTTPS with a valid SSL certificate.
- [ ] Confirm that automated daily database and file backups are scheduled. Make sure at least one test restore has been verified before live samples arrive.
- 👉 *Step-by-step guides:* [Setting Up HTTPS (SSL)](../security/ssl.md) and [Backing Up Your Data](../maintenance/backups.md)

---

### For the QA Person

- *Traceable readiness:* Completing this checklist satisfies pre-commission verification for personnel authorizations, equipment calibration status, reference material traceability, and quality control rules before live client samples enter the system.
- *Audit history:* Every policy change, method default update, reference material entry, and user role assignment performed during go-live setup is permanently logged in **Change history** and **Audit & Security**.
