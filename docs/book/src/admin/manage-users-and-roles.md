# Create Staff Accounts, Assign Roles, and Reset Passwords

> *Time:* 5 minutes per person
> *Who can do this:* Laboratory Administrators, Super Administrators, and Laboratory Managers

Every person who touches samples, enters bench results, or reviews reports in SoilFER LIMS needs their own personal account. This page shows you how to invite a new team member, change someone's role or laboratory assignment, reset a forgotten password, or suspend an account when someone leaves.

---

## Before You Start

- Decide which **System Role** and **Laboratory Scope** the person needs (see [Users, Roles & Separation of Duties](../usage/roles.md)).
- Have the person's full name and work email address ready.

---

## Task A: Invite a New Team Member (Recommended)

### Step 1: Open the staff directory

1. Click **Laboratory Staff** in the left navigation bar (or open **My Laboratory** and select the **People & Access** tab).
2. Click **Invite Team Member** (or **Invite a Person**).

### Step 2: Fill in the invitation details

1. In the **Named Staff Onboarding** window, enter the person's **Full Name** and **Verified Work Email**.
2. Select their **System Role** (for example, **Sample Reception Officer**, **Laboratory Technician**, **Laboratory Manager**, **Quality & Audit Officer**, or **Read-Only Viewer**).
3. Choose their **Laboratory Scope** (select your laboratory, or **No specific laboratory (Global)** for national roles).
4. Click **Prepare Invitation**.

### Step 3: Copy and share the one-time activation link

1. You see **Invitation Created** with a **One-Time Activation Link** that expires in 24 hours.
2. Click **Copy Activation Link** (the button changes to **Copied!**). Send the link directly to the staff member over your laboratory's secure messaging channel or email.
3. When the staff member opens the link, they set their own personal password and sign right in. No shared or default password is ever created.
4. If a link expires before the person uses it, find their row under **Pending Staff Invitations** and click **Reissue** to generate a **Fresh Activation Link**, or click **Revoke** to cancel it.

*(Screenshot placeholder: inviting a team member and reviewing roles in Laboratory Staff — screenshot coming once the training data is ready)*

---

## Task B: Review or Change Someone's Role and Laboratory Scope

1. In **Laboratory Staff**, find the person using the search box (**Search users by name, username, or email...**).
2. Click **Review Access** on their row to open **Pre-Change Access Review**.
3. Check the **Current vs. Proposed Comparison**, including any **Unfinished Sample Determinations** assigned to that person and **Active Sessions Invalidation**.
4. Select the new **System Role** or **Assigned Laboratory**, then click **Confirm and Apply Changes**.

---

## Task C: Reset a Forgotten Password

If a technician or clerk forgets their password:

1. Open **Laboratory Staff** and find their account row.
2. Click the key icon to open **Credential Recovery Link** (or open **Edit User** and click **Reset Password**).
3. Click **Copy Recovery Link** to copy a single-use 1-hour recovery link and share it with the staff member so they can choose a new password. You can also provide a **Temporary Password** that the user must change on first sign-in.
4. Their previous browser session is signed out immediately for safety.

---

## Task D: Suspend or Reactivate a Staff Account

Never delete an account that has recorded sample receipts, preparation steps, or bench results. Suspending preserves the historical audit trail while revoking sign-in access immediately.

1. In **Laboratory Staff** (or **People & Access**), find the user row and click **Suspend User**.
2. In the **Emergency Staff Suspension** window, enter the **Suspension Reason / Incident Reference** (for example, *Staff member completed fellowship rotation*).
3. Click **Suspend Account Immediately**. The user's status badge changes from **Active** to **Suspended**, and any open browser sessions close immediately while preserving their historical records.
4. If the person returns to the laboratory later, click **Reactivate User** on their row to restore access.

---

## What If Something Goes Wrong?

| Problem | What to Do |
| :--- | :--- |
| *Invitation link has expired* | Activation links are valid for 24 hours. Open **My Laboratory** → **People & Access**, scroll to **Pending Staff Invitations**, and click **Reissue** to copy a **Fresh Activation Link**. |
| *A technician who is also a manager cannot approve their own batch* | Your laboratory has **Require a second reviewer** switched on in **Policies**. Ask a second **Laboratory Manager** or **Quality & Audit Officer** to review and approve that batch. |
| *You need to check what a staff member sees on their screen* | Administrators can click the eye icon (**Log in as User**) on a staff row in **Laboratory Staff** and confirm **Log In as User** in the **Impersonate User?** dialog. Click **Sign Out** when done to return to your admin account. |

---

## Related Tasks

- [Users, Roles & Separation of Duties](../usage/roles.md)
- [Lab Go-Live Checklist](./go-live-checklist.md)
- [Choose a Quality Preset and Customize Laboratory Policies](./configure-presets-and-policies.md)

---

### For the QA Person

- *No shared credentials:* Single-use activation and recovery tokens ensure that administrators never need to know or store a staff member's personal password.
- *Preserved attribution:* Suspending an account via **Suspend Account Immediately** keeps every historical sample intake, preparation sign-off, bench attempt, and approval permanently linked to that individual's name in **Audit & Security**.
