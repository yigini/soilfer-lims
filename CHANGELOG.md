# Changelog

All notable changes to this project will be documented in this file.

## [2.2.0] - 2026-09-02 (Soil Lab Readiness & ISO/IEC 17025 Quality Records)
### Added
- **Server-Side PDF Report Engine (`pdfGenerator.js`)**: Report certificate generation using PDFKit without headless browser overhead, laboratory branding, electronic approval records, and public verification tokens (`/api/reports/public/:token/pdf`).
- **Controlled Unit Vocabulary & Conversion Engine (`interpretationService.js`)**: Centralized unit vocabulary with automatic conversions (`%` $\leftrightarrow$ `g/kg`, `ppm` $\leftrightarrow$ `mg/kg`, `meq/100g` $\leftrightarrow$ `cmol(+)/kg`, `dS/m` $\leftrightarrow$ `µS/cm`).
- **FAO 5-Tier Agronomic Interpretation**: Automatic evaluation into `VERY_LOW`, `LOW`, `OPTIMAL`, `HIGH`, `VERY_HIGH` ratings with contextual advisory text.
- **Holistic Soil Diagnostics**: Real-time USDA 12-class textural classification with closure validation ($\pm 2.0\%$), C:N stoichiometry, Base Saturation %, Ca:Mg ratio, and SAR/ESP sodicity hazards.
- **Batch Quality Assurance Controls (`qcService.js`)**: Method Blanks, Analytical Duplicates with RPD %, Certified Reference Materials (CRMs) with Recovery %, automated batch pass/fail transitions, and managerial disposition overrides (`PROCEED_WITH_WARNING`).
- **Cross-Parameter Matrix Diagnostics**: Real-time matrix validation during results entry (`saveResults`) and sample submission approval (`submitForApproval`).
- **Test Infrastructure & Coverage**: 14 automated Jest test suites and 58 contract/scenario tests running 100% green.

## [2.1.0] - 2026-01-28
### Added
- **Handover Package**: Full documentation suite in `/docs`.
- **Ops Runbook**: Incident checklists and troubleshooting guides.
- **Seeding Scripts**: Automated onboarding for AFACI labs.

## [2.0.0] - 2026-01-27
### Fixed
- **Workflow Engine**: Fully hardened state machine in `workflowContract.js`.
- **Security**: RBAC enforcement across all API endpoints (Step 11).
- **UI Polish**: Full mobile responsiveness and Dark Mode consistency (Step 12).
- **Recent Activity**: Dashboard integration for audit trailers.

### Changed
- **Performance**: Server-side pagination for samples and work items.
- **Data Scoping**: Country and Lab-level multi-tenancy enforcement.

## [1.5.0] - 2026-01-20
### Added
- **Legacy Migration**: Status normalization script (`migrate_workflow.js`).
- **Audit Logs**: Immutable JSON-based audit trail.

---
*For earlier changes, see the legacy git history.*
