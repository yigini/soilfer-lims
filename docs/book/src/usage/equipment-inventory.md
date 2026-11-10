# Equipment, Calibration, Reference Materials & PT

> *Time:* 10 minutes.
> *Who can do this:* Laboratory Administrators, Laboratory Managers, Quality & Audit Officers, and Senior Technicians.

Reliable soil testing depends on calibrated instruments, traceable reference soils, and fresh reagents. SoilFER LIMS links your **Equipment**, **Reference materials**, and **Inventory** directly to the analytical **Workbench**. Technicians can see whether an instrument is calibrated before starting a run. They can also check which reference soil lot is active.

---

## 1. Equipment & Calibration Readiness

In **Equipment** (**Equipment & Instruments**), every registered instrument carries two status badges. This applies to balances, ovens, pH meters, spectrophotometers, AAS, ICP, and infrared spectrometers:

| Badge Type | On-Screen Labels | What Happens on the Bench |
| :--- | :--- | :--- |
| **Service Status** | **In Service**, **Under Maintenance**, **Out of Service**, **Decommissioned** | Only instruments marked **In Service** can be chosen for a new analytical run. |
| **ISO Readiness** | **Ready / Calibrated**, **Calibration Expiring Soon**, **Calibration Overdue / Blocked**, **Not Configured** | When **Required equipment** is enforced in **Policies**, an instrument marked **Calibration Overdue / Blocked** cannot be used to submit results until a fresh **Calibration** or **Verification** event is logged. |

---

## 2. Reference Materials (CRMs, LRMs & Check Standards)

In **Admin Panel** → **Quality** (**Reference materials**), your laboratory manages its quality control materials:
- **Certified reference material (CRM)** (official standard soil with a certified value) — a reference soil or standard with a certificate from a recognized provider. It is used for trueness and bias checks.
- **Laboratory reference material (LRM)** (your lab's own in-house check soil) — your homogeneous in-house check soil included in routine batches and plotted on control charts.
- **Check standard**, **Calibration standard**, and **Blank matrix** — working standards and blank matrices used across instrumental runs.

Each lot has a current status (**Active**, **Quarantined**, **Expired**, or **Retired**) and **Assigned values by analyte**. When a technician selects an **Active** reference lot on a batch control slot in **Workbench**, the server matches the lot's current **Assigned value** and **Expanded uncertainty** for that analyte and method.

---

## 3. Reagents & Inventory Stock Alerts

In **Inventory** (**Reagents & Inventory**), your laboratory tracks **Reagents & Chemicals**, **Reference Standards (CRM)** (certified reference material — official standard soil with a certified value), **Consumables & Labware**, and **Glassware**. Each item records its **Lot / Batch Number**, **Expiration Date**, and **Current Quantity** against a **Minimum Alert Threshold**.

Quick filter pills highlight items that need attention before a run gets delayed:
- **Showing: Low / Out of Stock Items** (**Low Stock Warning**, **LOW**, **LOW? (UNCERTAIN)**, **OUT OF STOCK**)
- **Showing: Expiring Soon Items** and **Showing: Expired Items**
- **Showing: Quarantined Items** and **Showing: Missing Quantity Items** (**COUNT NEEDED**)

---

## 4. Step-by-Step Task Guides

| What You Need to Do | Open This Guide |
| :--- | :--- |
| Register a new instrument, log a **Calibration** or **Maintenance** event, add a **Reference materials** lot with assigned values, or update **Inventory** stock | [Register Instruments, Log Calibrations, and Track Reagent Stock](../admin/register-equipment-and-inventory.md) |
| Review quality control charts, proficiency testing rounds, and problem records in **QA Dashboard** | [Quality Control, Control Charts & Failed QC](./qc-management.md) |

---

### For the QA Person

- *Per-laboratory equipment policy:* In **Policies**, administrators configure **Required equipment** (**Required** or **Not required**) and **Unconfigured equipment readiness** (**Block** or **Allow** with the warning **Qualification is not configured; laboratory policy permits use with a warning.**), plus **Reference material expiry warning (days)**.
- *Permanent reference value history:* Target values on a reference soil bottle are never overwritten silently. If a target value is updated, click **Correct by new revision** in **Reference materials** with a written **Reason** so past batches keep the values that were active when they were tested.
