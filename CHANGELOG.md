# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html) (see [VERSIONING.md](VERSIONING.md)).

---

## [1.6.1] - 2026-10-04

### Fixed
- New internal work, result, QC and audit identifiers use UUIDs to prevent collisions during bulk writes (Audit 1.4, #181).
- Texture derivation commits with its source results and supersedes only the matching replicate. A storage failure rolls back the complete save.
- Legacy imports atomically retain and supersede previous results for the same replicate. A read-only diagnostic reports existing duplicate-current groups.

## [1.6.0] - 2026-10-04

### Added
- Per-laboratory policy settings with Strict, Basic and Advisory presets, reasoned laboratory/analysis/method overrides and a versioned change history (Audit 1.0, #219).
- Policies page with effective values and sources, structured editors for managers and read access for all laboratory roles.
- Additive policy storage and a dry-run legacy separator migration that preserves original laboratory settings and historical analytical records.

### Changed
- QC limits and tray profiles resolve from laboratory policy. QC evaluations, exported selections and generated reports retain the policy version they used.
- Number formats resolve from a single policy snapshot, with an atomic compatibility copy for image rollback and mandatory reasons for changes.

## [1.5.0] - 2026-10-04

### Added
- **National SIS & GloSIS Exchange Connector (Issue #140, PR #158)**: Machine-to-machine data exchange integration with OpenNSIS (ISO 28258), exposing `profileCode`, depth horizon boundaries (`topCm`/`bottomCm`), and 503 exchange eligibility guards (`exchangePolicyService.js`).
- **Canonical Versioning & Health API**: Added `VERSIONING.md`, unified `client/package.json` and `server/package.json` baselines at `1.5.0`, and added `/api/version` and `/api/health` version metadata responses.
- **Dynamic Frontend Version Badging**: Injected build-time compile constants (`__APP_VERSION__`, `__BUILD_DATE__`) across `About.jsx`, `TechStack.jsx`, and `SampleWorkflowMap.jsx`.

### Fixed
- **Technician Workbench Mobile Card View (Audit Phase 0, Issue #173)**: Corrected prop forwarding (`value`, `onChange`, `values`, `checks`, `onConfirm`) in `SingleSampleEditor.jsx`, restoring mobile and small-tablet result entry without crashes.
- **Instrument Selection Deadlock (Audit Phase 0, Issue #173)**: Unblocked equipment selection in `WorkbenchInspector.jsx` when an analysis method requires an instrument, allowing technicians to assign qualified bench instruments directly.
- **Keyboard Grid Navigation (Audit Phase 0, Issue #173)**: Fixed Enter-to-next-row navigation by aligning input label selectors with sample display identifiers.
- **QC Form Data Integrity (Audit Phase 0, Issue #163)**: Purged pre-filled fabricated passing values (`0.02`, `7.03`, `6.87`) from `BatchModal.jsx`; all batch QC determinations now require explicit empirical entry.
- **Batch Duplicate Near-LOQ Precision Guard (Audit Phase 0, Issue #177)**: Added mathematical guards for zero/negative means and near-LOQ pairs ($< 5\times\text{LOQ}$) using absolute difference thresholds rather than misleading relative percent difference (RPD) inflation.
- **Report PDF Truthfulness & Monotonic Versioning (Audit Phase 0, Issues #170, #171)**: Enforced strictly monotonic report numbering (`RPT-*-vN`), atomic supersession of older report versions, and audit disclaimers on manager overrides.
- **Authentic Intake Arrivals (Audit Phase 0, Issue #174)**: Stopped batch intake from inventing default sample mass and moisture, preserving authentic field arrival conditions.
- **Shared Locale-Aware Decimal Parsing (Audit Phase 0, Issue #176)**: Unified decimal parsing supporting both dot and comma notations across all results entry paths.

---

## [1.4.0] - 2026-09-20

### Added
- **Received Mass & Analytical Sufficiency (RC-01)**: Live mass sufficiency gauge checking ordered tests plus 100g retention buffer with explicit shortfall override tracking (`MASS_DEFICIT_OVERRIDE`).
- **Arrival Conditions & Photographic Evidence (RC-02, RC-03)**: Moisture on arrival states (`DRY`, `MOIST`, `WET`, `SATURATED`), foreign material inclusion chips, and photographic upload pipeline for non-conformance documentation.
- **Duplicate & Re-Submission Detection (RC-04)**: Prior receipt alerts on duplicate field IDs with explicit authorized re-submission confirmation.
- **Universal Geodesy & Offline Boundaries (RC-05, RC-08)**: Parsing Decimal Degrees, DMS, and UTM with Zone/Hemisphere; reverse geocoding proxy with offline boundary fallback.
- **Positional Uncertainty & Spatial Outlier Detection (RC-06, RC-07, RC-10, RC-11)**: Evidence-derived location confidence resisting unevidenced HIGH claims; 40km spatial outlier detection; composite radius and numeric depth cm intervals.
- **Consignments & Batch Intake (RC-12 to RC-15)**: Consignment entity model with waybill tracking; per-sample exception modal (`ACCEPTED` vs `RECEIVED_REJECTED`) with `PARTIAL` rollup; spreadsheet manifest import wizard (CSV/XLSX) with automatic column mapping.
- **Hardware Wedge Mode & Audio Cues (RC-16)**: Sub-millisecond scanner input handling, auto-refocus loop, and client-side synthesized Web Audio API sound feedback.
- **Offline Thermal Label Printing (RC-17)**: 100% offline client-side vector QR thermal label printing for sample bags (101x54mm) and cryovials (50x25mm) with continuous roll printing.
- **Distinct Non-Conformance State & Chain of Custody (RC-19)**: Distinct `RECEIVED_REJECTED` lifecycle state excluding rejected samples from expected backlog; immutable physical handover custody metadata with courier tracking and officer counter-signatures.
- **Automated Regression Suite (RC-20)**: 18-contract automated regression test suite ensuring full contract integrity across all reception criteria.

---

## [1.3.0] - 2026-09-02

### Added
- **Server-Side PDF Report Engine (`pdfGenerator.js`)**: Report certificate generation using PDFKit without headless browser overhead, laboratory branding, electronic approval records, and public verification tokens (`/api/reports/public/:token/pdf`).
- **Controlled Unit Vocabulary & Conversion Engine (`interpretationService.js`)**: Centralized unit vocabulary with automatic conversions (`%` $\leftrightarrow$ `g/kg`, `ppm` $\leftrightarrow$ `mg/kg`, `meq/100g` $\leftrightarrow$ `cmol(+)/kg`, `dS/m` $\leftrightarrow$ `µS/cm`).
- **FAO 5-Tier Agronomic Interpretation**: Automatic evaluation into `VERY_LOW`, `LOW`, `OPTIMAL`, `HIGH`, `VERY_HIGH` ratings with contextual advisory text.
- **Holistic Soil Diagnostics**: Real-time USDA 12-class textural classification with closure validation ($\pm 2.0\%$), C:N stoichiometry, Base Saturation %, Ca:Mg ratio, and SAR/ESP sodicity hazards.
- **Batch Quality Assurance Controls (`qcService.js`)**: Method Blanks, Analytical Duplicates with RPD %, Certified Reference Materials (CRMs) with Recovery %, automated batch pass/fail transitions, and managerial disposition overrides (`PROCEED_WITH_WARNING`).
- **Native Binary Spectral Parsers**: Direct binary parsing for Bruker OPUS, ASD FieldSpec, and Galactic SPC formats with auto-extraction of acquisition parameters.
- **Scheduled Escalation Engine (MAP-19)**: Background service monitoring unassigned work (>48h) and stalled work (>72h), alerting managers automatically.
- **Multi-Episode Analytical Tracking**: Distinct analytical passes for reopened samples, capturing reasons, timestamps, and multi-approval dates on Certificates of Analysis.

---

## [1.2.0] - 2026-08-15

### Added
- **Official Visual Rebrand**: Integrated the official illustrated SoilFER logo across desktop, mobile headers, sidebar, and reports.
- **Official Resource Partner Badges**: Added official vector assets for the US Department of State ($30M grant) and Japan MOFA/ODA ($6M grant) with direct institutional portal links.
- **Ambient Soil Lab Backgrounds**: Implemented 4 authentic soil laboratory scenes (FTIR DRIFTS spectroscopy, Olsen P extraction shaker, standard 2mm sieving, and precision weighing station) with smooth 60fps GPU-accelerated CSS Ken Burns crossfade.
- **About SoilFER Portal**: Created dedicated public institutional portal detailing the global programme, US and Japan donor grants ($36M+), VACS framework, and LIMS role.
- **Automated SSL Pipeline**: Automated renewal system and health monitoring pipeline on production servers.

---

## [1.1.0] - 2026-06-10

### Added
- **Public Certificate Reports Engine**: Complete public report generation with token-based cryptographic verification URLs for farmers and agronomists.
- **Multi-Sample Walk-In Intake**: Enhanced walk-in intake modal and batch QR barcode scanning for incoming field samples.
- **KoboToolbox Multi-Project Sync**: Integrated dynamic project code binding for automated field survey intake.
- **Manager Review Workflows**: Role-based approval and rejection workflows for lab managers with audit justifications.

---

## [1.0.0] - 2026-03-01

### Added
- **3D Cesium Geospatial Workflow Map**: Interactive 3D globe displaying global field sampling coordinates and analytical progress.
- **FTIR & MIRS Spectral Library**: Raw spectral curve viewer, baseline correction, and dry spectroscopy data store.
- **GLOSOLAN Quality Assurance Foundation**: Implemented blind blank validation, duplicate precision checks, and CRM tracking.
- **Multilingual Localization**: Full internationalization support for English, Spanish, Latin American Spanish, French, and Portuguese.
- **Role-Based Access Control**: Granular permissions for Technicians, Lab Managers, Sample Reception, and Super Administrators.
- **Database Engine**: Type-safe relational model with SQLite / Better-SQLite3 and Prisma ORM.

---

## [0.9.0] - 2025-12-15

### Added
- **Beta Pilot Deployments**: Field testing at National Reference Soil Laboratories in Zambia, Honduras, and Guatemala.
- **Soil Wet Chemistry Core Schema**: Data models for routine soil parameters (pH, EC, SOC, Total N, Available P, Exchangeable Bases, CEC, Texture).
- **Spreadsheet Pipelines**: CSV and Excel batch import/export pipelines for legacy laboratory datasets.
