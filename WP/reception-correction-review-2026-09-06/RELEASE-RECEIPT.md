# Production Release Verification Receipt: Reception Correction & Dashboard Repair

**Release Tag / Commit**: `cdcc2cb` (`fix(reception): protect locked drafts, restore intake context, honest dashboard metrics (#54)`)  
**Deployment Target**: Production VPS `root@46.19.33.37`  
**Container**: `soilfer-lims:v3.0.1-cdcc2cb` (`sha256:8aec9ad4bf3766265f5bf58e8126bfbf90b776d0ed6cecb35bb36cadf902680f`)  
**Timestamp**: 2026-09-06T15:18:00Z (17:18:00 Local)  
**Coordinated Backup**: `/opt/lims/release_checkpoints/release_reception_cdcc2cb_2026_09_06_15_1`  
- SQLite snapshot: `.backup` captured and verified with `PRAGMA integrity_check; -> ok`
- Assets archive: `assets.tar.gz`

---

## 1. Verified Defects Resolved

1. **Locked Status Protection**:
   - `POST /api/reception/intake` with `isDraft: true` unconditionally rejects mutating records in locked states (`APPROVED`, `ACCEPTED`, `LAB_ID_ASSIGNED`, `PROCESSING`, `COMPLETED`, `ARCHIVED`, `DISPOSED`, `RECEIVED_REJECTED`).
   - Atomic database-level concurrency protection prevents stale drafts from overwriting locked states.
   - Preserves `projectId` and `projectCode` against erasure when `isWalkIn: true` is sent on project samples.

2. **Intake Context & GPS Restoration**:
   - Canonical `resolveCoordinates` across server and client handles `{ value, source }` Kobo metadata wrappers, space-delimited GPS strings with elevation/accuracy, scalar coordinates, and valid zero coordinates on the equator/prime meridian.
   - Map defaults to viewport center without setting fake marker coordinates or writing fabricated default coordinates.
   - Removed arbitrary 0–20 cm depth fabrication in `FieldProvenanceCard.jsx` and `Reception.jsx`.
   - Dedicated read-only endpoint `GET /api/reception/sample-context` returns unstripped metadata for intake without mutating side-effects.

3. **Honest Reception Dashboard Metrics**:
   - Excludes unreceived `EXPECTED` (9,884 samples) and `DRAFT` samples from operational drying and preparation counts.
   - Calculated in laboratory timezone using a half-open day interval `[dayStart, dayEnd)`.
   - Streamlined intake navigation to a single canonical "New Intake" action, removing duplicate walk-in links.

4. **Multi-Lab Scope Isolation & Safe Query Composition**:
   - Resolved audit finding D13: `sampleWhere` containing top-level `OR` (from `scopeGuard`) is never overwritten by queue conditions.
   - All queries compose scope and queue criteria via `AND: [sampleWhere, filter]`.
   - Added second-lab test fixture proving zero leakage in counts and preview rows (`attentionQueue`, `expectedQueue`, `draftQueue`, `recentIntakes`).

5. **Drying Gate Applicability**:
   - Resolved audit finding D14: `dryingStatus: null` is treated as unknown/unverified, not as an approved exemption.
   - Samples only count as ready for preparation if drying is completed (`dryingStatus: 'DONE'`) or if drying is not an applicable operational gate for the laboratory.
   - Preview queues project lean normalized `hasCoordinates` booleans without transmitting heavy raw `fieldMetadata` blobs over the wire.

---

## 2. Automated Test & CI Verification

- **Local Contract Suite**: All 74 server test suites passed (506 tests), including 23 reception contract tests.
- **Client Production Build**: Vite build succeeded in 8.33s without errors or warnings.
- **GitHub Actions CI**: Run `34041435051` succeeded in 4m0s across all steps (test database, Prisma generation, server tests, client build, Docker buildx).
- **PR**: Pull request #54 merged to `main` via squash commit `cdcc2cb`.

---

## 3. Live Production Verification (Read-Only)

Executed authenticated probes against the live container `soilfer-lims:v3.0.1-cdcc2cb` on port 3000:

1. **Live Health & Bootstrap**:
   - `GET /api/health` -> `HTTP 200` (`status: ok`)
   - `GET /api/public/i18n/bootstrap` -> `HTTP 200`

2. **Live SQLite Database**:
   - `PRAGMA integrity_check;` -> `ok`
   - Total Samples: `35,191`
   - Expected Samples: `35,182`
   - Intaken Samples: `8`
   - Active Samples Awaiting Drying: `3` (phantom 5,297 count eliminated)

3. **Authenticated Reception Dashboard (`GET /api/dashboard/live`)**:
   - `Role`: `SAMPLE_RECEPTION`
   - `expectedArrivals`: `9,884` (honest arrival manifest)
   - `incompleteDrafts`: `0`
   - `receivedToday`: `2`
   - `needsAttention`: `0`
   - `totalProcessed`: `9,888`
   - `pendingDrying`: `3`
   - `pendingPreparation`: `0`
   - `waitingDrying`: `3`
   - `readyPreparation`: `0`
   - Preview Rows: `expectedQueue` (20 items, lean with `hasCoordinates: true`, `fieldMetadata: undefined`), `recentIntakes` (2 items).

4. **Live Intake Context (`GET /api/reception/sample-context?originalId=GTM0563-5-2C-S`)**:
   - `HTTP 200`
   - `coordinates`: `{ status: 'RECORDED', lat: 15.4339759, lng: -89.7234598, source: 'KOBO', confidence: 'MEDIUM', isRecorded: true }`
