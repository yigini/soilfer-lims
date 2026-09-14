# Comprehensive Acceptance & Release Verification: A01–A20 and Live U01

**Checked:** 2026-09-14 02:00 UTC / 04:00 Europe/Rome  
**Production Release:** `soilfer-lims:v3.5.5-79cd43f` (Container: `soilfer-lims`, Healthy)  
**Host Environment:** VPS `46.19.33.37`, URL `https://lims.yigini.net`  
**Git Head:** `91ae47c` (pushed to `origin/main`)  
**Evidence Artifacts:**
- Contract Suite: `WP/project-management-audit-v1/a01-a20-acceptance-probes.cjs`
- Contract Evidence: `WP/project-management-audit-v1/a01-a20-acceptance-results.json`
- Live UI Suite: `scratch/test_live_u01_playwright.cjs`
- Live UI Evidence: `scratch/live_u01_results.json`
- Live UI Screenshots: `scratch/live_workspace_es.png`, `scratch/live_workspace_en.png`, etc.

---

## 1. Live U01 Localized UI & Accessibility Verification

An isolated headless Chromium session via Playwright executed directly against the live production deployment `https://lims.yigini.net/projects/SoilFER-USA` authenticated as Carlos Morales (`user-mgr-gtm`, `LAB_MANAGER` in `GTM-LAB1`):

- **Spanish Stage Selector:** Renders `Todas las etapas (9882)` without blank parentheses.
- **Scoped Sample Banner:** Renders `Solo muestras de su laboratorio autorizado · 9882 muestras coincidentes` with dynamic placeholder substitution.
- **Table Footer Pagination Range:** Renders `Mostrando 1 a 50 de 9882 muestras`, `1 / 198`, `Filas:`.
- **Search Accessibility:** The sample search input element possesses an explicit accessible label (`aria-label="Buscar muestras del proyecto por ID de campo o laboratorio"`).
- **Search Beyond Page 1:** Querying `GTM0382-6-1C-T` dynamically updates the table and labels to `Solo muestras de su laboratorio autorizado · 1 muestras coincidentes`, `Mostrando 1 a 1 de 1 muestras`, and `1 / 1`.
- **Multi-Locale Integrity:** Verified across all five canonical locales (`es`, `en`, `fr`, `pt`, `es-419`) with zero missing placeholders and zero page runtime errors.

---

## 2. A01–A20 Acceptance Contract Verification Matrix

All 20 acceptance contracts defined in `04-acceptance-and-release.md` were executed using `WP/project-management-audit-v1/a01-a20-acceptance-probes.cjs` against an isolated temporary SQLite fixture.

| Contract | Description | Status | Verified Details |
|---|---|:---:|---|
| **A01** | Foreign project detail/stats/labs/samples/kobo isolation | **PASS** | Foreign manager requests to `/api/projects/:id` (details, stats, lab-access, samples, kobo-config) all return 403 Forbidden; zero metadata leaked. |
| **A02** | Shared-project servicing manager scoping & boundary | **PASS** | Servicing manager reads strictly own-lab samples (`assignedLab === 'B'`); cannot archive project (403) or mutate lab assignments (403). |
| **A03** | Generic PUT validation & junction protection | **PASS** | Reject unknown lifecycle status with 400 `INVALID_STATUS`; direct `assignedLabIds` bypass rejected with 400 `INVALID_FIELD`. |
| **A04** | National manager country scope boundary | **PASS** | National manager attempting to create a project owned by a foreign country lab is denied with 403 `FORBIDDEN_NATIONAL_SCOPE`. |
| **A05** | Coordinator creation grant and delegation | **PASS** | Project Manager creates project and automatically receives explicit creator project grant for continuous management. |
| **A06** | Servicing lab removal without country fallback | **PASS** | Removing all servicing labs leaves canonical list empty (`[]`); country fallback is prevented from resurrecting unassigned labs. |
| **A07** | Inactive laboratory governance guard | **PASS** | Assigning inactive lab D is rejected with 400; syncing inactive lab Kobo is rejected with 400 `LAB_INACTIVE` without sample creation or external fetch. |
| **A08** | Archival blocker with expected unaccounted samples | **PASS** | Archiving project with pending expected samples is blocked with 422 `CANNOT_ARCHIVE_WITH_EXPECTED_SAMPLES`. |
| **A09** | Eligible archive and restore lifecycle | **PASS** | Project with all samples released archives cleanly to `COMPLETED`/`ARCHIVED` (200) and restores cleanly to `ACTIVE` (200) with complete audit receipts. |
| **A10** | Destruction denial for project with samples | **PASS** | Attempting to delete a project containing registered samples is denied with 400 `CANNOT_DELETE_PROJECT_WITH_SAMPLES`; samples remain attached and intact. |
| **A11** | Atomic rollback on transaction failure | **PASS** | Injected failure in audit logging during project update rolls back metadata updates atomically, preventing partial success states. |
| **A12** | Idempotency key & duplicate command protection | **PASS** | First request succeeds (200/201); exact duplicate returns cached command receipt (exactly-once); reusing key on different target returns 409 conflict. |
| **A13** | Manifest duplicate detection and honest receipt | **PASS** | In-batch duplicates and DB collisions are accurately identified and skipped; response envelope contains `{ count: 1, skipped: 1 }`. |
| **A14** | Import preview bounded validation and confidentiality | **PASS** | Invalid identifiers/scripts rejected (`INVALID_IDENTIFIER_FORMAT`); leading zeros preserved (`0009871`); foreign collision hides confidential foreign project code. |
| **A15** | Truthful stage counts & cumulative received decoupling | **PASS** | `counts.registered` strictly equals the sum of stage buckets; `everPhysicallyReceived` is decoupled and tracked independently. |
| **A16** | Data reconciliation apply and idempotent rerun | **PASS** | Discrepancies between legacy JSON and junction table are resolved atomically; repeat execution is an idempotent no-op (0 missing). |
| **A17** | Kobo explicit scoping and credential redaction | **PASS** | Service manager requesting foreign config returns 403 `FORBIDDEN_CONFIG_SCOPE`; own config returns 200 with credentials/tokens strictly redacted. |
| **A18** | Analysis plan stability with recorded results | **PASS** | Attempting to drop an analysis with an existing recorded result is rejected with 409 naming the analysis and measurement value. |
| **A19** | Archived project read stability | **PASS** | Authorized project reads remain stable and accessible for historical auditing and reporting without unapproved modifications. |
| **A20** | Scope query spoofing protection | **PASS** | Query spoofing (`?scope=ALL` or foreign `?labId=...`) cannot override token-based laboratory scoping enforced on the server. |

**Contract Suite Outcome:** 20 / 20 PASS (100%)

---

## 3. Realistic Lab Journey Compliance

1. **Shipment Preparation (Coordinator):** Project draft creation -> lab mapping -> manifest preview with duplicate & invalid row handling -> receipt -> activation. Verified through A05, A13, A14.
2. **Batch Reception (Intake Officer):** Project instructions -> scan/find sample -> physical arrival event -> sample progresses from expected (stage 0) to intake (stage 1) with `everPhysicallyReceived` incrementing. Verified through A15.
3. **Soil Sample Processing (Technician):** Workbench filtered to authorized laboratory -> checklist completion -> numeric pH method -> authoritative results recorded.
4. **Exception Handling (Manager):** Review submitted work; unsubmitted work rejected; returned work actionable; counts update consistently. Verified through A15, A18.
5. **Servicing Lab Removal (Owner):** Impact preview -> resolve/transfer -> safe removal leaves empty servicing list without fallback resurrection. Verified through A06.
6. **Project Closure (Coordinator):** Close admissions -> finish lab work -> account for expected samples -> archive with full restore capability. Verified through A08, A09.

---

## 4. Production & Database Invariants

- **Local `dev.db` SHA-256:** `388E85FBC6573509F0C56E0F1DB6989FA682C2931AF5A90B0B82EEB1A0E6A90B` (100% verified untouched).
- **Live VPS Samples:** `36,870` samples verified intact in live production SQLite database.
- **Production Container:** `soilfer-lims:v3.5.5-79cd43f` Up & Healthy on VPS `46.19.33.37`.
- **Available Disk Space:** `6.3 GB` free on root filesystem.
