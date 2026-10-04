# Research basis and method decisions

Research checked on 4 October 2026. Sources below are primary institutional guidance or original publications. Scientific statements are distinguished from **proposed software design**. A source-specific QC frequency is not a universal requirement for all soil methods or all laboratories.

## Sources that directly change the design

### R01 — FAO GLOSOLAN method catalogue

[Official SOP catalogue](https://www.fao.org/global-soil-partnership/Scientific-and-technical-support/networks/the-glosolan/standard-operating-procedures-(sops)/en).

The catalogue separates pH, conductivity, available phosphorus methods, carbon/nitrogen methods, CEC, moisture, bulk density, and other procedures. It includes a 2026 loss-on-ignition document. This is a useful starting catalogue, not evidence that one set of limits fits every procedure. **Design:** each enabled method needs an explicit, approved local revision and configuration; importing a catalogue entry must not activate a test automatically.

### R02 — Soil pH, GLOSOLAN-SOP-06, version 1, 11 February 2021

[Full FAO SOP](https://openknowledge.fao.org/3/cb3637en/cb3637en.pdf), §§8–10; PDF pages 14–15 for reporting/QC. Downloaded and text-extracted successfully after browser access difficulties.

The SOP specifies replicate analysis every 10–20 samples, agreement within **0.1 pH unit**, and a duplicated check material in each batch. It also distinguishes calibration with buffers from soil measurement, and requires the suspension medium to be reported. These are source-specific starting rules for a lab adopting this method. **Design:** use absolute pH differences and method-matched control values; do not evaluate pH duplicate precision by a generic percentage or apply a zero-concentration blank criterion. Store medium, soil/solution ratio, calibration evidence, and raw precision separately from report rounding. A local revision must resolve its exact replicate interval and control rules.

### R03 — Soil electrical conductivity, GLOSOLAN-SOP-07, version 1, 13 January 2021

[Full FAO SOP hosted by IRD](https://horizon.documentation.ird.fr/exl-doc/pleins_textes/divers21-02/010081188.pdf), §§10.2–10.3, PDF pages 10–11. Full text inspected.

For this 1:5 procedure, the SOP calls for duplicate analysis of **10% of batch samples**, plus at least a duplicated control material/check sample in every batch and control-chart monitoring. It discusses RPD; its discussion of an aqueous field-duplicate rule of thumb must not become an automatic soil precision limit. **Design:** encode count and coverage rules separately from the precision threshold. Plan physical positions from the resulting controls. Do not add a mandatory EC blank merely because the current generic application expects one.

### R04 — Handling and preparation, GLOSOLAN-SOP-01, version 2

[Full FAO SOP](https://openknowledge.fao.org/3/ca8283en/ca8283en.pdf), effective October 2019, distributed in the 2020 catalogue; §§7.2–7.10, PDF pages 6–8. Full text inspected.

Preparation depends on sample condition and the analytical requirements. The procedure covers unique identification of subsamples, documented preparation/equipment, finer grinding where needed, storage movements, and return/disposal. It describes low-temperature drying where appropriate, not a universal instruction to oven-dry every sample. **Design:** replace one global drying/preparation gate with method-linked material routes. Preserve an as-received portion where required; distinguish drying a preparation portion from determining moisture correction on another portion.

### R05 — FAO guidance for an internal QC soil, 2020

[Full guidance](https://openknowledge.fao.org/3/ca9320en/ca9320en.pdf), PDF pages 5–8. Full text inspected.

The guidance addresses representative material, homogeneity, stability, preparation, packaging, and labeling. It cautions that internal QC material alone does not establish metrological traceability. **Design:** classify in-house control soil separately from a certified reference material; record preparation, bottle/lot, suitability, assigned-value source, and ongoing stability. Do not label every manually entered target value “CRM.” Usable life must come from the material's actual documentation and verification, not a blanket software expiry.

### R06 — Nordtest NT TR 569, edition 6.1, approved March 2026

[Publication page](https://www.nordtest.info/wp/2026/03/18/internal-quality-control-handbook-for-chemical-laboratories-trollboken-troll-book-nt-tr-569-english-edition-6/) and [full handbook](https://www.nordtest.info/wp/wp-content/uploads/2026/08/NT_TR_569_ed6_1Eng.pdf), particularly chapters 7–10. Full text inspected. This supersedes older editions for this design review.

The update emphasizes target limits, false-alarm frequency, and two daily evaluation rules. For the illustrated warning/action approach, an action-limit excursion or two of three points beyond the warning limit on the same side indicates loss of control. The handbook distinguishes daily decisions from longer-term trends and addresses investigation/reanalysis. **Design:** implement explicit versioned rule sets and preserve failed observations. Do not combine every familiar chart rule into an indiscriminate automatic rejection system. A new control lot or changed method needs a documented chart transition; later statistical recalculation must not silently change historical release decisions.

### R07 — Eurachem, Fitness for Purpose, third edition, 2025

[Official publication](https://www.eurachem.org/index.php/publications/guides/mv), [full guide](https://www.eurachem.org/images/stories/Guides/pdf/MV_guide_3rd_ed_V1_EN.pdf). Full text inspected, including validation performance characteristics and use of validation information.

The guide treats validation/verification, sample handling, calibration, precision, bias, working range, and continuing performance as connected. **Design:** a method's acceptance settings need an evidence source and approving role. “Default QC passed” cannot substitute for a validated range, detection/quantification treatment, and intended-use criteria. Qualification of a software workflow does not validate the analytical method itself.

### R08 — Eurachem, Blanks in Method Validation, second edition, 2025

[Official supplement and download](https://www.eurachem.org/index.php/publications/guides/blanks-in-method-validation). Publication page inspected; do not claim a full section-by-section review of the PDF.

Different blanks answer different questions, and a suitable matrix blank may be difficult to obtain. **Design:** separately name reagent, full-method/preparation, calibration, and carryover blanks where the method uses them. Store the stage and analytes they cover; the word “blank” alone is insufficient. Blank correction, where allowed, must be a documented calculation rule with the original observations retained.

### R09 — ISRIC WoSIS analytical method coding, 2025

[Full report](https://www.isric.org/sites/default/files/2025_WoSIS_coding_analytical_method_descriptions.pdf), especially §2.2 and method-option tables. Downloaded and text-extracted; relevant sections inspected.

Many soil properties are operationally defined by their method. The report illustrates why pH needs preparation/solution/ratio details and why available-P and CEC procedures cannot be treated as interchangeable without appropriate evidence. **Design:** identity and reporting must include the actual method options. Do not collapse Olsen, Bray, and Mehlich results into a generic phosphorus value or automatically apply one agronomic interpretation to them all. Export method identity alongside units and basis.

### R10 — SSSA North American Proficiency Testing program

[Program overview](https://www.naptprogram.org/about/) and [reference sample information](https://www.soils.org/napt-program/samples). Both inspected.

NAPT provides external performance comparison and reference sample resources for agricultural testing. **Design:** support blind proficiency-test jobs, method-group comparison, results, and corrective actions separately from routine internal QC. A commercially obtained reference sample is not automatically certified for every analyte/method. Verify its accompanying assigned-value documentation before using it for a claim of trueness. No purchase or enrollment is assumed by this plan.

### R11 — FAO Soils Bulletin 74, laboratory quality management, 1998

[Chapter 7, quality of analytical procedures](https://www.fao.org/4/w7295e/w7295e09.htm) and [chapter 8, internal quality control](https://www.fao.org/4/w7295e/w7295e0a.htm). Full relevant chapters inspected.

Useful soil-lab background for the different purposes of reference materials, check standards, duplicate precision, and control charts. Its age matters: use the newer method SOPs and Nordtest edition for current configuration decisions. **Design:** a control panel should explain which property of the process each control evaluates, rather than display one unexplained green badge.

### R12 — W3C WCAG 2.2, target size minimum

[Official explanation](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html). Inspected.

The AA criterion uses a 24-by-24 CSS-pixel minimum with defined alternatives/exceptions. **Design:** adopt a larger 44–48-pixel target for frequent gloved bench actions and test with actual lab hardware. The larger value is this plan's usability target, not a claim about the AA minimum. Include keyboard access, visible focus, non-color status labels, and accessible error recovery.

## Sources considered with limits

- [USDA KSSL laboratory guidance](https://www.nrcs.usda.gov/resources/guides-and-instructions/kellogg-soil-survey-laboratory-guidance) was inspected as a primary reference directory. The linked [SSIR 42 version 6 methods PDF](https://www.nrcs.usda.gov/sites/default/files/2022-10/SSIR42-v6-pt1.pdf) failed full retrieval in this session. No exact temperature, holding time, or QC acceptance number in this packet is asserted on the authority of that unread PDF.
- [EPA SW-846 QC FAQ, archived](https://archive.epa.gov/epawaste/hazard/testmethods/web/html/faqs_qc.html) and [Method 6010D text](https://nepis.epa.gov/Exe/ZyPURL.cgi?Dockey=P1017DDQ.txt) were consulted for environmental analytical context. They are not default operating rules for the user's routine fertility laboratory. OCR ambiguities in the method text were not converted into numeric software limits. Use the controlled local instrument method before implementing any specific ICP QC rule.
- No licensed ISO standard was fully reviewed. The proposed traceability and review controls may support an accreditation program, but this audit does not claim ISO/IEC 17025 compliance or certification.

## How to apply the research

For each enabled test, a laboratory method owner must supply: controlled SOP/revision; sample fraction and preparation; medium/extractant and ratio; instrument/calibration process; result unit and basis; relevant QC types/counts/coverage; acceptance calculations and limits; replicate reporting rule; uncertainty/reporting conventions; and action on failure. Store the source and local approval with the configuration.

If the laboratory adopts a cited GLOSOLAN procedure unchanged, its exact requirements become an approved profile after local verification. If it uses another method or a modified revision, retain the relevant identity and validate that configuration. An unspecified rule remains visibly unconfigured and blocks final release where required. The software must never silently borrow a convenient limit from another analysis.
