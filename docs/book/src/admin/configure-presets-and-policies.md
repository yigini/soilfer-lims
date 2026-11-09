# Choose a Quality Preset and Customize Laboratory Policies

> *Time:* 10–15 minutes
> *Who can do this:* Laboratory Administrators, Super Administrators, and Laboratory Managers

Every laboratory can choose its own quality preset and customize individual rules—from decimal separators and sample numbering to two-person review and retention days—without changing code or affecting other laboratories on the same server.

---

## Before You Start

- Sit down with your Laboratory Manager or QA Officer so you agree on which preset fits your current operations (**ISO 17025 strict**, **Basic**, or **Advisory**). Have a short reason ready for any rule you customize.

---

## Task A: Choose and Save Your Laboratory's Preset

### Step 1: Open Policies for your laboratory

1. Open **My Laboratory** (or **Lab Management**), click the **Settings** tab, and click **Open policy settings** (or navigate directly to **Policies**).
2. If you manage more than one facility, select your target facility in the **Laboratory** dropdown at the top of the page.

### Step 2: Select a preset and record your reason

1. In the **Preset** card, choose one of the options:
   - **ISO 17025 strict** — **Required, blocking** QC, frequent quality checks, and two-person review.
   - **Basic** — **Required, warnings** QC with lighter check frequencies.
   - **Advisory** — optional QC verdicts for training or pilot runs.
   - **Inherit deployment defaults** — follow the server-wide preset.
2. Type a short explanation in **Reason for change** (for example, *Adopt Basic preset for two-week regional pilot phase*).
3. Click **Save preset**.

*(Screenshot placeholder: choosing a preset and editing laboratory policies — screenshot coming once the training data is ready)*

---

## Task B: Customize a Whole-Laboratory Policy Setting

1. Under **Scope**, select **Whole laboratory**.
2. In the policy table, review each row's **Setting**, **Effective value**, **Source**, and **Compared with preset** status (**Differs from preset** highlights any custom override).
3. Click **Edit** on the setting you want to customize:
   - **Decimal separator** and **Thousands separator** (match your local spreadsheet conventions so bench paste works smoothly).
   - **Sample code pattern**, **Consignment number format**, **Container code format**, and **Report number pattern**.
   - **Sample retention after report** (how many **days** soil bags are kept in archive before appearing in the disposal queue).
   - **Require a second reviewer** and **Require a second person for amendments** (**Yes** or **No**).
   - **Idle bench lock (0: off)** and **Require PIN when recording** for shared bench computers.
4. Enter the new value, type a **Reason for change**, and click **Save change**.
5. To return an overridden setting to its preset default later, click **Clear override** on that row.

---

## Task C: Configure Tray Layouts and QC Positions (Optional)

If your laboratory runs fixed rack or autosampler trays where blanks, duplicates, and reference soils always sit in the same physical slots:

1. In **Policies**, locate **Tray layouts and QC positions** and click **Edit**.
2. Click **Add tray**, enter a **Tray name** and **Tray capacity**, and click **Add QC slot** to define each fixed **Position**, **QC type** (**Blank**, **Duplicate**, or **Reference control**), and **Label**.
3. Enter your **Reason for change** and click **Save change**.

---

## What If Something Goes Wrong?

| Problem | What to Do |
| :--- | :--- |
| *Screen shows* **Enter a reason for the policy change.** | Every policy change is audited. Type a brief explanation in **Reason for change** before clicking **Save preset** or **Save change**. |
| *Screen shows* **Policies changed while you were editing. Refresh and review the current values before saving.** | Another manager or administrator saved a change while your tab was open. Click **Refresh**, check the updated **Effective value**, and save your edit again. |
| *Screen shows* **This policy would conflict with a current or scheduled QC rule. Adjust that rule before saving.** | Your method's **Versioned QC rules** have a stricter or conflicting requirement. Scroll to **Versioned QC rules** for that analysis or method, adjust the rule first, and then save the policy. |
| *Screen shows* **You can read policies. A laboratory manager or administrator can change them.** | Your account has read-only access to **Policies**. Ask your **Laboratory Manager** or **Super Administrator** to save the change. |

---

## Related Tasks

- [Per-Lab Settings, Presets & Method Overrides](../usage/lab-settings-and-presets.md)
- [Switch On Analytical Methods, Calculations, and QC Rules](./enable-methods-and-qc-rules.md)
- [Lab Go-Live Checklist](./go-live-checklist.md)

---

### For the QA Person

- *Immutable policy history:* Click **Change history** in **Policies** at any time to inspect every historical version (**Version**), who saved it, when it took effect, the previous and new values, and the recorded **Reason for change**.
- *Historical batch protection:* Saving a new policy or preset applies only to new evaluations going forward. Completed batches and issued reports retain the policy snapshot under which they were evaluated.
