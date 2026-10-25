# Release Notes (1.11 & 1.12)

This page summarizes what laboratory managers, staff, and server administrators will notice when updating SoilFER-LIMS to versions **1.11** and **1.12**.

For step-by-step update instructions, see [Updating SoilFER-LIMS](./updates.md).

---

## Version 1.12

### What Staff Notice: Sign-In and Passwords

- **12-character personal passwords:** When staff set or change a password, it must be at least **12 characters** long and different from their previous password.
- **First sign-in with a temporary password:** When a staff member signs in with a temporary password—either on a brand-new account or after an administrator resets their password—SoilFER-LIMS immediately opens the **Security Update Required** prompt so they can choose their own personal password before opening any laboratory screens.
- **Short pause after repeated wrong attempts:** If several wrong sign-in attempts are made in a row, the account is paused for a short time. Staff can simply wait a moment and try again carefully, or ask their Laboratory Manager to issue a new temporary password.
- **Administrator password resets:** Staff who forget their password can click **Forgot password?** on the sign-in screen for instructions to contact their Laboratory Manager, who can generate a temporary password in **Settings → Users** (`/users`).

### What Administrators Notice: Installation & Configuration Settings

- **New deployment and sign-in configuration options:** Version 1.12 adds environment settings for reverse-proxy deployments, browser origin allowlists, request size settings, and sign-in policy tuning.
- **Where to review the settings:** When installing a new server or updating an existing `.env` file, review:
  - [Configuration](../installation/configuration.md) and [Environment Variables](../reference/environment-variables.md) in this book;
  - [HTTP Deployment Settings](../../../http-deployment-settings.md) for reverse-proxy and browser origin settings;
  - [Sign-in & Password Protection](../../../sign-in-protection.md) for password and sign-in policy settings.

### Sample Photos & Everyday Reliability

- **Laboratory-scoped sample photos:** Field collection photos (synchronized from KoboToolbox) and sample reception photos load inside the workspace for staff assigned to that laboratory.
- **Spreadsheet and navigation updates:** Built-in spreadsheet import/export and page navigation components have been refreshed for reliable daily use across reception, bench, and reporting screens.

---

## Version 1.11

### In-App Help Center Refresh (`v1.1.0`)

- **Complete 5-language Help & Lab Guide (`/help`):** The in-app Help Center (`v1.1.0`) has been refreshed across all five supported languages—**English (`en`), Spanish (`es`), Latin American Spanish (`es-419`), French (`fr`), and Portuguese (`pt`)**.
- **Role-based step-by-step guides:** Staff can browse or search practical guides tailored to their daily work, including sample reception and physical inspection, drying and preparation, wet-lab batch entry, spectral workflows, quality control review, Certificates of Analysis, and laboratory administration.
- **Contextual & offline-ready help:** Help articles link directly to the screens where staff work and remain readable offline once loaded in the browser.
- **Laboratory notes:** Laboratory Managers and administrators can attach laboratory-specific notes to help articles so local bench instructions appear alongside the standard guide for their team.
