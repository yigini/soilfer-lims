# First Login & Lab Setup

> *Time:* 5 minutes.
> *Who can do this:* Every laboratory user signing in for the first time, and Laboratory Administrators.

When you open your laboratory's SoilFER LIMS address in a web browser, you see the **Sign in to SoilFER LIMS** page. This guide shows you how to sign in, pick your language and theme, and set your personal password.

---

## Before You Start

- Have your web address and either a one-time invitation link or your **Username** and **Temporary Password** ready.
- Use a modern web browser on your computer or tablet.

---

## Steps: Signing In and Choosing Your Preferences

### Step 1: Pick your language on the sign-in screen

1. Look at the language pill bar in the top-right corner of the **Sign in to SoilFER LIMS** screen.
2. Click your preferred language (**English**, **Español**, **Español (América Latina)**, **Français**, or **Português**).

### Step 2: Sign in and set your personal password

1. If you received a **One-Time Activation Link**, open that link in your browser. Choose a personal password that meets your laboratory's **Minimum new password length** policy (at least 12 characters by default).
2. If you received a **Username** and a **Temporary Password**, enter both on the **Sign in to SoilFER LIMS** screen and click **Sign In**.
3. When you sign in with a temporary password, the screen asks you to set a new personal password before entering the workspace.
4. You can change your password later at any time. Click your name in the top bar, open the **Security** tab under **Change Password**, fill in **Current Password**, **New Password**, and **Confirm New Password**, and click **Update Password**.

### Step 3: Save your personal language and appearance preferences

1. Click your name in the top-right corner to open your profile page, then select the **Appearance** tab.
2. Under **Account appearance preference**, choose a theme from the **Theme Library** and pick **Light** or **Dark · Graphite** under **Display Mode**, then click **Save for me**.
3. Under **Preferred Language**, select your language and click **Save language preference**.

*(Screenshot placeholder: laboratory setup and policy screen — screenshot coming once the training data is ready)*

---

## First-Time Setup Order for Laboratory Administrators

If you are setting up a new laboratory for the first time, follow these five steps in order (or open the [Lab Go-Live Checklist](../admin/go-live-checklist.md)):

1. *Set up your laboratory identity and branding:* Open **My Laboratory** (or **Lab Management**) and click the **Settings** tab to fill in your **Laboratory Name**, **City**, **IANA Timezone**, and **Contact Email**. Then open **Admin Panel** and **Branding & Identity** to upload your **Laboratory Logo**. See [Set Up Your Laboratory Profile, Report Branding, and Support Contact](../admin/lab-profile-and-branding.md).
2. *Choose your quality preset and policies:* Open **Policies** to pick **ISO 17025 strict**, **Basic**, or **Advisory** and review your laboratory's rules. See [Choose a Quality Preset and Customize Laboratory Policies](../admin/configure-presets-and-policies.md).
3. *Switch on your analytical methods and QC rules:* Open **Admin Panel** and **Analysis Configuration** (plus **Laboratory Methodology Defaults**) to confirm your active tests, units, and **Versioned QC rules**. See [Switch On Analytical Methods, Calculations, and QC Rules](../admin/enable-methods-and-qc-rules.md).
4. *Register instruments, reference materials, and stock:* Open **Equipment**, **Inventory**, and **Reference materials** under **Quality** to register your balances, meters, and reference soils. See [Register Instruments, Log Calibrations, and Track Reagent Stock](../admin/register-equipment-and-inventory.md).
5. *Invite your laboratory team:* Open **Laboratory Staff** to create accounts for your receptionists, technicians, and reviewers. See [Create Staff Accounts, Assign Roles, and Reset Passwords](../admin/manage-users-and-roles.md).

---

## What If Something Goes Wrong?

| Problem | What to Do |
| :--- | :--- |
| *Screen shows* **Invalid credentials** | Check your **Username** and **Password**. If you forgot your password, click **Forgot password?** on the sign-in screen and ask your **Laboratory Manager** or administrator to issue a **Credential Recovery Link** or click **Reset Password** in **Laboratory Staff**. |
| *Account is paused after several wrong sign-in attempts* | SoilFER LIMS pauses sign-in briefly after repeated failed attempts (controlled by **Sign-in failures before account backoff**). Wait a few minutes and try again, or ask your administrator for a password reset. |
| *You cannot see* **Admin Panel** *or* **Policies** *in the left sidebar* | Only administrator and manager accounts can open setup screens. Ask your administrator to check your role in **Laboratory Staff**. |

---

## Related Tasks

- [Your First Day as a Laboratory Administrator](../start/first-day-admin.md)
- [Lab Go-Live Checklist](../admin/go-live-checklist.md)
- [Finding Your Way Around the Screen](../start/screen-tour.md)

---

### For the QA Person

- *Personal accountability:* Every action recorded in SoilFER LIMS is stamped with the signed-in user's identity in **Audit & Security**. Staff must never share accounts or passwords.
- *Configurable sign-in and bench security:* Administrators can adjust **Minimum new password length**, **Sign-in failures before account backoff**, **Sign-in failure window (minutes)**, **Maximum account sign-in delay (minutes)**, **Idle bench lock (0: off)**, and **Require PIN when recording** per laboratory in **Policies**.
