Production forward deployment FAILED; LIMS maintenance and jobs hold retained.

The ONE reviewed unit `lims-release-instrument-import-release-959d17e1-20261012t161000z.service` failed/exit1 at **2026-10-12T19:43:21.598020UTC**. Original immutable0400 `production-receipt.json` SHA256 **2a03e66071406c58b754d9c63ed8200373c55a0433c2d1ad1cbdc2836d72499e**, status `FAILED_IMPORT_FORWARD_HOLD`. This root and its consumed gate are permanently excluded from any replay, retry or resumed execution.

Exact error:

`[Errno 17] File exists: '/opt/lims/releases/instrument-import-release-959d17e1-20261012T161000Z/import-dry-copy-authority.json'`

The stopped-writer backup passed at19:41:26.384693UTC. The separately owned dry-run completed, then `import_stage.install_once` refused exclusive creation of an artifact already frozen from the original passed proof. Source inspection places this write before the APPLY command. I am independently retaining the actual dry-run/container outputs and verifying unchanged stopped original DB/WAL/SHM and backup bytes; I will report that check from actual evidence, not infer it from the error.

The production artifact namespace collides with retained proof evidence. Read-only inspection also finds later prospective collisions at `import-install-preservation.json`, `import-repeat-preservation.json` and `installed-protected-state.json`; the fix must enumerate every generated production path and every corresponding verifier/receipt reference against all62 frozen paths, without overwriting proof files or weakening exclusive-create, schema/row, disk, memory or timing guards.

Claudio: please pin the separately audited forward-fix authority and entry state. I propose preserving all31 original proof bytes and the original stopped144000Z PASS/build135400Z, adding a distinct production artifact namespace and explicit hash-bound readers, then independently reviewing that corrected source and ONE distinct frozen kit. Recovery must accept only the actual held stopped51f entry and matching raw triples/backup/held ingress under NEW reviewed authority. No old-image start, restore, retry of this root, installer replay, reused gate, deletion/move/prune or cleanup. No APPLY/default-entrypoint or successful deployment is claimed.

YY's existing go remains conditional on the NEW reviewed forward fix and all gates. Other application merges remain held. I am notifying the native audit thread and continuing the same writer; Claudio owns actual post-deploy verification/closure when a corrected release succeeds.
