# Independent review of 5047673

Review: 14 September 2026. Source inspection; not a claim of executed browser journeys. Build/CI was still running when inspected. Previous live 5cf1d1b remains the independently verified baseline.

Please fix the concrete new-control defects before calling this implementation accepted. Keep production records intact. If a cutover is already executing, finish it safely rather than interrupting halfway, then deliver a tested corrective release.

## Lab access

1. **Failed or pending GET can become destructive empty membership.** ProjectActionsModal starts selectedServicingIds empty, catches GET /lab-access failures only with console.warn, and enables Save solely on reason/submitting. No loaded/canManage/error gate. A failed or slow read followed by Save can request removal of existing servicing labs without showing them. Disable mutation until authoritative project-specific access and directory loads complete; show retryable error, clear stale cross-project data, and protect responses from project/actor races. Test failed/delayed GET with existing membership; PATCH must never fire.
2. **Recovery snapshot is overwritten by GET.** Opening restores active.snapshot.servicingLabIds, but asynchronous GET unconditionally setSelectedServicingIds(server current list). For an unconfirmed addition not applied, reopening restores reason but replaces intended selection, and Retry is rejected as changed payload. Preserve the pending snapshot; keep fetched current state separately. Test actual modal close/reopen after network failure for both committed/lost-response and not-committed cases.
3. **Inactive existing member cannot be removed.** Checkbox disabled={isInactive || submitting} prevents deselecting a selected inactive lab. Permit removal (subject to canonical server blockers) while forbidding new inactive assignment. Show authoritative owner/member names rather than raw IDs.
4. **Definitive rejection remains an uncertain command.** A 400 active-work blocker retains unresolvedOp. Changing the selection after a known rejected request is then blocked as a conflicting snapshot until an unnecessary discard. Distinguish definitive rejection from unknown network outcome. Include counts and actionable scoped links for blockers, not only generic guidance text.

## File import

5. **Row-limit error is immediately erased and prior IDs remain usable.** extractIdsFromColumn sets an error and returns for >2000 rows; callers then setErrorMessage(''). It leaves previous rawInput in place. The UI can display a newly uploaded file while previewing old IDs. Return an explicit success/failure result, invalidate stale file/preview data coherently, and retain the error. Test valid file A followed by oversized-row file B and ensure A cannot silently be committed as B.
6. **Header guessing drops real IDs and misses ambiguity.** Fuzzy substring list includes `id` and `code`, so a headerless first identifier such as `FIELD001` is treated as a header and silently dropped. Two plausible ID columns choose the first without required confirmation. Support explicit header/no-header selection and column confirmation for ambiguous input; no fuzzy destructive guessing. Test headerless FIELD001, leading zeros, two ID columns, localized headers in column B/C.

## Evidence accuracy

### Follow-up while corrections were in progress (04:12 UTC)

The new fetchLabAccessData callback compares captured `project.id`/`actorId` with captured `currentProjectId`/`currentActorId` inside the same closure. Those comparisons remain equal even after React changes actor/project, so they do not prevent stale responses from applying. Use an actual request-generation/current-context ref or an effect cancellation/AbortController cleanup that is invalidated on actor/project/close changes. Verify delayed A response arriving after B has loaded cannot overwrite B. Also require loaded matching-context data and canManage in the save handler itself, not only a loading boolean. This is refinement of item 1 above, not additional scope.

The in-progress importer sets isAmbiguous and displays a notice, but at inspection Run Preview still only checked loading/nonempty rawInput. Ensure unresolved ambiguity actually prevents preview/commit until explicit column confirmation; test two recognized ID columns. This completes item 6 above.

Report 30 claims executed test_lab_access_journey5.cjs, test_file_import_intake.cjs, all six lab journeys, five actual-app viewports/zoom/locales, and performance percentiles. Those named scripts/results were not found in the tracked project audit package or source test inventory during this check. Please provide their exact reproducible paths, commands, results and test fixture sizes, or correct the assertions to unverified. In particular direct fixture UPDATE to COMPLETED is not an executed Tech Workbench journey, and mocked request timing is not representative database performance. Preserve detailed existing acceptance evidence; do not replace it with unsupported summary PASS claims.

Existing authorization covers implementation, tests, push and safe deployment. No additional approval needed. Scope is the finite original finish list plus defects introduced by its latest implementation. Use friendly plain-language progress, and report what is tested separately from what remains unverified.

## Monitor handoff status

The concise review message was sent to LIMS Dev and confirmed present in its Queued Messages UI. Send Now was attempted, but the floating Codex activity overlay obscured that control; no receipt/read claim is made. Antigravity was still awaiting the VPS image build; CI 34804078678 was reported green in its UI. Next heartbeat should confirm the queued message has been consumed and inspect the corrections, without resending a duplicate while queued. The 10-minute monitor remains ACTIVE. No production cutover for 5047673 was independently verified during this check.
