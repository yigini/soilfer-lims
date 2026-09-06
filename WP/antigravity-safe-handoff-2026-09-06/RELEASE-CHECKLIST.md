# Integration and deployment acceptance

This is a required execution checklist, **not a record of completed checks**. The code and database must be assessed together.

## Preserve and compare

- [ ] Verify the package hashes, current source differences, untracked source and current Git index. Record checkpoint commit before further implementation.
- [ ] Confirm the real deployment checkout, commit/image, database path, upload/spectral storage, operating mode and push/deployment trigger. Do not infer them from the example Compose files.
- [ ] Review all changed entry routes and catalogue dependencies. Shared runtime files under `server/data` must be included in the source commit and Docker build.
- [ ] Maintain a ledger for the existing v3 acceptance checklist and all preserved sample-workspace-v2 controls.

## Verify the actual laboratory workflow

- [ ] Intake → requested analyses → package expansion → assignment → drying → preparation → analysis → completion review → technician submission → manager review → sample release → report is connected, scoped and auditable.
- [ ] Before preparation is complete, every analytical write route rejects real measurement drafts and completion. Operational partial checklists are allowed without opening gates. Preparation exemptions are explicit method/material rules.
- [ ] Numeric, operational, grouped texture and spectral data cannot fall through to a generic scalar handler. Missing type/configuration produces a useful error.
- [ ] Names are readable across selection, workbench, sample, map, review and report views; method distinctions remain visible and internal identities stay stable.
- [ ] A 40-sample procedure batch handles order, QC rows, instrument identity, pasted decimal formats, wrong sample IDs, duplicate rows, partial failures, refresh, network loss and concurrent editors without false “saved” or “submitted” states.
- [ ] Texture is selected once, recorded atomically and classified from independently verified fractions. Classification-system/version provenance survives approval, amendments and reporting. No unsupported universal closure tolerance or silent normalization.
- [ ] Managers cannot approve fresh intakes or unsubmitted analysis. Completed/submitted/approved evidence cannot be edited through alternate endpoints. Amendments preserve the original evidence and report lineage.
- [ ] Every role has appropriate dashboard landing content and matching scoped counts and links. Test direct URLs/API calls as well as hidden/disabled buttons.
- [ ] Instrument exports, spectroscopy/library links and prediction provenance are exercised using known fixtures for each supported import profile; unknown formats are rejected clearly.

## Migrate without replacing the live catalogue

- [ ] Inventory actual analyses, procedures/defaults, JSON packages/orders, work items/drafts, results/replicates, spectra/predictions, reports, approvals, mappings and audit records.
- [ ] Produce a dry-run change report for placeholders, imported definitions, duplicate aliases, method ambiguity and changed result structures. Resolve known records deterministically; isolate unresolved cases for laboratory configuration instead of guessing.
- [ ] The migration is transactional where supported, idempotent, versioned and tested for repeat runs and failure recovery. No reset, force-clean seed, silent loss or reinterpretation of approved data.
- [ ] Reconcile row-level IDs, values, units, method links, current/superseded results, reports and files before/after. Explain intentional changes; counts alone do not prove preservation.
- [ ] Deploy backward-compatible expansion/backfill/read-switch changes where needed. State when an old application image is no longer compatible with the new database.

## Repository-specific deployment concerns

`docker-entrypoint.sh` currently runs `prisma db push` and `seed.js` on every startup and continues after failures. Before this redesign is deployed, make production startup and migrations explicit: an unsuccessful migration must prevent the new application from starting against an incompatible schema. A successful health endpoint cannot establish that the migration succeeded.

`.github/workflows/ci.yml` uses `db push --accept-data-loss` while provisioning its disposable test database. That is **not a production migration command**. Ensure test environment URLs cannot target production. The existing test harness copies a local database file; for testing against a production copy, first make a consistent snapshot and isolate it with its own files, ports and environment.

The maintenance book's simple file-copy backup examples are insufficient as a release procedure for a writing SQLite database. The repository already has `server/scripts/backup_db.js`, which uses the SQLite online backup API. Use a protected per-release backup destination, confirm successful completion and test restoration. Its retention routine removes older matching backup filenames in its destination, so keep the release checkpoint outside ordinary rotation. SQLite documents the online backup API as producing a database snapshot: [SQLite backup documentation](https://www.sqlite.org/backup.html).

Back up uploaded spectra and other files as well as database state. Coordinate the snapshot with write quiescence or a consistent file/database cutoff. Record environment/image metadata without putting credentials or private production data in Git or this handoff archive.

## Release and recovery

- [ ] Build and test an exact commit using the production runtime and image. Run the full relevant regression suite; classify any pre-existing failures rather than hiding them. The saved 120-test report is baseline evidence, not a substitute for testing the new implementation.
- [ ] Rehearse migration and restore on isolated storage. Check database integrity and representative spectral/result/report links after restore.
- [ ] Before production migration, record the rollback-compatible image, migration state, protected database/files snapshot and allowed recovery path. If production has accepted new writes, do not blindly restore an older database and discard them; stop writes and reconcile or use a tested forward repair.
- [ ] Execute the verified migration and deploy the tested immutable image. Confirm deployed version and migration version before reopening writes.
- [ ] Perform read-only production checks for health, catalogue availability, counts, queue readiness, protected result controls and report views. Use isolated fixtures/staging for mutation tests; do not complete or approve real lab work as a smoke test.
- [ ] Produce the receipt required by START-HERE.md, identifying any tests or scientific configuration still incomplete.
