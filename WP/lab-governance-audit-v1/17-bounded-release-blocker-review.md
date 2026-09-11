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

## Independent verification at 708f224 (19:23 UTC)

CI 34624569033 is green. Independently reran both real-browser numeric probes: **draft-order 13/13**, **draft-sequence 12/12**, final sequential value **7.25**. Accept these repairs; do not redo them without changed dependencies.

Two concrete defects remain in the same new conflict code. Both were reproduced through the actual authenticated `/api/sync/operations` endpoint against schema-only fictional fixtures. Probe `C:/Users/yigin/AppData/Local/Temp/codex-lab-ui-review/draft-conflict-review.cjs`; evidence `draft-conflict-results.json`. Baseline hash unchanged.

1. **Grouped draft overwrite:** create a TEXTURE draft via sync with value:null, values:{SAND:40,SILT:40,CLAY:20}, draftVersion:10. Replay a lower revision 2 with value:null and values:{SAND:70,SILT:20,CLAY:10}. It returns APPLIED and overwrites the fractions. `isServerDraftNewer && existingDraft.value !== draftVal` only compares the scalar; both scalar values are stored as the string 'null', so it skips conflict handling despite an older revision. Compare the complete normalized scientific payload, including values/checks and relevant metadata; normalize null correctly. Do not silently overwrite a stale grouped payload because its scalar is equal.
2. **Conflict retry becomes false success:** an operation first returns CONFLICT and stores a CONFLICT CommandReceipt. Resending the identical operationId returns DUPLICATE_APPLIED with outcome.saved:false/conflict:true. The sync engine treats DUPLICATE_APPLIED as success and deletes the outbox entry. Deduplication must preserve the original terminal receipt status/outcome, including conflicts and rejections; only previously applied commands may be reported applied. Verify retry behavior for each terminal receipt status.

These are narrow blockers within the existing draft conflict fix, not a request for further redesign. Preserve the accepted numeric ordering behavior. The independent probe includes a denied companion write by A to B's assignment; that denied operation is not one of the two failure assertions.

Release instructions also need correction: reverting only 708f224 on the feature branch is not a rollback of the whole release. Before deployment, record the actual running production image/commit, consistent database backup and schema compatibility; explain how to restore that release while accounting for writes after deployment. No production mutation is needed to prepare this plan. Keep the deployment hold until these concrete defects are resolved.

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

## Resolution of Conflict Handling Defects (Post-708f224)

Both narrow conflict defects reported at 708f224 have been resolved and verified:

1. **Scientific Payload Normalization & Grouped Conflict Comparison**:
   - `server/services/syncService.js`: Added deep comparison and normalization (`normalizeDraftPayload`, `deepEqual`) for full scientific draft payloads (`value`, `values`, `checks`, `basis`, `replicateNo`, `instrumentId`).
   - Scalar `null` handling is corrected so `op.payload.value === null` is treated as `null` rather than string `'null'`.
   - When a grouped draft (e.g. TEXTURE fractions `40/40/20` at revision 10) encounters an older incoming payload (fractions `70/20/10` at revision 2), the discrepancy between `values` is detected even though both scalar values are `null`. The newer fractions are preserved in `workItemDraft.values`, and the incoming attempted fractions are captured in `_conflictPayload` with receipt status `CONFLICT`.
   - Verified via `C:/Users/yigin/AppData/Local/Temp/codex-lab-ui-review/draft-conflict-review.cjs`: **`structuredPreserved: true`**.

2. **Deduplication / Idempotency Status Preservation**:
   - `server/services/syncService.js`: Deduplication check now inspects the existing receipt status and outcome.
   - `DUPLICATE_APPLIED` is returned only when the command previously executed with `SUCCESS` / applied.
   - For non-success terminal outcomes (`CONFLICT`, `REJECTED`, `FAILED`), retrying the identical operation preserves its original status (e.g., `status: 'CONFLICT'`). This prevents clients from mistakenly treating a conflict retry as an applied success and discarding pending outbox work.
   - Verified via `C:/Users/yigin/AppData/Local/Temp/codex-lab-ui-review/draft-conflict-review.cjs`: **`retryPreservesConflict: true`**.

3. **Complete Probe Verification**:
   - `draft-conflict-review.cjs`: **Passed** (`structuredPreserved: true`, `retryPreservesConflict: true`, `sourceHashUnchanged: true`).
   - `draft-order-review.cjs`: **13/13 passed** (newer online draft preserved).
   - `draft-sequence-review.cjs`: **12/12 passed** (final synced value `7.25`).
   - Baseline hash of `server/prisma/dev.db` remains strictly untouched (`388E85FBC6573509F0C56E0F1DB6989FA682C2931AF5A90B0B82EEB1A0E6A90B`).

---

## Production Rollback & Recovery Procedure

A release rollback cannot merely revert a commit on the feature branch. The following procedure defines the pre-deployment inventory and step-by-step restoration to the running production release while accounting for post-deploy writes and governance semantics.

### 1. Mandatory Pre-Deployment Gate: Production Inventory & WAL-Consistent Backup
- **Running Production Revision (UNVERIFIED)**: While `origin/main` is at `ecb7c91`, the actual running container image and digest on the live production host have not been directly inspected from this workspace. Inspecting and recording the running image ID, image digest, environment configuration, network bindings, and volume mounts is a **mandatory pre-deployment gate**.
- **WAL-Consistent Database Snapshot**: SQLite running in WAL mode stores recent writes in `-wal` and `-shm` sidecar files. A raw filesystem copy without checkpointing can yield a stale or corrupt restore. Operators must take a consistent snapshot using the SQLite backup API or force a truncate checkpoint before snapshotting:
  ```bash
  # Option A: Online SQLite backup API (safe during concurrent reads/writes)
  sqlite3 /path/to/production/dev.db ".backup '/path/to/backups/dev.db.pre-deploy.bak'"

  # Option B: Checkpoint followed by atomic copy of database + sidecars
  sqlite3 /path/to/production/dev.db "PRAGMA wal_checkpoint(TRUNCATE);"
  cp /path/to/production/dev.db /path/to/backups/dev.db.pre-deploy.bak
  ```

### 2. Verified PR #94 Migrations & Preflight Behavior
The actual migrations introduced in PR #94 are:
1. `20260911130000_add_governance_lifecycle_and_grants`:
   - Creates `LabLifecycleState` (operational status, revision, pause reason/actor/timestamps).
   - Creates `StaffInvitation` (pending invitations with hashed single-use tokens, roles, lab scope).
   - Creates `StaffRecoveryGrant` (emergency admin recovery tokens).
   - Creates unique indexes on `StaffInvitation(tokenHash)` and `StaffRecoveryGrant(tokenHash)`.
   - **Preflight & Failure Behavior**: Uses `CREATE TABLE IF NOT EXISTS` and `CREATE UNIQUE INDEX IF NOT EXISTS`. Fails only if the SQLite catalog is locked by long-running transactions or filesystem I/O errors occur.
2. `20260911160000_add_active_invitation_unique_index`:
   - Creates partial unique index `idx_staff_invitation_active_email` on `StaffInvitation("email") WHERE "isConsumed" = 0 AND "isRevoked" = 0`.
   - **Preflight & Failure Behavior**: Enforces that at most one active, unrevoked invitation exists per email. If pre-existing dirty records with duplicate active invitations exist, index creation intentionally **fails closed** rather than arbitrarily deleting historical records.
   - **Preflight Query**:
     ```sql
     SELECT email, COUNT(*) FROM "StaffInvitation" WHERE "isConsumed" = 0 AND "isRevoked" = 0 GROUP BY email HAVING COUNT(*) > 1;
     ```
     Must return 0 rows before applying.

### 3. Semantic Compatibility Caveat
- **DDL Compatibility vs Semantic Governance**: While the new tables and partial index are additive and do not break basic SQL queries on existing tables (`WorkItem`, `Sample`, `Result`), additive DDL alone does **not** equal semantic compatibility.
- The pre-release application code lacks awareness of `LabLifecycleState` (paused vs active) and `StaffRecoveryGrant`. If the application container is rolled back to the pre-release image while pointing to the active database, the older application will **ignore** administrative laboratory pauses and governance boundaries, allowing unrestricted operations in laboratories intended to be paused.

### 4. Non-Executable Rollback Checklist

> [!CAUTION]
> Do not execute generic `docker run` commands that discard production networking, volume mounts, or secret environments. Use your verified deployment mechanism (e.g., Docker Compose, Kubernetes manifest, or deployment pipeline) following this operational checklist:

#### Scenario A: Immediate Rollback (Zero Post-Deployment Writes)
1. Drain incoming web traffic / put proxy into maintenance mode.
2. Stop the application container service using the production orchestrator (`docker compose down` or orchestrator stop).
3. Restore the pre-deployment WAL-consistent database snapshot:
   ```bash
   cp /path/to/backups/dev.db.pre-deploy.bak /path/to/production/dev.db
   rm -f /path/to/production/dev.db-wal /path/to/production/dev.db-shm
   ```
4. Update the service specification to reference the recorded pre-release image digest.
5. Launch service using the production deployment mechanism with verified environment configuration.
6. Verify health and read-only endpoints before reopening traffic.

#### Scenario B: Rollback After Post-Deployment Writes
1. **Do NOT overwrite `dev.db` with the pre-deploy backup**: Any determinations, sample receptions, or audit logs recorded after deployment would be destroyed.
2. Verify whether post-deployment analytical records exist:
   ```sql
   SELECT COUNT(*) FROM Result WHERE createdAt >= '<DEPLOY_TIMESTAMP>';
   SELECT COUNT(*) FROM WorkAttempt WHERE createdAt >= '<DEPLOY_TIMESTAMP>';
   SELECT COUNT(*) FROM Sample WHERE receptionDate >= '<DEPLOY_TIMESTAMP>';
   ```
3. Export post-deployment delta records to an external backup before making any container or database changes.
4. If reverting the container image while retaining the migrated database:
   - Be aware of the **semantic compatibility caveat**: laboratories marked PAUSED in `LabLifecycleState` will become operational under the old code.
   - If emergency administrative pause must be maintained, revoke user sessions or block network ingress for affected laboratory subnets.
5. Merge and deployment remain strictly on hold until explicit release sign-off.


