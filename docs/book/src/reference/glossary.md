# Glossary of Laboratory, Quality Control & System Terms

A plain-language reference for laboratory, quality control (QC), soil chemistry, and system terms used across SoilFER LIMS.

---

## 1. Sample Intake, Preparation & Workflow Terms

| Term | Plain-Language Meaning |
| :--- | :--- |
| **Accession / Laboratory Sample Code** | The unique barcode identifier assigned by the laboratory when a sample arrives (for example, `NRL-26-000142C`). Used inside the lab so technicians work blind to client details. |
| **Air-Dry Basis (`AIR_DRY`)** | Reporting analytical results per kilogram of soil dried to equilibrium with ambient laboratory air ($< 40^\circ\text{C}$), rather than oven-dried at $105^\circ\text{C}$. |
| **Aliquot** | A measured sub-portion of a prepared soil sample (weight in grams) or chemical extract (volume in millilitres) taken for a specific test. |
| **Amendment (`CLERICAL` / `SCIENTIFIC`)** | A formal, audited process for correcting a sample after its Certificate of Analysis has already been issued. **Clerical** amendments fix text/metadata (like a misspelled client name); **Scientific** amendments re-open test results and immediately withdraw the existing PDF report until a new Report Revision (`Rev 2+`) is approved. |
| **Analytical Attempt (`R1`, `R2`, ...)** | One complete execution of a test on a work item. `R1` is the initial measurement; `R2`, `R3`, etc. are repeat attempts created when a result is re-tested. |
| **Certificate of Analysis (COA)** | The official, signed PDF report issued to a client showing approved sample results, methods, units, moisture basis, and quality statements. |
| **Chain of Custody** | The chronological record showing everyone who handled a soil sample—from field collection and reception to drying, sub-sampling, storage, and disposal. |
| **Consignment** | A batch of physical soil samples delivered together in one shipment, box, or submission under a single Consignment Number (`CSG-...`). |
| **Container (`SampleContainer`)** | A barcoded jar, bag, vial, or packet holding either the original field sample or a prepared sub-sample (`C-LAB-YY-000001K`, e.g., $2\text{ mm}$ archive jar or $< 100\ \mu\text{m}$ MIR vial). |
| **Override with Caveat** | Accepting a sample or batch that had a minor deviation (such as arriving slightly below recommended mass or having a borderline QC warning) by recording a mandatory written reason that is disclosed on the final report. |
| **Oven-Dry Basis (`OVEN_DRY`)** | Expressing soil concentrations on a moisture-free basis (dried at $105^\circ\text{C}$ to constant weight). |
| **Pre-Analytical Gate (`DRYING`, `PREPARATION`)** | A mandatory physical preparation step (air-drying $< 40^\circ\text{C}$, crushing, and sieving to $< 2\text{ mm}$) that must be completed before wet-chemistry or spectroscopy work items unlock on the bench. |
| **Profile Reference** | An optional code (`{namespace}:{code}`, e.g., `SOILFER-GTM:PIT-01`) linking multiple soil bags taken from different depth layers of the same soil pit or sampling location. |
| **Reported Value Selection** | The explicit, saved record (`ReportedValueSelection`) of which analytical value is officially reported for a work item (for example, the mean of replicates within repeatability $r$, the latest valid attempt, or a reviewer-selected attempt). |
| **Superseded / Withdrawn Report** | When a report is being scientifically amended, the previous PDF is immediately marked **`WITHDRAWN`**. Once the corrected Revision (`Rev 2`) is issued, Revision 1 becomes **`SUPERSEDED`**. Public QR links never serve withdrawn or superseded PDFs. |
| **Work Item (`WorkItem`)** | A single requested test on a single sample (for example, *Olsen P on Sample `NRL-26-000142C`*). |

---

## 2. Quality Control (QC), Calibration & Metrology Terms

| Term | Plain-Language Meaning |
| :--- | :--- |
| **Analytical Batch (`RunBatch`)** | A group of unknown customer samples prepared and analyzed together under the same reagent lot, instrument calibration, and set of QC samples (Blanks, Duplicates, LRMs, CRMs). |
| **Blank (`BLANK` / Method Blank)** | A vessel containing all extraction and digestion reagents—but **no soil**—carried through the entire analytical procedure to check for reagent or glassware contamination. |
| **Bracketed Repeat (`REPEAT_BRACKET`)** | When a mid-run calibration check (`CCV` or `CCB`) fails, re-analyzing only the unknown samples that were measured between the last passing check and the failed check. |
| **Continuing Calibration Blank (`CCB`)** | An instrument blank run periodically during an analytical sequence to verify zero baseline drift or carryover between samples. |
| **Calibration Verification (`ICV` / `CCV`)** | A standard solution of known concentration analyzed immediately after calibration (**Initial Calibration Verification, `ICV`**, typically from a second source) or every $N$ samples (**Continuing Calibration Verification, `CCV`**) to verify that the instrument calibration remains accurate. |
| **Certified Reference Material (`CRM`)** | A soil standard purchased from an accredited metrological body (such as NIST, WEPAL, or GLOSOLAN) with a certified value and uncertainty, used to verify method **trueness** (absence of systematic bias). |
| **Control Chart (Shewhart / Levey–Jennings)** | A graph plotting LRM or CRM measurements over time against the historical mean ($\bar{x}$), warning limits ($\pm 2s$), and action limits ($\pm 3s$) to spot drift or shifts before a method goes out of control. |
| **Correlation Coefficient ($r$)** | A measure (between $0$ and $1$) of how closely calibration standards fit a straight line. Most soil methods require $r \ge 0.995$ (`qc.curveMinPoints` and `qc.curveMinR`). |
| **Duplicate (`DUPLICATE`)** | Two separate sub-portions weighed from the same homogenized soil jar and analyzed independently in the same batch to verify method **precision** (repeatability). |
| **Expanded Uncertainty ($U$)** | The interval ($\pm U$) around a reported result within which the true value is expected to lie with a stated confidence (typically $95\%$ using coverage factor $k = 2$). |
| **`J` Flag (Estimated Value)** | A standard laboratory qualifier indicating that an analyte was definitively detected ($\ge \text{LOD}$) but fell below the Limit of Quantitation ($< \text{LOQ}$), so its numeric concentration has higher relative uncertainty. |
| **Laboratory Reference Material (`LRM` / In-House Control)** | A large bulk soil sample collected, dried, thoroughly homogenized, and characterized by your own laboratory for daily batch-to-batch quality control. |
| **Limit of Detection (`LOD`)** | The lowest concentration of an analyte that can be reliably distinguished from a blank (commonly $3 \times s_{\text{blank}}$). Results below the LOD are reported as `< LOD`. |
| **Limit of Quantitation (`LOQ`)** | The lowest concentration that can be measured with acceptable quantitative precision (commonly $10 \times s_{\text{blank}}$). Depending on your lab's `results.betweenLodLoq` setting, values between LOD and LOQ are reported as `< LOQ` or with a `J` flag. |
| **Non-Conformance Report (`NCR`)** | A formal quality record opened when an analytical batch fails repeatedly (exceeding `repeats.maxAttemptsBeforeNcr`) or a major procedural deviation occurs, documenting root cause and corrective action (CAPA). |
| **Proficiency Testing (`PT`)** | An inter-laboratory comparison (such as GLOSOLAN PT or WEPAL) where multiple labs analyze blind soil samples and compare their results against the consensus value using a $z$-score. |
| **Recovery (%)** | For a CRM, LRM, or check standard, $\text{Recovery (\%)} = (\text{Measured} / \text{Target}) \times 100\%$. Typical acceptable recovery for soil extractions is $90\%–110\%$. |
| **Relative Percent Difference (`RPD`)** | A measure of agreement between two duplicate measurements ($D_1$ and $D_2$): $\text{RPD (\%)} = \frac{|D_1 - D_2|}{(D_1 + D_2)/2} \times 100\%$. Used when sample concentrations are well above the LOQ ($\ge 5 \times \text{LOQ}$). |
| **Repeatability Limit ($r$)** | The maximum acceptable absolute difference between two replicate measurements performed by the same operator on the same instrument within a short interval ($r = 2.8 \times s_r$). |
| **Westgard Rules** | A set of statistical rules applied to Control Charts to detect random error (`1-3s`, `R-4s`) or systematic drift (`2-2s`, `4-1s`, `10x`). |
| **$z$-Score** | In Proficiency Testing, $z = (x - X) / \hat{\sigma}$, where $x$ is your lab's result, $X$ is the assigned consensus value, and $\hat{\sigma}$ is the standard deviation for proficiency assessment. $|z| \le 2.0$ is Satisfactory; $2.0 < |z| < 3.0$ is Questionable; $|z| \ge 3.0$ is Unsatisfactory. |

---

## 3. Soil Chemistry & Spectroscopy Terms

| Term | Plain-Language Meaning |
| :--- | :--- |
| **Base Saturation (`BS%`)** | The percentage of Cation Exchange Capacity occupied by basic cations ($\text{Ca}^{2+}, \text{Mg}^{2+}, \text{K}^{+}, \text{Na}^{+}$): $\text{BS\%} = (\sum \text{Bases} / \text{CEC}) \times 100\%$. |
| **Cation Exchange Capacity (`CEC`)** | A measure of how many positively charged nutrient ions a soil can hold on its clay and organic matter surfaces, expressed in $\text{cmol(+)/kg}$ (numerically equal to $\text{meq/100g}$). |
| **C:N Ratio** | The mass ratio of Soil Organic Carbon ($\text{SOC}$) to Total Nitrogen ($\text{TN}$). Most agricultural topsoils fall between $8:1$ and $25:1$. |
| **Electrical Conductivity (`EC`)** | A measure of soluble salts in a soil-water extract (e.g., 1:2.5 or saturated paste), expressed in $\mu\text{S/cm}$ or $\text{dS/m}$. |
| **Exchangeable Sodium Percentage (`ESP`)** | The proportion of CEC occupied by sodium ($\text{Na}/\text{CEC} \times 100\%$). Values $\ge 15\%$ indicate a sodic soil with poor physical structure. |
| **Mid-Infrared Spectroscopy (`MIR`)** | Measuring infrared absorption across fundamental molecular vibrations ($4000\text{--}400\text{ cm}^{-1}$) on finely ground soil ($< 100\ \mu\text{m}$). |
| **Sodium Adsorption Ratio (`SAR`)** | An index of sodium hazard relative to calcium and magnesium: $\text{SAR} = \text{Na} / \sqrt{(\text{Ca} + \text{Mg})/2}$. |
| **Soil Organic Carbon (`SOC`)** | Carbon stored in soil organic matter (measured by wet oxidation such as Walkley–Black or dry combustion), expressed in $\text{g/kg}$. |
| **Texture Closure** | The physical check that the three mineral particle-size fractions ($\text{Sand \%} + \text{Silt \%} + \text{Clay \%}$) sum to $100\% \pm \text{tolerance}$ (default $\pm 2\%$). |
| **Visible–Near-Infrared (`Vis-NIR` / `NIR`)** | Measuring light reflectance across $350\text{--}2500\text{ nm}$ on $2\text{ mm}$ air-dried soil. |

---

## 4. System, Data Exchange & IT Terms

| Term | Plain-Language Meaning |
| :--- | :--- |
| **API Key (`slims_live_...`)** | A secret credential issued to an external system (such as a National Soil Information System) so it can read approved data from the Data Exchange API for specific authorized laboratories. |
| **Boundary Cursor** | A bookmark token (`nextCursor`) returned by the Data Exchange API v2 so an external harvester can resume downloading the next page of samples or incremental changes without missing or duplicating rows. |
| **Delivery Receipt** | An acknowledgement sent back to the LIMS by an external database confirming how many exported soil samples were successfully imported or quarantined. |
| **Docker / Container** | The packaging technology used to run SoilFER LIMS on a server with all its required software included. |
| **GLOSOLAN** | The **Global Soil Laboratory Network** coordinated by FAO to harmonize soil analytical SOPs and proficiency testing worldwide. |
| **KoboToolbox** | A mobile field data collection app used by field teams to record GPS coordinates, depth horizons, and bag barcodes offline and sync them to SoilFER LIMS reception. |
| **NSIS / OpenNSIS** | **National Soil Information System** / **FAO OpenNSIS**—the national database that aggregates approved soil profiles, analytical measurements, and maps across a country. |
| **RBAC** | **Role-Based Access Control**—assigning each staff member a role (Reception, Technician, Reviewer, Lab Manager, Super Admin) that controls which buttons and pages they can use. |
| **Snapshot (Data Exchange)** | A frozen, point-in-time copy of approved exchange records created via `POST /api/v2/data-exchange/snapshots` so a national database can download a large dataset page by page without changes mid-download. |
