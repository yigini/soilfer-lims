PR284 / #200 release preparation — proposed source only

The application remains draft head 217a623bea0766688cd1e76c9344d19ec3f0ed12
against released main51f. Its full 360-suite local run and exact GitHub CI are
still in progress. No #200 candidate build, rehearsal, kit, gate, production
installer or deployment has started. Completed PR293 remains healthy and its
original receipt, kit, proof, build and consumed gate remain untouched.

Proposed adapter source ab824ae566c693c6f4b96e1b383f095148383532 passed 64/64
Windows and 64/64 exact-source Linux guards on 2026-10-12 at 07:23:58 and
07:24:01 UTC, respectively. Both runs have zero failures/errors/skips and no
production database access. Raw stdout/stderr are retained in
WP/pr284-resume-20261012/import-adapters-*-0723.*. This is preparation evidence,
not a source-review pass or execution authority.

The new modules are separate from all historical measured/runtime helpers:

- import_preservation.py independently compares two consistent read-only
  snapshots: exactly104 original tables/38 receipts to106 tables/39 receipts.
  It admits only the source-bound native ALTER pointer, two empty import tables,
  one index/six immutable guards and one verified installation receipt. Every
  original schema object, column and ordered row remains bound, including #205
  records. It refuses historical draft links, import data, other row/schema
  changes, wrong assets/receipts/hashes and unsealed WAL/journals.
- import_startup_checks.py checks the unchanged default entrypoint with the
  additional import step: exactly23 NO_OP/0 verifier outputs, then exactly22
  ordered READY/0 events. It checks COMPLETE_200, all five source hashes and
  zero import counts. Historical readiness/disk/state/probe helpers will remain
  byte-identical and separately bound in the new reviewed coordinator.
- import_installation.py proposes one bounded native #200 dry/apply/repeat
  sequence. Its only script is install_instrument_imports.js. It uses the exact
  image digest, no network, 768MiB, blank NODE_OPTIONS, no auto-push/seed and no
  restart policy. All owned CLI containers are retained. A successful apply
  must have exactly one receipt write and no data backfill; repeats require
  NO_OP/0. Failure has no retry, rollback, old-image or cleanup path.

Measured raw source hashes:
import_preservation.py c150db31dde7b97d03a16183cff706369cb77ea2fe96beb766f537c83c2fe7fa
import_startup_checks.py c755c31a6cf1ec907ab524f4e0bf8bf34f093d57da7765b7a0cbcdb083fbb814
import_installation.py f6fd1ac2a328ec876cd4f4be7635f69ec63ae65650886cf7fe8c2d1f3f78ee4a

Still required before any new execution: actual exact-head application audit
and all green PR/main CI/Docker; a new complete source-bound coordinator and
formal source review; one fresh isolated proof of the native delta plus strict
jobs-OFF preservation and two natural jobs-ON completions; one immutable kit;
Claudio's exact-kit audit; one fresh10-minute single-use gate. The existing YY
go applies only when those new gates pass. No prior consumed authority is reused.
