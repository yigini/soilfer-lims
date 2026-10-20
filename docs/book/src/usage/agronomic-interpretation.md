# Controlled Units & Agronomic Interpretation

SoilFER LIMS combines a strict **One-Unit-Per-Analysis Controlled Vocabulary** with an **FAO 5-Tier Agronomic Classification Engine** and **Multi-Parameter Soil Chemistry Diagnostics**.

---

## 1. One Canonical Unit per Analysis

Soil laboratories around the world historically used different unit notations for the same measurement (for example, `%` vs. `g/kg` for organic carbon, `ppm` vs. `mg/kg` for phosphorus, or `meq/100g` vs. `cmol(+)/kg` for exchangeable cations).

To prevent unit confusion or 10-fold calculation errors:
- **Every analysis in SoilFER LIMS has one canonical SI-aligned reporting unit** stored on the analysis definition (`Analysis.unit`).
- When data is imported or entered, the LIMS normalizes legacy unit synonyms into the canonical unit and stores both the raw reading and the standardized value.

| Soil Property Category | Canonical Unit | Common Legacy Synonyms | Numerical Equivalence |
| :--- | :--- | :--- | :--- |
| **Soil Reaction (pH)** | `pH units` | `pH`, `dimensionless` | $1 : 1$ |
| **Electrical Conductivity (EC)** | `µS/cm` (or `dS/m` per analysis config) | `uS/cm`, `mS/cm`, `dS/m` | $1\text{ dS/m} = 1\text{ mS/cm} = 1000\text{ µS/cm}$ |
| **Soil Organic Carbon (SOC) & Total N (TN)** | `g/kg` | `%`, `g kg-1` | $1.0\% = 10.0\text{ g/kg}$ |
| **Extractable Macronutrients (P, S)** | `mg/kg` | `ppm`, `mg kg-1`, `mg/100g` | $1\text{ ppm} = 1\text{ mg/kg}$; $1\text{ mg/100g} = 10\text{ mg/kg}$ |
| **Exchangeable Cations ($\text{Ca}, \text{Mg}, \text{K}, \text{Na}$) & CEC** | `cmol(+)/kg` | `meq/100g`, `cmol/kg` | $1\text{ meq/100g} = 1\text{ cmol(+)/kg}$ |
| **Particle Size Fractions (Sand, Silt, Clay)** | `%` | `g/kg`, `percent` | $100\text{ g/kg} = 10.0\%$ |
| **Extractable Micronutrients ($\text{Fe}, \text{Zn}, \text{Cu}, \text{Mn}, \text{B}$)** | `mg/kg` | `ppm`, `mg kg-1` | $1\text{ ppm} = 1\text{ mg/kg}$ |

---

## 2. FAO 5-Tier Agronomic Classification

When agronomic interpretation is enabled for an analysis method, each approved result is classified into one of five standardized tiers on the Sample Review screen and PDF Certificate of Analysis:

| Rating Badge | Meaning | Typical Agronomic Implication |
| :--- | :--- | :--- |
| **`VERY_LOW`** | Severe deficiency or extreme acidity | Severe constraint to crop growth; priority soil amendment or nutrient application required. |
| **`LOW`** | Below optimal threshold | Likely crop response to nutrient replenishment. |
| **`OPTIMAL`** | Balanced soil fertility range | Supports healthy crop development and microbial activity; maintenance management. |
| **`HIGH`** | Above optimal range | Ample soil supply; additional nutrient input typically gives little yield return. |
| **`VERY_HIGH`** | Excessive concentration / alkalinity / salinity | Potential risk of nutrient antagonism, phytotoxicity, or environmental loss. |

> [!NOTE]
> **Focus on Analytical Truth**: SoilFER LIMS provides laboratory-grade **agronomic status classification** (`VERY_LOW` to `VERY_HIGH`) and **soil diagnostic indices** based on measured chemistry. Prescriptive field fertilizer rate calculators (which depend on local crop varieties, target yields, and fertilizer prices) are handled by downstream national decision-support tools via the Data Exchange API rather than hard-coded inside the laboratory LIMS.

---

## 3. Multi-Parameter Soil Diagnostics & Cross-Checks

When all required parameters are present on a sample, SoilFER LIMS computes derived soil indices and checks internal chemical consistency using your laboratory's configurable thresholds (`Settings → Laboratory Policy`):

### 1. USDA 12-Class Soil Texture Derivation
From measured **Sand (%)**, **Silt (%)**, and **Clay (%)**, the LIMS:
- Verifies that $\text{Sand} + \text{Silt} + \text{Clay} = 100\% \pm \text{tolerance}$ (configured via **`crossCheck.textureClosureTolerancePct`**, default $\pm 2\%$, i.e. $98\%–102\%$).
- Determines the **USDA Textural Class**: `Sand (S)`, `Loamy Sand (LS)`, `Sandy Loam (SL)`, `Loam (L)`, `Silt Loam (SiL)`, `Silt (Si)`, `Sandy Clay Loam (SCL)`, `Clay Loam (CL)`, `Silty Clay Loam (SiCL)`, `Sandy Clay (SC)`, `Silty Clay (SiC)`, or `Clay (C)`.

### 2. Carbon-to-Nitrogen ($\text{C:N}$) Stoichiometry
$$\text{C:N Ratio} = \frac{\text{SOC (g/kg)}}{\text{TN (g/kg)}}$$
- Checked against your lab's **`crossCheck.cnMin`** (default `8`) and **`crossCheck.cnMax`** (default `25`) bounds during Stage 2 sample review.

### 3. Exchangeable Bases, CEC & Base Saturation
- **Sum of Exchangeable Bases**: $\sum \text{Bases} = \text{Ca}^{2+} + \text{Mg}^{2+} + \text{K}^{+} + \text{Na}^{+}\text{ (cmol(+)/kg)}$
- **Base Saturation (%)**: $\text{BS\%} = \left(\frac{\sum \text{Bases}}{\text{CEC}}\right) \times 100\%$
- Flags the sample for review if $\sum \text{Bases} > \text{crossCheck.basesCecFactor} \times \text{CEC}$ (default $1.10 \times \text{CEC}$) or if $\text{BS\%} > \text{crossCheck.baseSaturationMaxPct}$ (default $100\%$), which often indicates free $\text{CaCO}_3$ dissolution in neutral ammonium acetate.
- Computes **$\text{Ca:Mg}$** and **$\text{Mg:K}$** cation balance ratios.

### 4. Salinity & Sodicity Indices (SAR & ESP)
- **Exchangeable Sodium Percentage ($\text{ESP}$)**:
  $$\text{ESP (\%)} = \left(\frac{\text{Exchangeable Na}}{\text{CEC}}\right) \times 100\%$$
- **Sodium Adsorption Ratio ($\text{SAR}$)**:
  $$\text{SAR} = \frac{\text{Na}}{\sqrt{(\text{Ca} + \text{Mg}) / 2}}$$
- Highlights sodicity hazards when $\text{ESP} \ge 15\%$ or $\text{SAR} \ge 13$.
