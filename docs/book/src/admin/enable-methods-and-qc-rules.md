# Switch On Analytical Methods, Calculations, and QC Rules

> *Time:* 15 minutes.
> *Who can do this:* Laboratory Administrators, Super Administrators, and Laboratory Managers.

Before reception staff can assign tests to incoming samples, your laboratory needs its active soil parameters switched on. You also need to choose your standard operating procedure (SOP) methods and per-method quality control rules.

---

## Before You Start

- Have your laboratory's list of active soil tests, reporting units, standard methods (such as GLOSOLAN SOPs or national standards), and method QC limits ready.

---

## Task A: Switch On Soil Parameters and Check Units & Ranges

### Step 1: Open the Master Analysis Catalogue

1. Click **Admin Panel** in the left sidebar and select the **Analysis Configuration** tab.
2. Under **Test Methods**, you see the **Master Analysis Catalogue** showing how many parameters are **Available for new orders**, **Inactive**, or **Needs configuration review**.

### Step 2: Review or edit a parameter

1. Use the search box (**Search by code, parameter name, description, or units...**) or filter by category and availability to find a parameter.
2. Click the edit pencil icon (**Edit Parameter**) on the row to open **Parameter Specification**:
   - Check the **Sample matrix**, **Display Name**, **Analytical Domain / Category**, and **Reporting Unit**.
   - Check or update the **Plausible Minimum**, **Plausible Maximum**, and **Display Decimals** so bench entry and review catch obvious typing or dilution errors.
   - At the bottom left, set **Status:** to **Active — available for new orders** (or **Inactive — retain existing work and history** for tests your laboratory does not run).
3. Click **Save Analysis Parameter**.
4. To add a brand-new local parameter that is not in the catalogue yet, click **Add Analysis Parameter** in the top right of **Master Analysis Catalogue**.

---

## Task B: Add or Review Standard Methods and Analysis Packages

1. In **Master Analysis Catalogue**, click the **Configure** (or method count) button in the **Methods** column on any parameter row to open **Standard Methods for** that parameter.
2. Check that your laboratory's SOP is listed. To add a new method, click **Add Analytical Methodology**, enter the **Method Name** and **Standard / Citation Reference (Optional)**, tick **Set as Laboratory Default Method** if applicable, and click **Save Method**.
3. To group parameters into one-click intake bundles, click the **Analysis Packages** pill at the top of **Analysis Configuration** and add or update your laboratory's test packages.

---

## Task C: Set Your Laboratory's Default Methodology per Parameter

1. Open **Laboratory Methodology Defaults** from your laboratory setup screen.
2. If your laboratory has not customized its method choices yet, the **Laboratory Method Onboarding Wizard** banner appears at the top.
3. Filter by **Matrix:** (**All Matrices**, **Soil**, **Plant Tissue**, **Water**, **Fertilizer**) or **Module:** (**All Modules**, **Fertility**, **Health**, **Environmental**, **Quality**), or type in **Search analyses...**.
4. For each parameter your laboratory runs, pick the **Active Methodology** from the dropdown. Rows customized for your facility show a **Lab Choice** badge, while shared defaults show **GLOSOLAN Standard**.
5. Click **Save Defaults** in the top right. You see **Laboratory methodology defaults successfully saved.**

*(Screenshot placeholder: selecting laboratory methodology defaults and method QC limits — screenshot coming once the training data is ready)*

---

## Task D: Configure Per-Analysis or Per-Method QC Rules

Different methods have different precision and blank limits. A potentiometric pH run does not use the same duplicate RPD or blank limit as an Olsen phosphorus colorimetric run.

1. Open **Policies** for your laboratory.
2. Under **Scope**, switch from **Whole laboratory** to **Analysis and method overrides**.
3. Select the parameter and either **All methods for this analysis** or one specific **Method**.
4. Edit any method-specific policy row—such as **Blanks per batch**, **Maximum blank value**, **Duplicate interval**, **Maximum duplicate RPD**, **Minimum control recovery**, **Maximum control recovery**, **LRM window (%)**, or **Required sample replicates**. Enter a **Reason for change**, and click **Save change**.
5. In the **Versioned QC rules** card for that analysis or method, review each **Blank**, **Duplicate pair**, **Control**, **Laboratory reference material**, or **Certified reference material** rule. Enter a reason if you adjust a criterion or action (**Fail batch**, **Warn**, or **Repeat calibration bracket**), and save a new immutable rule version.

---

## What If Something Goes Wrong?

| Problem | What to Do |
| :--- | :--- |
| **Reporting Unit** *or* **Sample matrix** *dropdown is locked when editing a parameter* | Once a parameter has connected samples, work items, or results, its **Reporting Unit** and **Sample matrix** are locked so historical measurements are never silently re-labeled. Set the old parameter to **Inactive — retain existing work and history** and create a new parameter if you need a different unit. |
| *Screen shows* **No usable LOQ is configured; this blank criterion will be invalid.** | If a method's **Blank criterion** is set to **< LOQ** or **< LOQ / 2**, the method must have a quantification limit configured. Otherwise choose **Absolute limit** with a numeric **Maximum blank value**. |
| *Screen shows* **QC rules are immutable; save a new version.** | SoilFER LIMS never overwrites past QC rules in place. Save your update as a new version with a written reason so earlier batches keep the exact rules that were active when they were run. |

---

## Related Tasks

- [Per-Lab Settings, Presets & Method Overrides](../usage/lab-settings-and-presets.md)
- [Choose a Quality Preset and Customize Laboratory Policies](./configure-presets-and-policies.md)
- [Quality Control, Control Charts & Failed QC](../usage/qc-management.md)

---

### For the QA Person

- *Order-time method binding:* When reception accepts a sample, each analytical work item locks in the **Active Methodology** configured in **Laboratory Methodology Defaults** at that moment. Changing a default method later affects only future orders.
- *Versioned QC evaluation:* Every edit to **Versioned QC rules** creates a new numbered version with an effective timestamp and audit reason, ensuring complete reproducibility during external quality audits.
