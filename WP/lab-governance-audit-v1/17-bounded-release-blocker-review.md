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
