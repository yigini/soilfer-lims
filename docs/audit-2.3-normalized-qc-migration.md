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

Evaluated JSON is authoritative. Typed rows supply observations only when JSON is absent or unparseable. Typed/JSON count or value conflicts are reported, and both sources remain intact. Within a snapshot, exact recorded copies may be associated for provenance; UUID ordering never determines the JSON slot order. No association or measurement supersession is inferred between snapshots. Duplicate parent, method, user, instrument, time, number format and catalogue values are never fabricated. Unknown values remain nullable with explicit unresolved counts; recorded censoring has a null measured value and a separate qualifier/limit.

`backfillCount` is the number of inserted normalized rows, including membership, evaluations and events. `backfillCounts` also reports current and historical source quantities, conflicts and unresolved categories. The receipt records these counts and the reviewed fingerprint. It does not signify an audit pass or a deployment. The #162 exact-head Claude audit and post-deployment checks still apply.

This checkpoint supplies the installer and read-view services. Startup/entrypoint enforcement and the QC API cutover must be connected and tested together before this release can be deployed.
