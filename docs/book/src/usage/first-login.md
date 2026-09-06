# First Login & Setup

After your SoilFER-LIMS instance is running, here's how to log in for the first time and set up your laboratory.

---

## Step 1: Open SoilFER-LIMS

Open your web browser and go to your LIMS URL:
- `https://soillab.org` (if you set up a domain with SSL)
- `http://soillab.org` (if no SSL yet)
- `http://YOUR_SERVER_IP` (if no domain yet)

You should see the login page.

---

## Step 2: Log In

| Field | Value |
|-------|-------|
| **Username** | `admin` |
| **Password** | `<generated-initial-password>` (or set via `ADMIN_INITIAL_PASSWORD`) |

Check your container startup logs (`docker logs soilfer-lims | grep "INITIAL ADMIN CREDENTIALS" -A 4`) to retrieve your generated initial password.

Click **"Sign In"**.

---

## Step 3: Change Your Password

You will be immediately prompted to change the initial password. This is mandatory — you cannot skip it.

Choose a strong password:
- At least **12 characters** long
- Include **letters**, **numbers**, and **symbols**
- Don't use dictionary words, personal information, or anything guessable

Write down the password and store it somewhere safe (a password manager is ideal).

---

## Step 4: Configure Your Laboratory (Local Mode)

After logging in, set up your laboratory's basic information:

1. Go to **Settings → Laboratory**
2. Enter your laboratory name, address, country, and contact details
3. Upload your laboratory's logo (optional, but it appears on reports)
4. Save

---

## Step 5: Create User Accounts

Create accounts for your team members so they can log in with their own credentials.

1. Go to **Settings → Users**
2. Click **"Create User"**
3. Fill in:
   - **Full name** — their real name
   - **Username** — what they'll type to log in
   - **Email** — for notifications (optional)
   - **Role** — what they can do (see [Roles & Permissions](./roles.md))
4. Click **Create**
5. Share the temporary password with the user — they'll be prompted to change it on first login

> 💡 **Tip:** Create at least one account for each role you need. A typical small lab might have: 1 Lab Manager (you), 1 Sample Reception person, and 2-3 Lab Technicians.

---

## Step 6: Configure Your Analyses

Tell the system which soil tests your laboratory performs:

1. Go to **Settings → Analyses**
2. You'll see a list of common soil analyses (pH, organic carbon, nitrogen, phosphorus, texture, etc.)
3. **Enable** the ones your lab performs
4. You can customize method references, units, and acceptable ranges

---

## Step 7: Create Your First Project

Before receiving samples, create a project to organize them:

1. Go to **Projects → New Project**
2. Enter:
   - **Project name** — e.g., "National Soil Survey 2025"
   - **Project code** — a short identifier like "NSS-2025"
   - **Client** — who commissioned the work (optional)
   - **Expected sample count** — helps with planning
3. Click **Create**

---

## You're Ready!

Your LIMS is set up. Staff can now log in with their accounts and you can start receiving samples through the **Reception** page.

For a detailed walkthrough of the sample workflow, see [The Sample Workflow](./sample-workflow.md).
