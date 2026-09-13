# Monitor check: verified 17 probes; complete the connected workflows

14 September 2026, approximately 01:44 Europe/Rome. Reviewed commit `7832afd1ac0ceea88655cfb5bfd00271927e82b8`, merged PR96, feature `ebfadad`. PR CI 34790215977 passed; main CI 34790430171 was queued at the initial check. Antigravity was building/deploying the corrective release; this check has not independently verified production cutover.

**Independent result: 17/17 existing probes pass**, isolated fixture DB, source database unchanged. Evidence: `monitor-7832afd-probes.cjs` and `monitor-7832afd-results.json`. Do not reopen those exact failures without new evidence. The initial local checkout briefly showed an older main commit while Antigravity was switching/pulling; no reset or competing branch changes were made. Tests ran only after HEAD resolved to 7832afd.

## Next scope, already authorized

The full implementation remains incomplete. The evidence file now labels PM06, PM13–16, PM18–19 and PM21–22 partial. Complete these within this task, not an unspecified future iteration. Retain the original PM/A contracts and correct stale evidence descriptions against actual code.

### Pagination introduces a practical search/filter limitation

`SamplesTab.jsx` keeps searchQuery locally and filters only its `samples` prop. `ProjectWorkspace.fetchSamples` sends only page/limit. The API applies no search or stage predicate. Therefore a sample beyond the current page is not found by the search box and a stage with a nonzero project count may show an empty current page. The matching count and paging totals refer to unfiltered project totals.

Move search and stage filters into the authorized server query before count/pagination, share stage definitions with summary counts, reset page on filter/project change, and preserve filters in the URL. Cancel/discard stale responses, show retryable errors and distinguish zero from unavailable. Test a matching sample beyond page one and an empty filtered page after scope/filter changes. Verify next/previous and filtered totals in the actual app.

### Finish existing requirements rather than adding unrelated design

- Implement the actual project metadata/plan configuration and save flows. Preserve client, owner/service scope, explicit draft-to-active readiness, effective plan/method versions and existing-order snapshots. A catalogue link alone is not project-plan selection.
- Enforce admission policy across reception/discard, manifest and Kobo manual/scheduled sync. Resolve explicit authorized project/destination/asset mapping; ensure pause and retry semantics and per-sample source provenance. Do not guess destination from the first configuration.
- Complete canonical membership consumers and safe reconciliation of ambiguous legacy data. Test staff/lab lifecycle and existing work ownership, not only adding/removing a lab on one endpoint.
- Closure validation must be atomic with transition and use the actual work/review contract. Membership removal must account for outstanding WorkItems even where parent sample status is terminal/inconsistent; don't equate a narrow sample-state assertion with the full ownership guarantee.
- Finish five-locale real components and honest secondary error/empty/loading states, active laboratory/team information, correct configured Kobo fields, and scoped audit presentation. Keep scientific/audit data authoritative.
- Verify the connected real application journeys with appropriate synthetic test accounts/data locally or in a safe test environment. Do not use production sample mutations for QA or the standalone design preview as application evidence.

The user has authorized continued corrections, safe GitHub push/merge and deployment after applicable checks. Preserve backups, tested commit/image records and data invariants. Report deployment of a correction as partial until the original connected workflows are accepted. Monitor remains ACTIVE.

Handoff status: continuation message is queued in LIMSI / LIMS Dev while the production deployment task runs (confirmed queued-message UI with Send Now/Edit/Delete). Deliberately did not interrupt the deployment. Next monitor: confirm it is consumed after deployment and do not duplicate it. Main CI run 34790430171 was still in progress at the end of this check.
