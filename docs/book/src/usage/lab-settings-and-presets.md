# Per-Lab Settings, Presets & Method Overrides

> *Time:* 10 minutes
> *Who can do this:* Laboratory Administrators, Laboratory Managers, and Quality & Audit Officers

Every soil laboratory works differently. An accredited national reference laboratory, a regional routine fertility lab, and a newly established training lab do not all use the same batch sizes, duplicate intervals, or review rules. SoilFER LIMS never forces one laboratory's fixed numbers onto another. Every policy setting is configurable per laboratory, per analysis, and per method in **Policies**.

---

## Choose Your Laboratory's Starting Preset

In **Policies**, each laboratory selects one of three starting rule sets (or **Inherit deployment defaults**). You can then fine-tune any individual setting:

| On-Screen Starting rule set Label | Best For | How It Works |
| :--- | :--- | :--- |
| **ISO 17025 strict** | Accredited laboratories or labs preparing for accreditation | Required QC blocks acceptance and publication (**Required, blocking**). Frequent blanks, duplicates, and reference soils are enabled, along with **Require a second reviewer** and **Require a second person for amendments**. |
| **Basic** | Routine regional and university soil laboratories | Required QC shows clear warnings (**Required, warnings**) while allowing a manager to review and decide on exceptions. Check frequencies and retention periods are lighter. |
| **Advisory** | Training laboratories, pilot sandboxes, and early onboarding | QC is optional (**Advisory**). Verdicts are displayed for learning without blocking submission or approval. |

---

## How Overrides Work (From General to Specific)

When SoilFER LIMS checks a rule—such as **Maximum analytical batch size**, **Duplicate interval**, or **Maximum duplicate RPD** (relative percent difference — largest allowed percent difference between two repeat readings of the same sample)—it uses the most specific setting you have saved. It also shows the **Source** right in the **Policies** table:

1. **Method override** — a value saved for one specific analytical method in your laboratory.
2. **Analysis override** — a value saved for **All methods for this analysis** in your laboratory.
3. **Laboratory override** — a value saved for your **Whole laboratory**.
4. **Laboratory preset** — the default value from your laboratory's chosen **Preset** (**ISO 17025 strict**, **Basic**, or **Advisory**).
5. **Deployment override** or **Deployment preset** — server-wide defaults when your laboratory uses **Inherit deployment defaults**.

To return an customized setting to its standard starting value, click **Clear override** (return to the standard rule) on that row. Every change requires a written **Reason for change** and is stored permanently in **Change history**. Past batches always keep the rules that were in force when they were tested.

---

## Step-by-Step Admin Task Guides

| What You Need to Do | Open This Guide |
| :--- | :--- |
| Pick **ISO 17025 strict**, **Basic**, or **Advisory**, or change a laboratory-wide rule | [Choose a Quality Preset and Customize Laboratory Policies](../admin/configure-presets-and-policies.md) |
| Switch on soil parameters, choose your laboratory's default methods, and set per-method **Versioned QC rules** | [Switch On Analytical Methods, Calculations, and QC Rules](../admin/enable-methods-and-qc-rules.md) |
| Set your laboratory name, local timezone, logo, and support contact | [Set Up Your Laboratory Profile, Report Branding, and Support Contact](../admin/lab-profile-and-branding.md) |

---

### For the QA Person — Summary of Configurable Policy Groups

All of the settings below are configurable per laboratory in **Policies**. Those with analysis or method-specific settings can also be customized per parameter or method:

| Policy Area | On-Screen Settings You Can Configure per Lab |
| :--- | :--- |
| *Batch & QC Frequencies* | **QC blocking mode**, **Batch QC requirement**, **Maximum analytical batch size**, **Blanks per batch**, **Duplicate interval**, **Laboratory reference materials per batch** (how many laboratory reference materials (your lab's own in-house check soils) to include per batch), **Certified reference material interval** (how often to include a certified reference material (official standard soil with a certified value)), **Continuing calibration verification interval**, **Tray layouts and QC positions** |
| *QC Acceptance Criteria* | **Blank criterion**, **Maximum blank value**, **Blank correction**, **Duplicate criterion**, **Maximum duplicate RPD**, **Absolute duplicate limit**, **Duplicate limit below 5 LOQ** (duplicate limit when readings are near the limit of quantification (lowest amount the method can measure reliably)), **Duplicate near-LOQ threshold** (cutoff near the limit of quantification (lowest amount the method can measure reliably)), **CRM criterion** (rule for the certified reference material (official standard soil with a certified value)), **Minimum control recovery**, **Maximum control recovery**, **Absolute CRM window** (allowed range for the certified reference material (official standard soil)), **Reference material limit mode**, **LRM window (%)** (allowed percent range for the laboratory reference material (your lab's in-house check soil)), **Minimum control-chart baseline points**, **Westgard decision rules**, **Action on QC failure**, **Allow reviewed transcription correction of undispositioned failed QC** |
| *Calibration & Curves* | **Calibration verification**, **Minimum curve points**, **Minimum curve correlation**, **Minimum CCV recovery**, **Maximum CCV recovery**, **Calibration maximum**, **Calibration failure action** |
| *Replicates, Limits & Plausibility* | **Required sample replicates**, **Reported-value selection rule**, **Repeatability limit**, **Values between detection and quantification limits**, **Blank-history window**, **Minimum selected blanks for LOD/LOQ** (minimum number of blank runs needed to calculate the limit of detection and limit of quantification), **LOD sample-SD multiplier** (multiplier used to calculate the limit of detection (lowest amount the method can detect)), **LOQ sample-SD multiplier** (multiplier used to calculate the limit of quantification (lowest amount the method can measure reliably)), **Typical minimum**, **Typical maximum**, **Minimum pH**, **Maximum pH**, **Maximum exchangeable bases / CEC factor**, **Maximum base saturation (%)**, **Texture closure tolerance (%)**, **Minimum C:N ratio**, **Maximum C:N ratio**, **Minimum water pH for carbonate** |
| *Review, Repeats & Reports* | **Allow technician repeat before submission**, **Attempts before nonconformance review (0: unlimited)** (how many tries are allowed before a manager must open a problem record), **Require manager verification of preparation gates**, **Require a second reviewer**, **Require a second person for amendments**, **Report expanded uncertainty**, **Uncertainty coverage factor**, **Convert to oven-dry basis on request**, **Amended report statement**, **PT z-score limits** |
| *Intake, Numbering & Retention* | **Reception and sample context rules**, **Default analysis mass**, **Sample retention mass**, **Sample code pattern**, **Sample sequence reset**, **Consignment number format** (numbering pattern for incoming sample boxes), **Restart consignment numbering** (when box numbers reset to 1), **Container code format**, **Container sequence reset**, **Report number pattern**, **Sample retention after report** |
| *Equipment & Reference Lots* | **Required equipment**, **Unconfigured equipment readiness**, **Reference material expiry warning (days)** |
| *Bench Security & Number Formatting* | **Decimal separator**, **Thousands separator**, **Idle bench lock (0: off)**, **Require PIN when recording**, **Minimum new password length**, **Sign-in failures before account backoff**, **Sign-in failure window (minutes)**, **Maximum account sign-in delay (minutes)** |
