# Expanded release guard evidence

Current frozen source: `b02238df5ef4da6f91d2757f8a0498c45e7b1326`.
Corrected raw export has 25 executable sources/authorization transcriptions;
all upload hashes match, and no old execution receipts/gates/manifests exist
in the new root. **30/30 Linux guards passed, exit 0, 0.601 seconds**.
Log SHA256 `ad55e361d47f6dd51b4e4c2afd09fdc4389259cbbfbb60d5067a6a6e3b4991f5`.
Owned guard/build/rehearsal root:
`/opt/lims/releases/combined-eb6de2e8-main-feac6534-retry-20261010210829Z`.
Unit `lims-owned-main-feac6534-retry-20261010210829z.service` is running the
new build and subsequent fresh-copy proof. Earlier records below are retained
for traceability. They do not establish a PASSED complete rehearsal.

Frozen integration source: `b0633b6ffbe04c9b4d0bb6b367930e5fb4af6356`.
Raw Git export, 51 files, verified on the host before running guards.
Owned tooling root:
`/opt/lims/releases/combined-eb6de2e8-tooling-b0633b6f-20261010210231Z`.

`python3 test_release_guards.py`: **29/29 tests passed, exit 0, 0.253 seconds**.
This retains all 24 existing guards and adds acceptance scope/digest refusal,
exact CLI order with immediate pre-#191 repeat, changed-plan pre-apply refusal,
receipt/delta repeat guards and real owned-SQLite status/event preservation.
The existing complete-proof and fresh exact-kit gates also now exercise
the 21st PR, added CLI measurements and YY review-choice binding.
Log SHA256:
`90325186b47f73d8354d22571aea4324afa64830a60bc6664138c2e855e06362`.

Read-only current application gate snapshot:
`pr-gates-feac6534-pending.json`, SHA256
`2577e45b73bc239bfb549e8be6961d8f0da059b4dacf454a4361f06ac81d748e`.
All 21 included PRs have matching-head audit passes and green CI; ungated 0.
Merged-main CI 38085615017 is still pending at this snapshot. It does not
authorize deployment.

Source export for merged application feac6534 verifies 2,224 raw Git blobs.
Archive SHA256 `5ae6039446bbd3cb038e2ac202b6fee966c89de1513f144dfd29d5260ce9f10d`.
Index SHA256 `70b9bf21d560ec932ef7613fc32971b7a693e5a6e15b697cc2327c70b3edb720`.
The first packaging dispatch was refused before build/copy; its record is in
`289-preparation-packaging-refusal.md`. Corrected packaging adds a 30th guard
and needs a new frozen source/test result and NEW proof directory.
