# Controlled Units & Agronomic Interpretation

## What This Is For

Understand how SoilFER LIMS keeps measurement units consistent across every soil test. This page also explains what the five soil fertility rating badges mean on a Certificate of Analysis and how the system checks whether a sample's chemical results fit together.

> *Screenshot placeholder — docs/book/src/img/screenshots/agronomic-units-and-crosschecks.png (screenshot coming once the training data is ready): A sample **Review** and report view showing standardized units, 5-tier fertility rating badges, and the **Cross-parameter plausibility** panel.*

---

## Before You Start

- Open any sample's **Review** or **Reports** tab in **Samples**, or open a released Certificate of Analysis in **Reports** (**Result Reports**).

---

## Steps

### 1. Check the Measurement Unit on Every Result

SoilFER LIMS uses one standard reporting unit for each soil property. This ensures numbers from different runs or laboratories are never mixed up by a factor of 10:

| Soil Property | Standard Unit in SoilFER LIMS | Everyday Comparison |
|---|---|---|
| **pH** (soil reaction) | pH units | Same scale everywhere (for example, 5.5 is acidic, 7.0 is neutral) |
| Electrical conductivity | µS/cm or dS/m | 1 dS/m equals 1 mS/cm or 1000 µS/cm |
| **Organic Carbon** & Total Nitrogen | g/kg | 10 g/kg equals 1.0 % |
| Extractable phosphorus (**P Available**) & sulfur | mg/kg | 1 mg/kg equals 1 ppm |
| Exchangeable cations (Ca, Mg, K, Na) & CEC | cmol(+)/kg | 1 cmol(+)/kg equals 1 meq/100g |
| **Texture (Sand/Silt/Clay)** | % | **Sand**, **Silt**, and **Clay** percentages add up to 100 % |
| Extractable micronutrients (Fe, Zn, Cu, Mn, B) | mg/kg | 1 mg/kg equals 1 ppm |

### 2. Read the Five Agronomic Rating Badges

When agronomic interpretation is turned on for a test method, the report prints a simple 5-level rating next to the number:

| Rating Level | What It Means for the Soil |
|---|---|
| Very Low | Severe nutrient shortage or extreme acidity; priority soil correction needed |
| Low | Below the target range; crops are likely to respond well to nutrient addition |
| Optimal | Balanced fertility range for healthy crop growth |
| High | Plenty of nutrient available in the soil; extra fertilizer gives little benefit |
| Very High | Excessive concentration, alkalinity, or salinity; risk of nutrient imbalance |

### 3. Check Cross-Parameter Plausibility Flags (**Cross-parameter plausibility**)

1. On a sample's **Review** tab, look at the **Cross-parameter plausibility** card.
2. Check the **Outcome** column for each soil chemistry relationship:
   - **Pass**: the related soil tests agree with each other within your laboratory's limits.
   - **Flagged**: two related measurements look unusual together (for example, **Carbonate is positive below the lab water-pH limit.**).
   - **Not evaluated**: one of the required tests was not ordered or is not yet recorded (**An input is missing.**).
3. If a row is **Flagged**, inspect the raw bench numbers. Decide whether to accept the result (for example, on a naturally calcareous or saline soil) or click **Return for correction** to ask for a **Confirmation** re-run.

---

## What Happens Next

Standardized units and approved agronomic ratings are saved inside the sample's Certificate of Analysis when the manager clicks **Authorize & release report**. They are also included when exporting from **Data Results** (**Analytical Results Master**).

---

## If Something Goes Wrong

- *If an instrument import fails with* **Use the exact configured measurement or input unit.** *→* Check the unit column in your instrument CSV or spreadsheet. Make sure it matches the method's configured unit before importing.
- *If the* **Cross-parameter plausibility** *panel says* **Recorded bases are missing or differ.** *→* The two tests being compared were recorded on different moisture bases (one **Air-dry** and one **Oven-dry**). Check that both tests use the same moisture basis.

---

## For the QA Person

- *One standard unit per analysis*: Each soil test uses one standard reporting unit. When a method formula converts raw bench numbers (such as titration mL or extract mg/L) into the final soil value, the calculation steps are saved in **Recorded calculation evidence**.
- *Configurable cross-check thresholds*: A **Laboratory Manager** or **System Administrator** can adjust the five cross-parameter rules in **Policies**:
  - **Texture closure**: checks whether Sand + Silt + Clay equals 100 % within **Texture closure tolerance (%)** (default 2 %; flags **Texture closure is outside the lab tolerance.**).
  - **Exchangeable bases / CEC**: checks whether Ca + Mg + K + Na exceeds **Maximum exchangeable bases / CEC factor** (default 1.1; flags **Exchangeable bases exceed the lab CEC factor.**).
  - **Base saturation**: checks whether base saturation exceeds **Maximum base saturation (%)** (default 100 %; flags **Base saturation exceeds the lab limit.**).
  - **C:N ratio**: checks whether organic carbon divided by total nitrogen is within **Minimum C:N ratio** and **Maximum C:N ratio** (default 8 to 25; flags **C:N is outside the lab limits.**).
  - **Carbonate / water pH**, **KCl pH / water pH**, and **CaCl₂ pH / water pH**: flags **Carbonate is positive below the lab water-pH limit.** (default pH 7.0) or **Salt pH is not below water pH.**
