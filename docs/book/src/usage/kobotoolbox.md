# KoboToolbox Integration

[KoboToolbox](https://www.kobotoolbox.org/) is a free, open-source mobile survey platform widely used by field soil surveyors, national ministries, and FAO programmes. SoilFER-LIMS connects directly to KoboToolbox so field collection forms flow straight into your laboratory's **Expected Arrivals** queue without manual re-typing.

---

## 1. Connecting a Project to KoboToolbox

KoboToolbox connections are configured per project and mapped to a specific destination laboratory.

### What You See
- Inside **Projects → [Select Project] → Data Connections**, you see the **KoboToolbox Data Connection** card and the **Field Mapping Editor**.

### What You Do
1. Open **Projects** (`/projects`) and click your project to open its **Project Workspace**.
2. Select the **Data Connections** tab.
3. Fill in the connection credentials:
   - **Server URL**: e.g., `https://kf.kobotoolbox.org` (or your institution's self-hosted Kobo server).
   - **Form / Asset ID**: The unique identifier of your Kobo field sampling survey.
   - **API Token**: Your KoboToolbox account API token.
   - **Destination Laboratory**: The laboratory that will physically receive the soil bags from this survey.
4. Configure the **Field Mapping** (optional but recommended for soil profile surveys):
   - Map exact form field paths (flat or nested) for **Field Sample / Bag ID**, **Soil Profile Code**, **Profile Namespace**, **Profile Meaning / Relation** (*Confirmed profile*, *Sampling point*, *Composite area*, or *Unspecified*), **Collection Date**, and **Top / Bottom Depth (cm)**.
5. Click **Save Connection**.

### What Happens Next
- SoilFER-LIMS validates the connection and locks the mapping to the current connection revision so an in-flight synchronization cannot save against a half-changed mapping.

---

## 2. Synchronizing Field Submissions

### What You See
- When a sync runs (automatically or when you click **Sync Now**), new field submissions appear in **Reception → Expected Arrivals** (`/reception`) with a **Synced** badge, status `EXPECTED`, and `receptionDate: null`.

### What Happens Behind the Scenes
1. **Truthful Field Data Preservation**:
   - **Collection Dates**: Only the actual field collection date is stored as `collectionDate`—LIMS never substitutes the tablet upload time or interview timestamp if the collection date was left blank.
   - **Depths & Coordinates**: Numeric zero (`0 cm`) and decimal depths (such as `0` to `20.5 cm`) are preserved exactly. Missing GPS coordinates or depths stay blank (`null`) rather than defaulting to `0, 0` or `0–20 cm`.
   - **Soil Profile References**: If two bags come from different depths (`0–20 cm` and `20–50 cm`) of the same confirmed soil pit, both bags receive their own unique specimen ID and laboratory sample code while sharing the same recorded soil profile reference (`namespace:code`).
2. **Safe Handling of Malformed Submissions**:
   - If a single Kobo submission has unreadable or malformed hold/metadata fields (`HOLD_MARKER_INVALID`), LIMS skips that broken row so healthy submissions can still synchronize, while keeping the sync cursor positioned before the gap so the repaired submission can be retried later.

---

## 3. What Happens If Field Data Changes Later? (Replay & Provenance Holds)

Sometimes a field coordinator edits a KoboToolbox submission *after* it has already been synchronized to the laboratory.

- **If nothing changed**: Re-syncing or running a force refresh keeps all manual reception facts, laboratory sample codes, and results untouched.
- **If source field data changed**:
  - **What you see**: SoilFER-LIMS preserves the original record, saves the new revision evidence, and automatically places the sample **On Hold (`ON_HOLD`)** with a **Kobo Provenance Hold** badge.
  - **What you do**: A **Lab Manager** opens the sample, inspects the provenance diff (comparing what changed in Kobo against the physical bag at the lab), clicks **Resolve Hold**, and records a mandatory **Resolution Reason**.
  - **What happens next**: Once the hold is resolved, the sample returns to its prior workflow state and resumes normal laboratory processing.

---

## 4. Physical Receipt at the Laboratory Desk

> [!IMPORTANT]
> **A KoboToolbox submission only means a sample was collected in the field—it does NOT mean the bag has arrived at the laboratory.**

- All Kobo-synced samples stay in `EXPECTED` status (`receptionDate: null`) until reception staff physically inspect the bag at `/reception`.
- `EXPECTED` samples **cannot** print permanent laboratory barcode labels, **cannot** enter drying/preparation gates, and **cannot** appear in technician workbenches.
- For the step-by-step physical reception checklist, see [Sample Reception, Intake, Labels & Assignment](./reception-and-intake.md).

---

## External Resources

- **KoboToolbox Sign-Up:** [kobotoolbox.org](https://www.kobotoolbox.org/)
- **KoboToolbox Documentation:** [support.kobotoolbox.org](https://support.kobotoolbox.org/)
- **Form Builder Guide:** [Creating Forms in KoboToolbox](https://support.kobotoolbox.org/creating_forms.html)
- **Soil Profile Reference Technical Guide:** See `docs/profile-reference-guide.md` in the repository.
