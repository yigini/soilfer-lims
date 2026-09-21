# External Laboratory Dashboard Count Reconciliation Protocol (#104)

**Work Package**: `WP/contributor-issues-2026-09`  
**Issue**: [#104 Separate Laboratory Dashboard sample count discrepancy](https://github.com/yigini/soilfer-lims/issues/104)  
**Lead**: Antigravity (Evidence & Boundary Analysis) / Codex (Reporter Coordination & Communication)  
**Reporter**: Luis (Guatemala National Team)  
**Scope**: Separate external reporting dashboard vs. SoilFER LIMS core platform

---

## 1. Context & Problem Statement
- **Reported Issue**: Discrepancy observed between sample numbers displayed in the separate external Laboratory Dashboard and the central LIMS database.
- **Historical Fact**: As of 15 September 2026, the GTM reception form was verified operational and 3,580 unique samples were visible in the Guatemala reception pipeline.
- **Critical Architectural Boundary**:
  - The external dashboard is a **separate downstream application / reporting pipeline**.
  - SoilFER LIMS core (`soilfer-lims`) is the authoritative analytical LIMS and registry of physical laboratory intake and analytical measurements.
  - A release of `soilfer-lims` does not automatically modify or release the external dashboard codebase.
  - **No Automatic Backfill**: Historical count mismatches must not be solved by arbitrary synthetic backfill into LIMS or by fabricating physical reception timestamps for samples that have only been registered in field Kobo forms.

---

## 2. Reconciled Definition of Sample Metrics

| Metric Term | Definition in SoilFER LIMS | Definition in External Dashboard | Reconciliation Rule |
|---|---|---|---|
| **Field Registry** (`view=registry`) | All registered Kobo and imported field specimens across all stages (35,197 total baseline). | Often includes raw Kobo submission rows, including duplicates and draft test forms. | Deduplicate by `sampleId` / `originalId`; exclude unvalidated test submissions. |
| **Expected Arrivals** (`view=expected`) | Field records synced from Kobo where physical custody has not yet been delivered to the laboratory. | Often counted as "in the laboratory" by external observers. | **Must not be counted as active laboratory work** until physical check-in at reception desk. |
| **Active Lab Work** (`view=daily`) | Physically received specimens (`RECEIVED`, `ACCEPTED`, `PROCESSING`, `SUBMITTED`) currently inside the analytical queue. | Frequently misaligned if reception non-conformance or quarantine holds are excluded. | Must reflect physical custody timestamp (`receivedAt !== null`). |
| **Archived / Completed** | Specimens where all ordered determinations are accepted and report released, or archived. | May be moved to separate historical data marts. | Query across full lifecycle when auditing total cumulative throughput. |

---

## 3. Investigation & Coordination Checklist
1. [x] **Core LIMS Operational Views Verification**:
   - Issue #120 implementation verified that LIMS explicitly distinguishes:
     - `view=daily` (active lab specimens)
     - `view=expected` (field registrations awaiting intake)
     - `view=registry` (full field registry)
   - Zero sample records are deleted or suppressed; counts are reconciled in API response (`views.daily`, `views.expected`, `views.registry`).
2. [ ] **External Pipeline Coordination with Luis**:
   - Request confirmation from Luis regarding:
     a. Exact external dashboard URL / repository identifier.
     b. Exact date range or filter criteria applied in the external view.
     c. One non-sensitive example sample identifier missing from the external view.
3. [ ] **Pipeline Ingestion Health Check**:
   - Verify webhook / ETL scheduler that synchronizes LIMS export data to the external dashboard.
   - Confirm whether sync latency or failed ETL job batches caused the snapshot discrepancy.

---

## 4. Closure Criteria
- Issue #104 will be closed **only** when:
  1. Reporter (Luis) or country coordinator confirms in writing that the target external view accurately reflects the intended sample dataset; OR
  2. The external pipeline repository is identified, updated, and independently verified to consume the reconciled LIMS v2 API without count drift.
