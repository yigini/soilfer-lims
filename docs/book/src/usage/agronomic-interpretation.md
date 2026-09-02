# Controlled Units & Agronomic Interpretation

SoilFER-LIMS features an integrated **FAO 5-Tier Agronomic Interpretation Engine** coupled with a centralized **Controlled Unit Vocabulary**.

---

## 📏 Controlled Unit Vocabulary & Normalization

Soil laboratories across different countries often express determinations in varying units (e.g. `%` vs `g/kg`, `ppm` vs `mg/kg`, `meq/100g` vs `cmol(+)/kg`). SoilFER-LIMS automatically standardizes incoming bench results into standard controlled units:

| Soil Property | Standard Unit | Accepted Synonyms | Auto-Conversion Rule |
| :--- | :--- | :--- | :--- |
| **Soil Reaction / pH** | `pH units` | `pH`, `dimensionless` | None |
| **Electrical Conductivity (EC)** | `µS/cm` | `uS/cm`, `microS/cm`, `dS/m`, `mS/cm` | Multiply `dS/m` or `mS/cm` $\times 1000$ |
| **Soil Organic Carbon (SOC) / SOM** | `g/kg` | `g/kg`, `g kg-1`, `%`, `percent` | Multiply `%` $\times 10$ ($1.0\% = 10.0\text{ g/kg}$) |
| **Total Nitrogen (TN)** | `g/kg` | `g/kg`, `g kg-1`, `%`, `percent` | Multiply `%` $\times 10$ |
| **Available Phosphorus (Olsen, Bray, Mehlich)** | `mg/kg` | `mg/kg`, `ppm`, `mg kg-1`, `mg/100g` | Multiply `mg/100g` $\times 10$; `ppm` $\times 1$ |
| **Exchangeable Cations (Ca, Mg, K, Na) & CEC** | `cmol(+)/kg`| `cmol(+)/kg`, `cmol/kg`, `meq/100g` | $1\text{ meq/100g} = 1\text{ cmol(+)/kg}$ |
| **Particle Size Fractions (Sand, Silt, Clay)** | `%` | `%`, `percent`, `g/kg` | Multiply `g/kg` $\times 0.1$ ($600\text{ g/kg} = 60.0\%$) |
| **Micronutrients (Fe, Zn, Cu, Mn, B)** | `mg/kg` | `mg/kg`, `ppm`, `mg kg-1` | `ppm` $\times 1$ |

---

## 🌿 FAO 5-Tier Agronomic Classification

Every analytical determination is automatically evaluated against FAO Soil Fertility guidelines:

- `VERY_LOW`: Severe deficiency or extreme reaction (e.g. pH $< 4.5$, $\text{SOC} < 6.0\text{ g/kg}$, $\text{P-Olsen} < 7\text{ mg/kg}$).
- `LOW`: Deficient condition where crop yields are limited without nutrient replenishment.
- `OPTIMAL`: Agronomically balanced concentration supporting healthy crop development and soil biological activity.
- `HIGH`: Rich nutrient concentration where additional fertilization provides negligible return.
- `VERY_HIGH`: Excessive concentration or extreme alkalinity/salinity with potential phytotoxicity or nutrient antagonism risks.

---

## 🔬 Multi-Parameter Soil Metrology

In addition to single-parameter ratings, SoilFER-LIMS executes holistic cross-parameter soil diagnostics:

### 1. USDA 12-Class Textural Derivation
Automatically calculates the textural triangle classification from particle size fractions:
- Textural Classes: `Sand (S)`, `Loamy Sand (LS)`, `Sandy Loam (SL)`, `Loam (L)`, `Silt Loam (SiL)`, `Silt (Si)`, `Sandy Clay Loam (SCL)`, `Clay Loam (CL)`, `Silty Clay Loam (SiCL)`, `Sandy Clay (SC)`, `Silty Clay (SiC)`, `Clay (C)`.
- Closure Check: Validates that $\text{Sand \%} + \text{Silt \%} + \text{Clay \%} = 100\% \pm 2.0\%$.

### 2. C:N Stoichiometry & Organic Equilibrium
Calculates the Carbon-to-Nitrogen ratio:
$$\text{C:N Ratio} = \frac{\text{SOC (g/kg)}}{\text{TN (g/kg)}}$$
- **Optimal Equilibrium ($10.0 - 15.0$)**: Balanced organic matter decomposition and nitrogen mineralization.
- **High ($> 20.0$)**: Slow decomposition; potential nitrogen immobilization.
- **Low ($< 8.0$)**: Rapid mineralization; nitrogen leaching risk.

### 3. Cation Exchange & Base Saturation %
- **Sum of Bases**: $\sum \text{Bases} = \text{Ca} + \text{Mg} + \text{K} + \text{Na} \text{ (cmol(+)/kg)}$.
- **Base Saturation %**: $\text{BS\%} = \frac{\sum \text{Bases}}{\text{CEC}} \times 100\%$.
- **Cation Ratios**:
  - $\text{Ca:Mg Ratio}$: Alerts if $< 2.0$ (calcium deficiency or magnesium toxicity risk).
  - $\text{Mg:K Ratio}$: Alerts if $< 1.0$ (potassium-induced magnesium deficiency).

### 4. Salinity & Sodicity Risk (SAR / ESP)
- **Sodium Adsorption Ratio (SAR)**: $\text{SAR} = \frac{\text{Na}}{\sqrt{(\text{Ca} + \text{Mg})/2}}$.
- **Exchangeable Sodium Percentage (ESP)**: $\text{ESP} = \frac{\text{Na}}{\text{CEC}} \times 100\%$.
- Flags sodic soil hazards when $\text{SAR} \ge 13.0$ or $\text{ESP} \ge 15.0\%$.
