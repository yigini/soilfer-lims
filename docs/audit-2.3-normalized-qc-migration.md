# Audit 2.3 normalized QC migration

The reviewed installer is `server/scripts/install_qc_runs.js`. It adds four nullable Batch fields, eight normalized tables, fourteen indexes and forty-two guards. It never deletes or rewrites legacy QC JSON, BatchQcResult values, analytical results or AuditLog rows. Legacy fields stay frozen until audit 8.1.

Run it against a quiescent database after installing the earlier audited releases. Take a consistent database and assets backup through the release procedure first. A dry-run opens SQLite read-only and reports the classification, proposed row counts, unresolved metadata, source conflicts and a deterministic fingerprint:

```sh
node server/scripts/install_qc_runs.js --db /absolute/path/lab.db --dry-run
```

Review the counts and every refusal. An import with existing batches requires the exact dry-run fingerprint; the installer reads the plan again under its write lock and refuses if the source has changed:

```sh
node server/scripts/install_qc_runs.js --db /absolute/path/lab.db --apply --plan-sha256 <reviewed-backfillFingerprint>
```

The container entrypoint accepts that reviewed digest as `QC_RUN_PLAN_SHA256`. An existing nonempty legacy installation without its reviewed digest is refused. Direct server startup checks the completed installation read-only before loading the application, writable adapter or scheduler.

The source DDL and the fresh Prisma table oracle are bound to release SHA256 digests. Partial schemas, altered definitions, nonempty unmarked normalized tables and altered receipts are refused. Empty fresh Prisma schemas receive the same partial indexes and guards. An installation receipt is inserted only in the transaction that imports every planned row and installs every guard. A failure rolls the whole transaction back. Repeat installation and the startup check write nothing.

Historical import follows issue #186 scope pins, including part 7. Every snapshot becomes a separate evaluation in sequence order with its own positions and measurements; AuditLog wins over a conflicting Batch.history copy. Current rows are imported last. The original sequence, JSON, typed row, original identifier and values are retained in source/evaluation payloads. Historical positions carry historicalSnapshotSeq and stay outside current sequence and QC views. An empty final clear creates an INCOMPLETE evaluation with LEGACY_CLEARED and no current measurements. It retains all preceding evidence.

Part 8 narrows the non-native freeze to sample membership. Compatibility submissions can append new PROFILE_ONLY QC positions, measurements and evaluations; the latest evaluation identifies that round's current evidence. Native positions stay frozen after first start. Neither path changes historical positions or values.

Evaluated JSON is authoritative. Typed rows supply observations only when JSON is absent or unparseable. Typed/JSON count or value conflicts are reported, and both sources remain intact. Within a snapshot, exact recorded copies may be associated for provenance; UUID ordering never determines the JSON slot order. No association or measurement supersession is inferred between snapshots. Duplicate parent, method, user, instrument, time, number format and catalogue values are never fabricated. Unknown values remain nullable with explicit unresolved counts; recorded censoring has a null measured value and a separate qualifier/limit.

`backfillCount` is the number of inserted normalized rows, including membership, evaluations and events. `backfillCounts` also reports current and historical source quantities, conflicts and unresolved categories. The receipt records these counts and the reviewed fingerprint. It does not signify an audit pass or a deployment. The #162 exact-head Claude audit and post-deployment checks still apply.

This checkpoint supplies the installer, read views, native build/first-start/rebuild services and native measurement/evaluation/correction services. First start re-resolves the complete policy/rule, method LOQ and number format; validates the existing sequence; allocates the ordinal; and freezes those criteria with the authenticated analyst and registered instrument in one transaction. A resumed run reuses its first-start criteria. Shared references resolve every required analyte before any binding write, retain exact value revisions and converted precision, and enforce one physical lot. A shared lot correction re-evaluates affected analytes atomically; flags affect only their results and never change analytical readings.

Part 9 preserves bound QC position ids and all bindings on an unmeasured pre-start rebuild, including extras no longer required. Explicit pre-start lot changes append replacements with `REBUILD_BEFORE_START`. Native OFF runs record `NOT_REQUIRED` on explicit evaluation, with zero fabricated readings; this result is exposed separately from the aggregate acceptance state. Missing ADVISORY evidence is `INCOMPLETE`. A measured extra CRM is evaluated even when its ordinal does not require it.

Part 10 refuses removal of the last member of an analyte with retained reference bindings with `QC_ANALYTE_REMOVAL_BLOCKED`, before any write. An optional lot correction that no longer serves a previously bound analyte appends an explicit `NOT_SERVED` binding with null expected value and snapshot, while superseding and retaining the preceding binding. Required references still require all served analytes. Current evaluation excludes the unserved position; preceding measurements and evaluations remain unchanged.

Part 11 corrects the earlier reopen statement: QC_FAIL remains locked for every role and uses the existing disposition path. No failed-QC reopen route is added. Manager reopen of QC_PASS/QC_WARN records the reason and changes acceptance to QC_PENDING while retaining native measurements and evaluations. Native accepted corrections require this reopen; advisory evidence can be corrected without one. Compatibility reopen hides the old round from the current view, preserves it as evidence, and the next ordinary full submission appends new PROFILE_ONLY positions, measurements and an evaluation with its REOPENED event id. The deprecated JSON and BatchQcResult rows stay unchanged.

Validation is separated explicitly: the preceding `fed2d49` checkpoint passed the full current-runtime suite (230 suites / 3,194 tests). The newer source passed 125 focused migration/view/planner/guard/security contracts and twenty native plus twelve compatibility integration contracts against a separately generated #186 Prisma SDK with real owned SQLite and release guards. The full application has not yet switched its SDK/database initialization/controllers. Startup/entrypoint enforcement, compatibility resubmissions, the unified QC/disposition API cutover and every OFF display/report surface must be connected and tested together before this release can be deployed. Compatibility duplicate-parent resubmission and positive-minimum extra-slot service questions are recorded on #186; no audit pass or deployment is implied.
