# Glossary of Laboratory, Quality Control & System Terms

> *Time:* 5 minutes to look up any term.
> *Who can do this:* All laboratory staff, QA officers, project coordinators, and IT administrators.

Every entry below starts with a plain-language sentence for bench and reception staff, followed by technical or quality-assurance context where helpful.

---

## 1. Sample Intake, Preparation & Workflow Terms

| Term | Plain-Language Meaning (First Sentence) & Technical Context |
| :--- | :--- |
| *Accession / Laboratory Sample Code* | This is the unique barcode ID printed on a soil bag when it is accepted at **Sample Reception**. It lets bench technicians test the soil without seeing the farmer's or client's private contact details. |
| *Air-Dry Basis* | This means reporting soil test results per kilogram of soil dried in warm room air (below 40 °C), which is the standard for routine fertility testing. Some clients or national maps also request conversion to an oven-dry basis (**Convert to oven-dry basis on request** in **Policies**). |
| *Aliquot* | An aliquot is the small, measured scoop of prepared soil (in grams) or liquid extract (in millilitres) weighed or pipetted out for one test. |
| *Amendment (Post-Release Report Correction)* | An amendment is the official way to fix a sample or **Certificate of Analysis** after the PDF report has already been released. Instead of overwriting the old PDF, SoilFER LIMS issues a new numbered **Revision** with an **Amended report statement** and retires the old public link. |
| **Attempt** *(Work Attempt 1, 2, ...)* | An attempt is one run of a test on a sample in **Workbench**. Attempt 1 is the first measurement; if a manager asks for a re-test (**Returned**), you record Attempt 2 while Attempt 1 stays safely in history. |
| **Certificate of Analysis** | This is the official PDF report generated in **Reports** (**Result Reports**) for a client. It lists the approved test values, units, analytical methods, preparation summary, quality control statement, and a QR verification link. |
| *Chain of Custody* | Chain of custody is the step-by-step diary showing everyone who moved, stored, or tested a soil bag from reception (**Received**) to archive (**Archived**) or disposal (**Disposed**). |
| *Consignment* | A consignment is a box or shipment of several soil bags that arrive together at **Sample Reception** under one shipment number. |
| *Container / Sub-Sample Jar* | A container is a barcoded bag, plastic jar, or small vial holding either the original field soil or a sieved or finely ground sub-sample. |
| *Oven-Dry Basis* | This means expressing nutrient concentrations on a completely water-free weight basis (calculated from a sub-sample dried at 105 °C to constant weight). |
| *Preparation Gate (Drying & Sieving)* | A preparation gate is a required physical step—such as air-drying and 2 mm sieving—that must be ticked off (**Confirm Complete**) before chemical or spectral tests unlock in **Workbench**. |
| *Profile Reference* | A profile reference is an optional code that links two or more soil bags taken from different depth layers (such as 0–20 cm and 20–50 cm) of the same soil pit. |
| **Reported value** *(Selection)* | When a test has more than one attempt or replicate, the **Reported value** is the reviewer's saved choice in **Manager Task List** (**Report attempt**, **Report mean**, **Report class from selected fractions**, or **Not reportable**). |
| **Superseded** *Report* | A **Superseded** report is an older PDF revision that has been replaced by a newer amended report revision. |
| *Work Item* | A work item is one requested test on one soil sample—for example, Soil pH on Sample 142—that appears in **My Work** and **Workbench**. |

---

## 2. Quality Control (QC), Calibration & Metrology Terms

| Term | Plain-Language Meaning (First Sentence) & Technical Context |
| :--- | :--- |
| *Analytical Batch (Run)* | A batch is a tray or group of client soil samples tested together on the same instrument with the same reagents and quality control checks (**Blank**, **Duplicate**, and **Control**). |
| **Blank** *(Method Blank)* | A **Blank** is a tube or flask containing all the chemical reagents—and zero soil—carried through the whole extraction to check that your water, acids, and glassware are clean. |
| **Repeat calibration bracket** | When a mid-run calibration check drifts, **Repeat calibration bracket** means re-running only the samples measured after the last good calibration check rather than repeating the whole tray. |
| **Calibration verification** | This is a standard solution of known strength measured right after calibrating an instrument (and periodically during a long run) to prove the instrument has not drifted. |
| **Certified reference material (CRM)** | A **Certified reference material (CRM)** is a reference soil bought from an official standards body with a certified nutrient value and uncertainty. Running it checks that your method gives the true answer without bias. |
| **Control chart** | A **Control chart** is a graph in **QA Dashboard** that plots your check soil results week after week so you can spot gradual instrument drift before a batch fails. |
| *Correlation Coefficient* | This number (close to 1.000) shows how closely your calibration standards line up on a straight calibration curve (**Minimum curve correlation** in **Policies**). |
| **Duplicate** *(Analytical Duplicate)* | A **Duplicate** is a second scoop weighed from the same prepared soil jar and tested in the same batch to prove your method gives repeatable numbers (**First reading** and **Second reading**). |
| **Expanded uncertainty** | **Expanded uncertainty** is the plus-or-minus margin printed next to a test result showing the range where the true soil value lies (usually at 95% confidence using **Certificate coverage factor (k)** equal to 2). |
| **Laboratory reference material (LRM)** | A **Laboratory reference material (LRM)** is a large bucket of local soil that your own laboratory dried, mixed thoroughly, and tested many times to use as a daily check soil in every batch. |
| *Limit of Detection (LOD)* | The detection limit is the smallest trace of a nutrient your method can tell apart from a clean reagent **Blank**. |
| *Limit of Quantitation (LOQ)* | The quantitation limit is the lowest nutrient level your method can measure with reliable numerical accuracy. In **Policies**, **Values between detection and quantification limits** controls whether trace readings below this limit print as **Report below quantification limit** (**< LOQ**) or **Report value with a flag**. |
| *Non-Conformance Report (NCR)* | A non-conformance record in **QA Dashboard** is a structured note explaining what went wrong when a batch or sample had a serious quality problem and what your laboratory did to fix the cause. |
| *Proficiency Testing (PT)* | Proficiency testing is an external blind check where many soil laboratories test the same reference soil sample (such as a GLOSOLAN round) and compare their scores. |
| **Recovery** | **Recovery** is the percentage of the target value your instrument measured on a check standard or reference soil (100% means an exact match; limits are set via **Minimum control recovery** and **Maximum control recovery** in **Policies**). |
| **RPD** *(Relative Percent Difference)* | **RPD** is the percentage difference between two **Duplicate** readings of the same soil sample, compared against **Maximum duplicate RPD** in **Policies**. |
| **Repeatability limit** | The **Repeatability limit** is the largest acceptable difference between replicate readings of the same sample run by the same analyst on the same day. |
| **Westgard decision rules** | **Westgard decision rules** are automatic checks on your **Control chart** that warn you when check soil points drift too far from the target average or trend to one side. |
| *z-Score (PT Score)* | A z-score measures how many standard deviations your laboratory's proficiency testing result sits from the global consensus average (scores within 2 are satisfactory; boundaries are set in **PT z-score limits**). |

---

## 3. Soil Chemistry & Spectroscopy Terms

| Term | Plain-Language Meaning (First Sentence) & Technical Context |
| :--- | :--- |
| *Base Saturation* | Base saturation is the percentage of a soil's nutrient-holding capacity occupied by calcium, magnesium, potassium, and sodium (checked against **Maximum base saturation (%)** in **Policies**). |
| *Cation Exchange Capacity (CEC)* | Cation exchange capacity measures how many positively charged nutrient ions a soil's clay and organic matter can hold onto for plant roots. |
| *C:N Ratio* | The carbon-to-nitrogen ratio compares organic carbon against total nitrogen in a soil, indicating how quickly organic matter breaks down (checked against **Minimum C:N ratio** and **Maximum C:N ratio** in **Policies**). |
| *Electrical Conductivity (EC)* | Electrical conductivity measures dissolved salts in a soil-water extract to check for soil salinity. |
| **MIR** *(Mid-Infrared Spectroscopy)* | **MIR** shines mid-infrared light (4000 to 400 inverse centimetres) onto finely ground soil in **Spectral Library** to estimate soil properties rapidly alongside wet chemistry. |
| *Soil Organic Carbon (SOC)* | Soil organic carbon is the carbon stored in decomposed plant and microbial matter in the soil, a core indicator of soil health and fertility. |
| *Texture Closure* | Texture closure is the check in **Workbench** that **SAND**, **SILT**, and **CLAY** percentages add up to 100% within your laboratory's **Texture closure tolerance (%)**. |
| **NIR** *(Visible–Near-Infrared Spectroscopy)* | **NIR** measures light reflectance (350 to 2500 nanometres) on 2 mm air-dried soil in **Spectral Library**. |

---

## 4. System, Data Exchange & IT Terms

| Term | Plain-Language Meaning (First Sentence) & Technical Context |
| :--- | :--- |
| *API Key* | An integration key generated in **Admin Panel** → **National SIS & Data Exchange** (**Generate API Key**) that lets an authorized national soil database read approved results from your laboratory. |
| *Docker Container* | The self-contained software package that runs the SoilFER LIMS server and database on your host machine. |
| *GLOSOLAN* | The Global Soil Laboratory Network coordinated by FAO, which publishes harmonized soil analysis standard operating procedures and runs global proficiency testing. |
| **KoboToolbox Integration** | The connection in **Projects** → **Data connections** that brings field mobile survey forms into **Sample Reception** as **Expected** arrivals. |
| **National SIS & Data Exchange** | The gateway that publishes **Approved** soil sample records, replicate observations, map coordinates, and spectra to a National Soil Information System or FAO OpenNSIS. |
| *Role-Based Access Control* | The permission system in **Laboratory Staff** where each person's **System Role** (**Sample Reception Officer**, **Laboratory Technician**, **Laboratory Manager**, **Quality & Audit Officer**, **Read-Only Viewer**) determines which screens and buttons they can use. |
