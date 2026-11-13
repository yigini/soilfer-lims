# Set Up Your Laboratory Profile, Report Branding, and Support Contact

> *Time:* 10 minutes.
> *Who can do this:* Laboratory Administrators, Super Administrators, and Laboratory Managers.

Your laboratory's name, address, timezone, logo, and support email appear on the sign-in screen and workspace header. They also appear on every official **Certificate of Analysis** PDF issued to clients. This guide shows you how to set them up.

---

## Before You Start

- Have your official laboratory name, physical address, contact phone number, support email address, and local timezone ready.
- Prepare a clean PNG, SVG, or JPG file of your **Laboratory Logo** (suggested size 200 × 200 pixels, under 2 MB).

---

## Task A: Configure Your Laboratory Facility Profile & Local Timezone

1. Click **My Laboratory** (or **Lab Management**) in the left sidebar to open **Laboratory Workspace**.
2. Select the **Settings** tab to open **Laboratory Configuration** (**Facility Profile & Local Time**).
3. Fill in or review your facility fields:
   - **Laboratory Name** and **City**
   - **IANA Timezone** (select your local timezone from **— Select configured IANA time zone —** so sample reception times, drying durations, and report dates display in your local wall-clock time)
   - **Contact Email**, **Phone**, and **Physical Address**
   - **Monthly Sample Capacity (optional)** (leave blank for **Unconstrained**, or enter a planned monthly sample count)
4. Click **Save Profile Changes**. You see **Laboratory profile updated successfully.**

---

## Task B: Upload Your Logo, Colors, and Support Contact in Branding & Identity

1. Click **Admin Panel** in the left sidebar and select the **Branding & Identity** tab.
2. Under **Visual Identity**:
   - Click **Upload New** next to **Laboratory Logo** and select your logo image (or click **Remove** to clear an old logo).
   - Optionally adjust **Primary Color** and **Secondary Color** for organization certificates and headers.
3. Under **Organization Details**:
   - Enter **Lab Name (App Title)** and **Organization Legal Name**.
   - Enter your **Tagline / Subtitle** and **Footer Text**.
   - Enter your laboratory's **Contact Email**. When no address is configured, the app shows the shared pilot support default. A Super Admin can replace the installation contact in **Branding & Identity**; the sign-in screen and **Password Reset Instructions** use that configured contact.
4. Under **Localization**:
   - Choose the **Default Language** shown to visitors before sign-in and select your preferred **Date Format**.
5. Check the **Live Preview** card on the right side of the screen, then click **Save** in the top right. You see **Branding Updated**.

---

## Task C: Set Default Visual Appearance for Your Laboratory (Optional)

1. To choose a calm light or dark colour palette for your laboratory's benches, open **Admin Panel** and click the **Appearance** tab.
2. Preview any palette in the **Theme Library** under **Curated Theme Palette** and choose **Light** or **Dark · Graphite** under **Display Mode**.
3. Click **Use as this lab's default** (or **Use as platform default** for the whole server) and confirm **Confirm Laboratory Appearance Default**. Staff can still pick their own personal theme choice or high-contrast theme in their profile if they wish.

---

## What If Something Goes Wrong?

| Problem | What to Do |
| :--- | :--- |
| *Screen shows* **Timezone not configured** | Open **My Laboratory** → **Settings**, pick your region in the **IANA Timezone** dropdown, and click **Save Profile Changes**. |
| *Logo upload says* **File too large** | Choose a PNG, JPG, or SVG image under 2 MB (**Please select an image under 2MB.**). |
| *Support email does not appear on the sign-in screen* | Check **Admin Panel** → **Branding & Identity** under **Organization Details**. Make sure **Contact Email** is filled in, click **Save**, and refresh the browser page. |

---

## Related Tasks

- [Lab Go-Live Checklist](./go-live-checklist.md)
- [First Login & Lab Setup](../usage/first-login.md)
- [Lab Manager & QA: Certificates of Analysis, PDF Reports & Amendments](../usage/reporting-pdf.md)

---

### For the QA Person

- *UTC storage with local display:* SoilFER LIMS stores every timestamp in UTC in the database and converts it using your configured **IANA Timezone** for display and reporting. This ensures unambiguous chronological order across multi-timezone national networks.
- *Report identity:* The **Laboratory Name**, **Organization Legal Name**, **Physical Address**, and **Laboratory Logo** configured here are embedded into official **Certificate of Analysis** PDFs at the moment of issuance.
