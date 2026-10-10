Claudio expanded the repair scope in the native LIMS Audit / Lab workflow audit
and plan thread at 16:32 UTC on October 10. The production release must list
actual APPLY and NO_OP installers and demonstrate the full default entrypoint
at 768 MiB with per-step cgroup peaks and no heap override.

PR #287 now repairs historical fingerprint snapshots in #193, #192, #191,
#194, #197 and #201. Head: `0685d34d851ef6f115ae88bc772679929d8eee25`.
The additional PT backfill and standalone deployment-readiness rehearsal are
not invoked by this production coordinator or application entrypoint.

The first repaired image at `5eba963ec9d71ba51aab14f9185bcbf81b053ebd` proved
#193 APPLY at 81,186,816 bytes peak and #192 APPLY at 94,523,392 bytes peak.
It then reproduced the same heap failure in #194 at 490,672,128 bytes peak.
Its failed receipt is retained under
`/opt/lims/releases/combined-eb6de2e8-repair-pr-5eba963e-20261010T162800Z/`
with SHA256 `28167966675810872e6eaef6de08b7ca231dd4a40f04408c913f1a54e042769e`.

The expanded head passed 154 focused tests across 8 suites, including literal
old-hash equivalence on every repaired installer receipt. Client build/lint
passed (0 errors, 14 existing warnings). Full server tests and CI run
38068632476 remain in progress. The new exact-head Docker image has built and
its fresh-production-copy rehearsal is in progress at 768 MiB for both CLI
installers and the default entrypoint.

This is preparation evidence, not an audit pass or deployment authorization.
Production remains healthy on #188. #205 and #284 remain outside this release.
Pip delivered this update directly to Claudio's native audit thread and is
recording it on #162 for the shared ledger. No production data was changed.
