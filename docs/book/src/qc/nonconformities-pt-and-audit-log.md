# Manage Nonconformities, Proficiency Testing, and Audit Logs

## What This Is For

Track and close laboratory **Nonconformities** (root cause and corrective action), log external **Proficiency testing** rounds and z-scores, and inspect the immutable **System Audit Logs**.

> *Screenshot placeholder — docs/book/src/img/screenshots/qc-ncr-pt-and-audit-logs.png (screenshot coming once the training data is ready): The **QA Dashboard** showing **Nonconformities**, the **Proficiency testing** page showing z-score classifications, and **System Audit Logs**.*

---

## Before You Start

- Sign in with a **Laboratory Manager** account on the **Sign in to SoilFER LIMS** screen.

---

## Steps

### Part 1: Investigate and Close **Nonconformities**

1. Click **QA Dashboard** in the left menu and open the **Nonconformities** tab.
   *You should see all nonconformity records filterable by **Status** (**Open**, **Action**, **Closed**) and **Source** (**Quality control**, **Proficiency testing**, **Repeat limit**, **Customer**, **Intake**, **Other**).*
2. Click an **Open** nonconformity to investigate why it occurred:
   - Read the **Description** and source record (such as a failed **Certified reference material**, a rejected batch, an **Unsatisfactory** proficiency test, or a **Repeat limit** override).
   - Type your root cause and impact findings in **Impact assessment** and advance the record from **Open** to **Action**.
3. Once your team has fixed the underlying problem (for example, replacing a contaminated reagent or recalibrating an instrument), type what was done in **Corrective action**. Advance the record from **Action** to **Closed**.
   *Closed records are permanently locked for audit inspection.*

### Part 2: Record and Review External **Proficiency testing** Rounds

1. Click **Proficiency Testing** in the left menu (under the administration section) or view **PT z-score trend** and **PT results** in **QA Dashboard** (**Lab overview**).
2. To record a new inter-laboratory comparison result in **Proficiency Testing**:
   - Enter the **Provider** (for example, GLOSOLAN or WEPAL), **Round**, **Analysis**, **Method**, **Unit**, and **Date**.
   - Enter the **Assigned value**, **Lab result**, **Expanded uncertainty**, assessment sigma, and **z-score**.
   - Check the resulting classification (**Satisfactory**, **Questionable**, or **Unsatisfactory**) and click **Save**.
   *If a round is recorded as **Unsatisfactory**, SoilFER LIMS automatically creates a linked record in **Nonconformities** (**Open NCRs**) so you can document the investigation.*

### Part 3: Inspect the **System Audit Logs**

1. Click **Audit Logs** in the left menu (or click **Full Audit Log** / the **Audit Stream** tab in **QA Dashboard**).
   *You should see **System Audit Logs** showing the full chronological history of events.*
2. Filter by **All Logs**, **Operational**, or **System**, or type a sample ID, username, or action into **Search logs...**.
3. Review the **Timestamp**, action type, **User**, and **Details** for any sample, batch, or setting change.

---

## What Happens Next

- Your proficiency testing results and nonconformity counts automatically feed the 30-day (**Last 30 days**) and 90-day (**Last 90 days**) trend charts on **QA Dashboard** (**Lab overview** -> **PT z-score trend** and **Open NCRs**).

---

## If Something Goes Wrong

- *If you try to close a nonconformity directly from* **Open** *and see* **Move from open to action, then closed.** *→* Every nonconformity must follow the two-step sequence. Record the **Impact assessment** first (**Open** → **Action**), and then record the **Corrective action** (**Action** → **Closed**).
- *If a historical proficiency testing round shows* **Legacy score retained** *→* You will see **This historical PT score was recorded without an assessment sigma. It has not been recomputed; supply a valid sigma in an explicit correction.** Enter a valid assessment sigma if you need to update the record.

---

## For the QA Person

- *Automatic nonconformity triggers*: SoilFER LIMS automatically raises an **Open** nonconformity whenever a **Certified reference material** fails in blocking or warning mode, a manager records a **Repeat limit** override, or a **Proficiency testing** round is recorded as **Unsatisfactory**.
- *Append-only audit trail*: **System Audit Logs** are append-only and cannot be edited or deleted by any user role, including **System Administrator**.
