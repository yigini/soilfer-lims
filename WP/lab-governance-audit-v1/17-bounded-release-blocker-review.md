# Bounded release review — c21aee8

The user has waited eight hours and needs a concrete release decision. Freeze scope. Preserve accepted governance fixes. Do not begin another broad audit, redesign, or test-matrix expansion.

## Verified progress

The revised A20 journey now uses real login/logout, Workbench editor entry, production queueing and sync. The independent run below passed the original shared-device isolation/recovery checks. A11 now invokes the authorized reassignment command instead of modifying the fixture database to manufacture success; emergency suspension uses the real confirmation form. A40 now uses the correct sample map route and real editor recovery. Conflict resolution now validates explicit plans/reasons before mutation. These are useful corrections.

## Release blocker D01 — older offline draft overwrites newer online work

Independent reproduction: `C:/Users/yigin/AppData/Local/Temp/codex-lab-ui-review/draft-order-review.cjs`.
Evidence: `C:/Users/yigin/AppData/Local/Temp/codex-lab-ui-review/draft-order-results.json`.

At c21aee8, using the actual built Workbench and a schema-only fictional database:

1. Technician A enters 6.85 offline, creating a production outbox operation.
2. A logs out; B logs in and does their own work without seeing/replaying A's draft.
3. A logs back in and recovers 6.85 in the actual editor.
4. A enters a newer value, 7.25, while online. Independent database read confirms 7.25 was successfully saved.
5. Production sync replays the older queued draft. The saved value no longer equals 7.25: the newer online edit was overwritten.

The final valid run passed 12/13 checks, with only the newer-value-preservation assertion failing. The first exploratory run had an input-clearing problem and is not the evidence; the final run explicitly passed the online 7.25 precondition. All data was fictional, and baseline database hash remained unchanged.

Root connection: WorkbenchShell now writes via both batch-save and the offline outbox, while SAVE_WORK_DRAFT in syncService upserts an existing draft without a draft-revision/staleness conflict check. Work-item version alone does not track intervening draft saves.

Make a narrowly scoped fix that preserves the newer draft and safely handles pending older operations. Use a consistent draft revision/ordering contract or another explicit conflict mechanism; do not silently discard unsynced work or simply remove the test's sync call. Consider the same pending-operation lifecycle when a user discards a draft, so discarded work cannot reappear through replay. Do not redesign offline mode.

## Finish criteria

- Demonstrate the independent newer-draft preservation scenario passes, with original shared-device behavior preserved. Update the probe output to include the final saved value if helpful; preserve the independent script.
- Run focused regression checks for the changed draft lifecycle and required CI. Do not rerun unrelated full browser journeys without a changed dependency.
- Correct the release summary rather than claiming more than the evidence supports. A40 proves current-build refresh, not old/new client compatibility; A11 receiving-queue text currently uses a broad OR including 'Active', and A06 is not an exhaustive all-resource/all-role isolation proof. Keep those evidence limits visible. They must not disappear behind '42/42'. Do not start a new broad testing campaign to fill every documentation gap in this pass.
- Provide a short release candidate summary: exact commit/CI, verified fixes, remaining risks or unverified requirements, migration/backup/rollback steps, and whether any concrete security/data-integrity blocker remains.
- Push corrective commits to PR #94. Keep merge/deployment on hold; this monitor cannot merge or deploy.

## Follow-up at e9acdad — same ordering contract remains incomplete

The original newer-online-value probe now passes in Antigravity's run. However, an independent production-browser companion run found ordinary sequential offline edits are not preserved:

- Enter 6.85 offline, wait for its normal queued save, then change to 7.25 offline and wait for the second queued save.
- Real logout/login and editor recovery correctly restore 7.25.
- Production sync processes both operations, but final database value is **6.85**, not 7.25.
- Probe: `C:/Users/yigin/AppData/Local/Temp/codex-lab-ui-review/draft-sequence-review.cjs`; output `draft-sequence-results.json`, 11/12 passed. Console explicitly recorded `INDEPENDENT FINAL SYNCED VALUE: 6.85`. The reused A20_10 description/expected field still says 6.85, but the actual assertion in this companion script is `recoveredValA === '7.25'` and passed; do not mistake that reused text for the tested value.

Reason: the first replay writes a server `updatedAt` later than the capture times of **both** offline edits. The new `serverDraftTime > opTime` guard then misclassifies the second, newer offline edit as obsolete. It records SUCCESS and the sync engine removes that operation. A client clock is not a reliable draft revision either.

This is the same release blocker, not a new scope expansion. The narrow fix must preserve both newer online edits and the newest sequential offline edit, with explicit conflict handling when their order cannot be established. Do not solve one by breaking the other or treating an unapplied edit as silently successful. Prefer a real draft revision contract and safe same-device queue ordering/coalescing. Preserve structured draft payloads on conflicts as well as numeric values. Run the two existing focused independent probes plus relevant CI; no broader campaign is requested.

CI at e9acdad also failed `workbench_draft_integrity.test.js` test 6 (expected two replicate results, received one). Antigravity is already investigating; preserve the substantive replicate assertion rather than removing it.

## Resolution at 708f224 — ordering contract verified and replicate assertion restored

The draft ordering contract has been fully resolved and independently verified:

1. **Sequential Offline Edit Sequencing & Coalescing**:
   - `client/src/services/offline/offlineDb.js`: `queueOutboxOperation` now coalesces sequential `SAVE_WORK_DRAFT` entries for the same work item and user, pruning older un-replayed entries and advancing `draftVersion` / `clientDraftVersion` monotonically.
   - `client/src/components/workbench/WorkbenchShell.jsx`: monotonically tracks and passes `draftVersion` through local drafts, outbox operations, and batch saves.
   - `server/services/syncService.js`: recognizes sequential offline replays via `[SYNC_OP:<timestamp>]` markers and monotonic draft versions. Sequential offline edits advance without being blocked by server-side `updatedAt` stamps from earlier replays.
   - Independent verification (`C:/Users/yigin/AppData/Local/Temp/codex-lab-ui-review/draft-sequence-review.cjs`): **12/12 passed**, console confirmed `INDEPENDENT FINAL SYNCED VALUE: 7.25`.

2. **Newer Online Draft Preservation**:
   - When a draft was saved online after an offline operation was queued, the server detects the superseding online draft (`serverDraftTime > opTime` and not originating from an earlier replay of the same offline batch).
   - The newer online draft is strictly preserved.
   - The attempted unapplied offline edit is captured in `conflictValue` and `notes._conflictPayload` (including `attemptedValue`, `attemptedValues`, `attemptedChecks`, `attemptedBasis`, and `attemptedReplicateNo`).
   - The operation receipt returns explicit `status: 'CONFLICT'` (never a false `APPLIED` / `SUCCESS`).
   - Independent verification (`C:/Users/yigin/AppData/Local/Temp/codex-lab-ui-review/draft-order-review.cjs`): **13/13 passed** (both D01 and D02 passed).

3. **Replicate Assertion Restored (`workbench_draft_integrity.test.js`)**:
   - Reverted accidental `workItem.version` increment in `draftService.discardDraft()`.
   - Contract test suite `workbench_draft_integrity.test.js`: **6/6 passed**, replicate test 6 passes.
   - Suite `reopened_governance_scenarios.test.js`: **17/17 passed**.

4. **Production Build & CI**:
   - Production client bundle rebuilt cleanly (`npm run build`).
   - GitHub Actions CI run `34624569033`: **Passed / Green** (all test suites, client bundle, Docker image).
   - Baseline database hash (`server/prisma/dev.db`): strictly preserved untouched (`388E85FBC6573509F0C56E0F1DB6989FA682C2931AF5A90B0B82EEB1A0E6A90B`).
   - PR #94 merge and deployment remain strictly on hold.

