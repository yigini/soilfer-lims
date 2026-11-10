# Glossary of Laboratory, Quality Control & System Terms

> *Time:* 5 minutes to look up any term.
> *Who can do this:* All laboratory staff, QA officers, project coordinators, and IT administrators.

Every entry below gives a one-line, plain-language definition for reception and bench staff, without software jargon.

---

## 1. Plain Words for Common On-Screen & Manual Terms

| Term You May See on Screen | One-Line Plain Definition |
| :--- | :--- |
| *Acknowledgement* | Confirming on screen that you saw a warning (such as a low sample weight or a batch quality note) and wrote a reason before continuing. |
| **Attempt** *(**Attempts** / **Attempt #1**)* | One measurement try (or round) of a test on a sample in **Workbench**; if a reviewer asks for a re-test (**Returned**), you record a second try while the first try stays saved in history. |
| *Bound Reference Lot (**Save reference bindings**)* | The specific bottle or batch of check soil that you link to a quality control slot in your batch run before entering readings. |
| **Repeat calibration bracket** | Re-testing only the group of samples measured between the last good instrument check and a failed mid-run check, instead of repeating the whole tray. |
| *Canonical Unit* | The single standard reporting unit (such as `mg/kg` or `cmol(+)/kg`) that the system uses for an analysis so numbers from different days or labs never mix up units. |
| **Chain of Custody** | The step-by-step log showing who held, moved, stored, or tested a soil bag from arrival at reception to archive storage or disposal. |
| **Consignment Batch** | A box, cooler, or delivery of several soil sample bags that arrive together at **Sample Reception** under one delivery number. |
| **Disposition** *(**Awaiting disposition**)* | The manager's recorded decision on what to do when a batch fails a quality control check (for example, repeat the batch, repeat part of the run, or accept unaffected samples with a note). |
| *Eligible* | Ready, complete, and valid to be used (for example, a finished measurement try whose quality checks are clear so a reviewer can pick it for the report). |
| *Endpoint / Payload / Idempotent* | Software terms for a data feed URL (*endpoint*), the package of data sent (*payload*), and a safe retry that never creates duplicates (*idempotent*). |
| *Gate (**Operational Gates**)* | A preparation step—such as air-drying or 2 mm sieving—that must be finished and confirmed (**Confirm Complete**) before bench tests unlock. |
| *Immutable* | Locked so it cannot be changed or overwritten later; to make an update, you save a new numbered version with a written reason while old records stay intact. |
| *Inspector* | The side or bottom detail panel that opens on screen when you click a sample, batch, or review row to see its full readings and history. |
| *Lifecycle* | The stages a soil sample passes through from field collection and reception to drying, bench testing, review, reporting, and storage. |
| **Native run** | A standard batch run created directly inside **Workbench**, with its sample order and quality control slots managed by the system. |
| **Non-Conformance** *(**Nonconformities** / **Open NCRs**)* | A formal problem record in **QA Dashboard** describing what went wrong with a damaged sample or failed batch and what action your lab took to fix it. |
| *Override (**Analysis and method overrides**)* | A custom rule set for one specific soil test or method when it needs different limits from your lab's general settings. |
| **Preset** | A ready-made starting set of quality rules (**ISO 17025 strict**, **Basic**, or **Advisory**) that a lab administrator picks in **Policies** and then tailors to the lab. |
| *Provenance* | The record of where a sample or result came from—who collected or measured it, when, on which instrument, and with which method. |
| *Receipt (**Recent Receipts**)* | The saved confirmation banner or record showing that the server accepted a sample check-in, preparation step, or batch action. |
| **Reported value** | The final result chosen by the reviewer in **Manager Task List** (**Report attempt**, **Report mean**, or **Report class from selected fractions**) to print on the client's report. |
| **Scope** *(**Role & Scope**)* | Which laboratory, test, or method a user account or policy setting applies to. |
| *Snapshot* | The saved copy of the quality rules and limits that were active at the exact moment a batch was run, kept so later rule edits never change past evaluations. |
| **Superseded** | Replaced by a newer approved measurement try or a newer corrected PDF report version (**Revision** 2 or higher). |

---

## 2. Sample Intake, Preparation & Bench Terms

| Term | One-Line Plain Definition |
| :--- | :--- |
| *Accession / Laboratory Sample Code* | The unique barcode ID printed on a soil bag at **Sample Reception** so technicians can test the soil without seeing the client's private contact details. |
| *Air-Dry Basis* | Reporting soil test results per kilogram of soil dried in warm room air (below 40 °C), which is standard for routine fertility testing (**Convert to oven-dry basis on request** in **Policies**). |
| *Aliquot* | The small, measured scoop of prepared soil (in grams) or liquid extract (in millilitres) weighed or pipetted out for one test. |
| *Amendment* | The official process to fix a released **Certificate of Analysis** by issuing a new numbered **Revision** with an **Amended report statement** while retiring the old link. |
| **Certificate of Analysis** | The official PDF report generated in **Reports** (**Result Reports**) showing the final test results, units, methods, quality summary, and QR verification link. |
| *Container / Sub-Sample Jar* | A barcoded bag, plastic jar, or small vial holding either the original field soil or a sieved or finely ground sub-sample. |
| *Oven-Dry Basis* | Expressing nutrient results on a completely water-free weight basis, calculated from a sub-sample dried at 105 °C to constant weight. |
| *Profile Reference* | An optional code linking two or more soil bags taken from different depth layers (such as 0–20 cm and 20–50 cm) of the same soil pit. |
| *Work Item* | One requested test on one soil sample—for example, Soil pH on Sample 142—listed in **My Work** and **Workbench**. |

---

## 3. Quality Control (QC), Calibration & Soil Chemistry Terms

| Term | One-Line Plain Definition |
| :--- | :--- |
| *Analytical Batch (Run)* | A tray or group of soil samples tested together on the same instrument with the same reagents and quality checks (**Blank**, **Duplicate**, and **Control**). |
| *Base Saturation* | The percentage of a soil's nutrient-holding capacity occupied by calcium, magnesium, potassium, and sodium (**Maximum base saturation (%)** in **Policies**). |
| **Blank** *(Method Blank)* | A tube or flask containing all the chemical reagents—and zero soil—run through the method to prove your water, acids, and glassware are clean. |
| **Calibration verification** | A standard solution of known strength measured right after calibrating an instrument (and during a run) to prove the instrument has not drifted. |
| *Cation Exchange Capacity (CEC)* | A measure of how many positively charged nutrient ions a soil's clay and organic matter can hold for plant roots. |
| **Certified reference material (CRM)** | An official standard soil with a certified nutrient value from an external standards body, tested in a run to verify accuracy. |
| *C:N Ratio* | The ratio of organic carbon to total nitrogen in a soil, showing how quickly organic matter breaks down (**Minimum C:N ratio** and **Maximum C:N ratio** in **Policies**). |
| **Control chart** | A graph in **QA Dashboard** that plots your check soil readings over time so you can spot gradual instrument drift before a batch fails. |
| *Correlation Coefficient* | A number (close to 1.000) showing how closely your calibration standards line up on a straight line (**Minimum curve correlation** in **Policies**). |
| **Duplicate** *(Analytical Duplicate)* | A second scoop weighed from the same prepared soil jar and tested in the same run to check that your method gives repeatable readings (**First reading** and **Second reading**). |
| *Electrical Conductivity (EC)* | A measurement of dissolved salts in a soil-water extract used to check for soil salinity. |
| **Expanded uncertainty** | The plus-or-minus margin printed next to a test result showing the range where the true soil value lies (**Certificate coverage factor (k)**). |
| **Laboratory reference material (LRM)** | Your laboratory's own large batch of air-dried, well-mixed local soil tested in every run as a daily check sample. |
| *Limit of Detection (**< LOD**)* | The smallest trace of a nutrient your method can tell apart from a clean reagent **Blank**. |
| *Limit of Quantification (**< LOQ**)* | The lowest amount of a nutrient your method can measure with reliable accuracy (**Values between detection and quantification limits** in **Policies**). |
| **MIR** *(Mid-Infrared Spectroscopy)* | Mid-infrared light (4000 to 400 inverse centimetres) shone onto finely ground soil in **Spectral Library** to estimate soil properties rapidly. |
| **NIR** *(Visible–Near-Infrared Spectroscopy)* | Visible and near-infrared light (350 to 2500 nanometres) shone onto 2 mm air-dried soil in **Spectral Library**. |
| *Proficiency Testing (PT)* | An external blind check where many soil laboratories test the same reference soil sample (such as a GLOSOLAN round) and compare scores. |
| **Recovery** | The percentage of the target value your instrument measured on a check standard or reference soil (**Minimum control recovery** and **Maximum control recovery** in **Policies**). |
| **Repeatability limit** | The largest acceptable difference between two repeat readings of the same sample run by the same technician on the same day. |
| **RPD** *(Relative Percent Difference)* | The percentage difference between two **Duplicate** readings of the same soil sample (**Maximum duplicate RPD** in **Policies**). |
| *Soil Organic Carbon (SOC)* | The carbon stored in decomposed plant and microbial matter in the soil, a core indicator of soil health and fertility. |
| *Texture Closure* | The check in **Workbench** that **SAND**, **SILT**, and **CLAY** percentages add up to 100% within your laboratory's **Texture closure tolerance (%)**. |
| **Westgard decision rules** | Automatic checks on your **Control chart** that warn you when check soil readings drift too far from the target average. |
| *z-Score (PT Score)* | A score showing how many standard deviations your lab's proficiency testing result sits from the global consensus average (**PT z-score limits**). |

---

## 4. System & Data Exchange Terms

| Term | One-Line Plain Definition |
| :--- | :--- |
| *API Key* | A secret access key created in **Admin Panel** → **National SIS & Data Exchange** (**Generate API Key**) that lets an authorized national soil database read approved results from your lab. |
| *Docker Container* | The self-contained software package that runs the SoilFER LIMS server and database on your host computer. |
| *GLOSOLAN* | The Global Soil Laboratory Network coordinated by FAO, which publishes standard soil analysis procedures and runs global proficiency testing. |
| **KoboToolbox Integration** | The connection in **Projects** → **Data connections** that brings mobile field survey forms into **Sample Reception** as **Expected** arrivals. |
| **National SIS & Data Exchange** | The connection that shares **Approved** soil results, map coordinates, and spectra with a National Soil Information System or FAO OpenNSIS. |
| *Role-Based Access Control* | The permission system in **Laboratory Staff** where each person's **System Role** (**Sample Reception Officer**, **Laboratory Technician**, **Laboratory Manager**, **Quality & Audit Officer**, **Read-Only Viewer**) controls which screens and buttons they can use. |
