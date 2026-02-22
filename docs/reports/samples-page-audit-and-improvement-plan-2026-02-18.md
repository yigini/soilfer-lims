# Samples Page Audit and Improvement Plan

- Date: 2026-02-18
- Scope: `Samples.jsx`, `SamplesTable.jsx`, filter/header components, and `sampleController.getSamples`.

## Audit Findings

1. Critical - Lab-scope leak risk during search
- `soilfer-lims/server/controllers/sampleController.js:157`
- `soilfer-lims/server/controllers/sampleController.js:193`
- Search writes `where.OR`, which can overwrite scope guard OR conditions and weaken lab isolation.

2. High - Active/attention-needed samples are not prioritized by default
- `soilfer-lims/client/src/pages/Samples.jsx:28`
- `soilfer-lims/server/controllers/sampleController.js:142`
- Default sorting is `createdAt desc`, so samples being analyzed/assigned/in progress are not forced to top.

3. High - Attention logic misses key active work states
- `soilfer-lims/client/src/components/samples/SamplesTable.jsx:62`
- `soilfer-lims/client/src/components/samples/SamplesTable.jsx:72`
- Current attention flags rely mainly on sample status and gate fields, not work item states such as `ASSIGNED`, `IN_PROGRESS`, `REANALYSIS_REQUIRED`.

4. High - Header lifecycle filter sends unsupported query key
- `soilfer-lims/client/src/components/samples/SamplesHeader.jsx:109`
- `soilfer-lims/server/controllers/sampleController.js:142`
- Header toggles `lifecycle` filter, but backend expects `status`.

5. High - Advanced filters include unsupported keys
- `soilfer-lims/client/src/components/samples/SamplesFilterDrawer.jsx:21`
- `soilfer-lims/client/src/components/samples/SamplesFilterDrawer.jsx:32`
- Backend does not process `blockers` or `types`, so controls can look functional while doing nothing.

6. Medium - Facets contract mismatch
- `soilfer-lims/client/src/pages/Samples.jsx:50`
- `soilfer-lims/server/controllers/sampleController.js:323`
- UI expects project/country/lab facets, backend currently returns only lifecycle facets.

7. Medium - Progress completion can be understated
- `soilfer-lims/server/controllers/sampleController.js:299`
- `soilfer-lims/client/src/components/samples/SamplesTable.jsx:450`
- Progress logic counts `COMPLETED` and `ACCEPTED` but ignores submitted states.

8. Medium - Search placeholder overpromises fields
- `soilfer-lims/client/src/components/samples/SamplesFilterBar.jsx:66`
- `soilfer-lims/server/controllers/sampleController.js:191`
- Placeholder says "Submitter, etc..." but backend search matches only `originalId` and `labId`.

9. Medium - Sort field is not allowlisted server-side
- `soilfer-lims/server/controllers/sampleController.js:213`
- Dynamic sort key from query can produce unstable behavior and should be validated.

## Improvement Plan

## P0 - Security and Query Contract
1. Preserve scope conditions when applying search.
- Merge search condition under `AND` instead of replacing top-level `OR`.
2. Add sort allowlist and validation.
- Allowed: `labId`, `projectCode`, `status`, `updatedAt`, `createdAt`, and new `attention`.
3. Validate or reject unsupported filter keys.
- Prevent silent no-op filters.

## P1 - Attention-First Ordering (Core Requirement)
1. Add backend sort mode `sort=attention`.
2. Make `attention` default sort when user has not explicitly selected another sort.
3. Rank before pagination using this order:
- Rank 0: any work item `IN_PROGRESS`
- Rank 1: any work item `ASSIGNED` or `REANALYSIS_REQUIRED`
- Rank 2: sample status `PROCESSING` or `SUBMITTED_PARTIAL`
- Rank 3: sample status `RECEIVED`, `COLLECTED`, `ACCEPTED`
- Rank 4: all others
4. Secondary sort: `updatedAt desc`.

## P1 - Accurate Attention Signals
1. Return computed activity flags from API:
- `hasInProgressWork`
- `hasAssignedWork`
- `hasReanalysisWork`
- `pendingReview`
2. Update table attention indicators to use these flags.

## P1 - Make Filters Functional
1. Header lifecycle clicks should map to `status`, not `lifecycle`.
2. Either implement backend support for `blockers/types` or remove those controls until supported.
3. Return facets for project/country/lab if advanced filters remain visible.

## P2 - UX and Progress Accuracy
1. Add quick filter: `Needs Attention`.
2. Keep attention-first as default but allow user override via table header sort.
3. Align search placeholder with backend behavior or expand backend search scope.
4. Count `SUBMITTED` states in progress bar completion logic as appropriate.

## P3 - Test Plan
1. API tests
- Search never bypasses lab scope.
- Attention sort ordering is correct before pagination.
- Unsupported filters are rejected or ignored explicitly.
2. UI tests
- Default view shows attention-needed samples first.
- Header and drawer filters produce expected query params.
- Attention badges and progress reflect real work item states.

## Success Criteria
- Samples being analyzed, assigned, or in progress consistently appear at the top by default.
- Filters shown in UI are fully backed by server behavior.
- No lab scope regression from search/filter combinations.
