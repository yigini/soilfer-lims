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

The source DDL and the fresh Prisma table oracle are bound to release SHA256 digests. Partial schemas, altered definitions, nonempty unmarked normalized tables and altered receipts are refused. Empty fresh Prisma schemas receive the same partial indexes and guards. An installation receipt is inserted only in the transaction that imports every planned row and installs every guard. A failure rolls the whole transaction back. Repeat installation and the startup check write nothing.

Historical import follows issue #186 scope pins, including part 7. Every snapshot becomes a separate evaluation in sequence order with its own positions and measurements; AuditLog wins over a conflicting Batch.history copy. Current rows are imported last. The original sequence, JSON, typed row, original identifier and values are retained in source/evaluation payloads. Historical positions carry historicalSnapshotSeq and stay outside current sequence and QC views. An empty final clear creates an INCOMPLETE evaluation with LEGACY_CLEARED and no current measurements. It retains all preceding evidence.

Part 8 narrows the non-native freeze to sample membership. Compatibility submissions can append new PROFILE_ONLY QC positions, measurements and evaluations; the latest evaluation identifies that round's current evidence. Native positions stay frozen after first start. Neither path changes historical positions or values.

Evaluated JSON is authoritative. Typed rows supply observations only when JSON is absent or unparseable. Typed/JSON count or value conflicts are reported, and both sources remain intact. Within a snapshot, exact recorded copies may be associated for provenance; UUID ordering never determines the JSON slot order. No association or measurement supersession is inferred between snapshots. Duplicate parent, method, user, instrument, time, number format and catalogue values are never fabricated. Unknown values remain nullable with explicit unresolved counts; recorded censoring has a null measured value and a separate qualifier/limit.

`backfillCount` is the number of inserted normalized rows, including membership, evaluations and events. `backfillCounts` also reports current and historical source quantities, conflicts and unresolved categories. The receipt records these counts and the reviewed fingerprint. It does not signify an audit pass or a deployment. The #162 exact-head Claude audit and post-deployment checks still apply.

This checkpoint supplies the installer, read views and native build/first-start services. First start re-resolves the complete policy/rule, method LOQ and number format; validates the existing sequence; allocates the ordinal; and freezes those criteria with the authenticated analyst and registered instrument in one transaction. A resumed run reuses its first-start criteria. Shared references resolve every served analyte before any binding write, retain exact value revisions and converted precision, and enforce one physical lot.

Validation is separated explicitly: the preceding `fed2d49` checkpoint passed the full current-runtime suite (230 suites / 3,194 tests). The newer source passes 125 focused current-runtime tests and seven native build/start/reference integration tests against a separately generated #186 Prisma SDK with real owned SQLite and release guards. The full application has not yet switched its SDK/database initialization/controllers. Startup/entrypoint enforcement, membership rebuilds and the unified QC entry/evaluation/correction/disposition API cutover must be connected and tested together before this release can be deployed. Open behavior questions are recorded on #186; no audit pass or deployment is implied.
