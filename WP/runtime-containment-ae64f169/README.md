# New same-image jobs-hold containment preparation

Separate runtime incident: #162 comment6111808236. This is new preparation,
not authority to mutate production. Claudio has presented a YY decision for
the temporary operational jobs hold. Never answer that decision for YY.

rehearse_jobs_hold.py creates ONE new isolated fresh-production-copy proof.
It has no production execution mode. It uses SQLite's read-only backup API,
including committed WAL, then the exact current ae64 image/default entrypoint
with jobsOFF, the same effective environment and768MiB/no heap override.
The copy must preserve all104tables/38receipts, main bytes/data_version and
the retained acceptance/report;22entrypointNO_OP0/21READY0 and31+6probes pass.
It then observes660seconds of healthy/stable-restart state after readiness.
Only the new owned container is stopped; proof/source/DB/receipts retained.
The current production container, ingress, volumes and jobs are never changed.

The imported leaf helper/probe files must be exported from exact raw Git blobs
into a NEW source root, mode0400 and SHA256 bound in source-index.json. Importing
these helpers performs no operation. Do not call their old held_state or old
coordinators, replay historical gates, or repurpose a historical proof.

Only after a PASSED new proof, separately frozen reviewed containment coordinator
and resolved YY jobs-hold authority may a live operation proceed. Recovery stays
forward-only; no restore, old image, heap increase, installer replay or cleanup.
