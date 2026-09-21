# External Laboratory Dashboard Count Reconciliation Protocol (#104)

**Work Package**: `WP/contributor-issues-2026-09`  
**Issue**: [#104 Separate Laboratory Dashboard sample count discrepancy](https://github.com/yigini/soilfer-lims/issues/104)  
**Lead**: Antigravity (Evidence & Architectural Boundaries) / Codex (Reporter Coordination & Governance)  
**Reporter**: Luis (Guatemala National Team)  
**Scope Boundary**: Separate external reporting dashboard vs. SoilFER LIMS core analytical platform  
**Status**: **Investigation Protocol & Preparation Framework (Reconciliation Pending)**

> [!IMPORTANT]
> **Protocol Document Status: Preparation, Not Completed Reconciliation**
> This document establishes the investigative protocol and reconciliation methodology. It does **not** represent a concluded reconciliation or resolved count.
> **Reporter Snapshot vs. Verified Facts**: The figure of 3,580 samples is a point-in-time metric **reported by the external reporter (Luis) on 15 September 2026**, not an independently verified LIMS database fact or verified ETL export count.
> **Unknown External Architecture**: The underlying architecture, data source, query filters, hosting infrastructure, and synchronization frequency of the external dashboard are currently **UNKNOWN** to the SoilFER LIMS core engineering team. No architectural assumptions or undocumented sync mechanisms may be asserted as fact.

---

## 1. Problem Statement & System Boundaries

### The Reported Observation
- In September 2026, national team member Luis reported a discrepancy between the sample count shown on an external Laboratory Dashboard and the active count in the core SoilFER LIMS application.
- On 15 September 2026, Luis reported that approximately 3,580 samples were expected or visible within the Guatemala reception pipeline according to the external reporting dashboard view.
- Independent verification within LIMS core showed 35,197 total baseline field registry records across all projects, with Guatemala samples cleanly segmented by project and status.

### Authoritative System Boundaries
1. **Authoritative LIMS Boundary**: SoilFER LIMS (`soilfer-lims`) is the authoritative system of record for:
   - Physical intake verification (`receptionDate`, `receivedMass`, physical checklist).
   - Analytical testing, laboratory worksheets, QC results, and minted reports.
2. **External Dashboard Separation**:
   - The external dashboard is an independent downstream application or BI/reporting layer.
   - Changes, deployments, or releases to SoilFER LIMS do not automatically alter, update, or redeploy the external reporting dashboard.
3. **No Synthetic Backfill Rule**:
   - Historical count mismatches must **never** be resolved by inserting synthetic intake timestamps or marking field-registered samples as physically received when physical custody has not occurred.
   - Physical receipt is an empirical laboratory event that requires physical custody handover.

---

## 2. Metric Taxonomies: Core LIMS vs. Potential External Conceptions

To prepare for technical coordination with the external dashboard maintainers, the following metric definitions clarify where count divergences typically occur:

| Metric Category | SoilFER LIMS Core Contract (`server/controllers/sampleController.js`) | External Dashboard Possible Conception (Unknown / Unverified) | Reconciliation Rule & Boundary |
|---|---|---|---|
| **Full Registry** (`qView === 'registry'`) | All registered records across the entire dataset (e.g. baseline 35,197), regardless of status. | May query raw intake forms, including duplicate drafts, cancelled entries, or unvalidated surveys. | Verify exact filter predicates: verify if drafts or test submissions are excluded in external queries. |
| **Expected Arrivals** (`qView === 'expected'`) | Registered specimens awaiting physical receipt: `EXPECTED_STATUSES = ['EXPECTED', 'COLLECTED']`. Physical intake has not occurred (`receivedAt === null`). | External observers often classify "expected" or "collected in field" samples as already "in the lab". | **Must not be counted as active laboratory work**. LIMS strictly holds these in pre-intake queue. |
| **Active Laboratory Queue** (`qView === 'daily'`) | Specimens physically received and currently in workflow: `ACTIVE_LAB_STATUSES = ['RECEIVED', 'ACCEPTED', 'PROCESSING', 'SUBMITTED']`. | Frequently excludes quarantine holds, non-conforming samples, or samples pending manager approval. | `views.daily` counts and returned sample rows must agree identically. Reflects physical laboratory custody. |
| **Completed / Archived** | Samples where all analytical orders are finalized, reported, or archived. | May be moved to a cold warehouse data mart, reducing active dashboard counters. | Audit cumulative throughput across active + completed lifecycle states. |

---

## 3. Preparation & Coordination Roadmap (Pending Reporter Engagement)

1. **Phase A: Core LIMS Operational Truth (Completed in #120 / #114)**:
   - Verified that `server/controllers/sampleController.js` returns mutually consistent counts and rows for all views (`views.daily`, `views.expected`, `views.registry`).
   - Standardized `EXPECTED_STATUSES = ['EXPECTED', 'COLLECTED']` so `COLLECTED` pre-arrival records are accounted for consistently across daily and expected views without count drift.
   - Added automated contract tests (`server/tests/contracts/dashboard_manager_views.test.js`) enforcing count-to-row agreement.

2. **Phase B: Information Gathering on External Architecture (Pending Codex / Luis Coordination)**:
   - [ ] Identify external dashboard hosting location, codebase repository, and maintainer team.
   - [ ] Ascertain the data ingestion pathway (direct database read, scheduled ETL batch, REST API client, or manual spreadsheet import).
   - [ ] Obtain the exact query, date filters, and status filters used by the external dashboard.
   - [ ] Request one non-sensitive sample ID that appears in the external dashboard count of 3,580 but was reported missing or misclassified.

3. **Phase C: Independent Verification & Closure**:
   - [ ] Once external pipeline details are known, document the root cause of the reporting delta.
   - [ ] Confirm alignment in a non-production staging environment.
   - [ ] Obtain formal written concurrence from reporter (Luis) or national coordinator.

---

## 4. Closure Gates

This issue (#104) remains **OPEN** under active investigation preparation. It will not be closed until:
1. The external dashboard's data architecture is documented and verified.
2. The cause of the count divergence (e.g. status filter mismatch, ETL latency, or pre-intake classification) is formally demonstrated.
3. Independent review by Codex verifies resolution and the national team confirms count alignment.
