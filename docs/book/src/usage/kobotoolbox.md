# KoboToolbox Field Integration

> *Time:* 10 minutes
> *Who can do this:* Project Managers, Laboratory Administrators, and Sample Reception Officers

[KoboToolbox](https://www.kobotoolbox.org/) is a free mobile survey tool widely used by field soil sampling teams. SoilFER LIMS connects to your project's KoboToolbox survey so field collection forms flow straight into your laboratory's **Expected Arrivals** queue without manual re-typing.

---

## 1. Connect a Project to KoboToolbox

Each KoboToolbox link is set up inside a project and pointed to the destination laboratory that will receive the soil bags.

### Steps

1. Click **Projects** in the left sidebar and open your project to view its workspace.
2. Select the **Data connections** tab.
3. In the **Kobo field collection** card (under **KoboToolbox Integration**), enter your survey connection details:
   - Your KoboToolbox server address and authentication token.
   - **Form / asset ID** (or **Kobo Form UID**) and **Auto-sync Interval (minutes)**.
   - **Destination project** and **Destination lab** (the laboratory that will physically receive the bags).
4. Map your survey's field names for the field bag ID, soil profile code, collection date, GPS coordinates, and top and bottom sampling depths in centimetres.
5. Save the connection. Once linked, the card status badge shows **Configured**.

---

## 2. Synchronize Field Submissions into Expected Arrivals

1. When automatic sync runs—or when you click **Sync All Projects** in **Projects**—new field survey submissions appear in **Sample Reception** under **Expected Arrivals** with status **Expected** (**Not received yet**).
2. SoilFER LIMS preserves field facts truthfully:
   - *Collection dates:* Only the actual field collection date is stored. If the field team left it blank, the system never substitutes the tablet upload timestamp.
   - *Depths and GPS coordinates:* Zero depth (0 cm) and decimal depths (such as 0 to 20.5 cm) are kept without rounding. Missing coordinates stay blank rather than defaulting to zero.
   - *Multi-depth soil pits:* When two bags come from different depth layers of the same soil pit, each bag gets its own unique laboratory sample code while sharing the same soil profile reference.

---

## 3. What Happens If Field Data Is Edited Later?

Sometimes a field coordinator corrects a typo in KoboToolbox *after* the form has already synchronized to the laboratory:

- *If nothing changed:* Re-syncing leaves all reception records, laboratory sample codes, and bench results untouched.
- *If source field data changed:* SoilFER LIMS saves the updated field revision, keeps the original laboratory record safe, and places the sample **On Hold** so nothing is overwritten silently. A **Laboratory Manager** opens the sample, compares the field update against the physical bag, and resolves the hold with a written reason.

---

## 4. Physical Receipt at the Reception Desk

> [!IMPORTANT]
> *A KoboToolbox submission only means a sample was collected in the field—it does not mean the bag has arrived at the laboratory.*

- Every Kobo-synced sample stays in **Expected** (**Awaiting arrival**) until reception staff physically inspect the bag in **Sample Reception**.
- Samples that have not physically arrived cannot print permanent laboratory barcode labels. They also cannot complete drying or preparation checklists or enter **Workbench** runs.
- For the step-by-step reception checklist when the box arrives at your counter, see [Receive One Sample (Project or Walk-In)](../reception/receive-one-sample.md) and [Receive a Whole Box or Consignment](../reception/receive-consignment-box.md).

---

## External Resources

- *KoboToolbox Sign-Up:* [kobotoolbox.org](https://www.kobotoolbox.org/)
- *KoboToolbox Help Center:* [support.kobotoolbox.org](https://support.kobotoolbox.org/)
- *Creating Forms Guide:* [Creating Forms in KoboToolbox](https://support.kobotoolbox.org/creating_forms.html)

---

### For the QA Person

- *Server-side credential protection:* As noted on the **Kobo field collection** card (**API authentication credentials and secrets are protected by server-side access controls and strictly redacted from client responses.**), API tokens are never exposed in browser network responses after saving.
- *Fault-isolated sync:* If a single survey submission contains unreadable metadata, SoilFER LIMS logs the skipped row and continues synchronizing healthy submissions. It holds the sync bookmark before the gap so the repaired submission can be retried cleanly.
