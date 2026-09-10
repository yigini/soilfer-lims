# Research, terminology and evidence policy

## Documentation and interaction references

- [Microsoft — Writing step-by-step instructions](https://learn.microsoft.com/en-us/style-guide/procedures-instructions/writing-step-by-step-instructions): supports concrete numbered actions, clear location and a finishing step. Applied here as short procedure phases with expected outcomes; it is not a mandate to compress an entire complex lab workflow into four sentences.
- [Microsoft — Procedures and instructions checklist](https://learn.microsoft.com/en-us/style-guide/checklists/procedures-and-instructions-checklist): supports task-appropriate instructions and touch-neutral action language. Applied to exact Select/Open/Enter verbs and relevant figures.
- [Diátaxis](https://diataxis.fr/): distinguishes learning, task completion, reference and explanation. Applied as Learn the workflow, task guides, reference and concept sections, with problem solving as a prominent practical entry. This is an information architecture choice, not a technical framework dependency.
- [W3C — Consistent Help](https://www.w3.org/WAI/WCAG22/Understanding/consistent-help): supports predictable placement of repeated help mechanisms. Applied to the existing application header and a consistent return-to-work experience.
- [W3C — Page Structure Tutorial](https://www.w3.org/WAI/tutorials/page-structure/): supports meaningful regions, headings and navigation. Applied to article contents, library navigation and mobile reflow.
- [W3C — Writing for Web Accessibility](https://www.w3.org/WAI/tips/writing/): supports informative headings and comprehensible content. Applied to readable article structure, labeled illustrations and useful alternative text.

These references were checked during preparation. They guide documentation design; they do not establish that this LIMS implementation or its scientific methods comply with a standard.

## Scientific sources and limits

[FAO/GLOSOLAN — Standard Operating Procedures](https://www.fao.org/global-soil-partnership/glosolan-old/soil-analysis/standard-operating-procedures/fr/) provides a source collection for harmonized laboratory methods. [The Spanish GLOSOLAN SOP page](https://www.fao.org/global-soil-partnership/pillars-action/5-harmonization/glosolan/sops/es/) is also a useful terminology reference. Some FAO pages are legacy URLs; verify the applicable document edition and actual method before using them in published guidance.

For method-specific articles, the author must use the lab's controlled SOP and enabled instrument/import profile as the primary applicability evidence. External scientific references can clarify a concept, but cannot override a local method's validated settings or silently install a new scientific rule. Instrument formats require the actual vendor/version export documentation and a successfully tested fixture.

Do not reproduce whole copyrighted manuals. Summarize the relevant concept, cite the specific source and link the permitted controlled SOP. Provide user-focused input/interpretation explanations without inventing method temperatures, QC limits or calibration rules.

## Method documentation checklist

| Family | Meaning that must be explained | Evidence the author must obtain |
|---|---|---|
| pH | Method variant, medium/basis, observed result and QC context | Enabled method schema and controlled measurement SOP; real field labels. |
| Electrical conductivity | Unit, extraction basis and any displayed conversion | Method configuration; documented conversion provenance, not an improvised formula. |
| Texture | Sand/silt/clay as a panel, configured size boundaries, total validation and class scheme | Panel schema, actual tolerance, classifier version and report mapping. |
| MIR/NIR | Spectrum versus scalar, axis/signal representation, scan/replicate and file profile | Verified exporter/parser fixture, instrument settings and acquisition/QC SOP. |
| Predicted properties | Model/version, applicability, provenance and difference from reference measurement | Enabled model pipeline, reference linkage and review/report behavior. |
| Calculated results | Contributing values, formula/version and propagation of corrections | Actual calculation schema and historical version behavior. |
| Operational tasks | Checklist evidence, confirmation receipt and next prerequisite | Real confirmation API/UI and method-applicability rules. |
| QC/repeats | Control/duplicate/sample role and permitted response to failure | Configured QC and repeat workflows; exact role decisions. |

## Terminology management

terminology.json supplies a small proposed five-language editorial glossary for the redesign. It is not a completed scientific translation review. Each entry has a stable concept, proposed labels and a meaning that must not change. Confirm regional usage with the platform's established translation catalogue and lab terminology owners.

Distinguish these terms everywhere: draft, saved on device, saved on server, recorded determination, submitted sample, accepted result, approved sample, released report and externally delivered result. Also distinguish received versus expected material, file import versus spectral quality acceptance, and model prediction versus measured reference.

Prefer full parameter names in user-facing text; stable codes remain available in reference/detail for traceability. Do not translate units, UUIDs, identifiers, placeholders or formula syntax. Display numbers/dates according to the selected locale without changing stored scientific values.

## Source and live evidence

source-baseline.json records the source hash for this review's key files and the content-size observation. traceability.json links route patterns and proposed guides, including aliases and tab-qualified contexts. Candidate source paths in inventory briefs must be verified; an absent file is a discovery task, not evidence that a capability exists.

Observed live: Help home displays eight subject categories and a short card collection; drying article renders four generic steps and no annotated example. Source-observed: current workbench has separate draft/paste, recording and submission stages; operational completion uses Confirm Complete and Checklist Verified receipts; the spectral import names four stages. Full operational end-to-end and all-role live testing remain implementation acceptance work.
