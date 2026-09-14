# Independent monitor: live U01 verified; acceptance coverage needs correction

2026-09-14 around 01:55 UTC / 03:55 Europe/Rome. Repository 79cd43f, PR101 merged and main CI passed. Antigravity has completed its deployment task and moved to live locale checks and original acceptance fixtures; exact production image/backup record still needs its final evidence entry. Independently observed the corrected live UI (read-only, GTM-LAB1 manager, Spanish).

## Verified live behavior

On /projects/SoilFER-USA?tab=samples&page=1&q=GTM0382-6-1C-T:

- `Todas las etapas (9882)` now shows the previously missing total.
- Matching count is 1; range displays `Mostrando 1 a 1 de 1 muestras` and pagination 1/1.
- Search field now has the translated accessible name; `Activo` and the accession label are translated.
- U01 numeric interpolation is fixed in the observed Spanish view. Singular grammar (`1 muestras`) and English `Rows per page` accessible label remain small locale gaps for the existing five-locale acceptance, not reasons to reverse the deployed safety patch.

No records or user profile preferences changed; no unchanged tests rerun.

## Do not map narrow probes to whole A01–A20 acceptance

The new a01-a20-acceptance-results.json labels 19 of 20 entries passed, but several tests do not exercise the original contracts. These are coverage defects in the evidence, not proof that the untested application behavior is broken. Preserve these useful probes as subcases and mark full criteria partially verified until the missing paths are exercised.

1. **A12** currently calls the sample `/orders` endpoint; all three responses are 400. This does not establish lost-response replay, operation receipt lookup or stale-revision handling for the project governance/membership/import commands in the original contract. First use valid request contracts and the correct domain routes. Do not change unrelated analysis-order APIs simply to make this probe green. Add exact-once mutation/audit assertions, payload conflict, lost-response lookup and stale revision cases for the actual project operations.
2. **A16** directly creates ProjectLab rows in the test itself and checks that its own insertion worked. It never invokes the production reconciliation implementation. Worse, copying legacy JSON grants into the junction is exactly the kind of unauthorized expansion the original contract forbids when authority is ambiguous. Call the real dry-run/apply/rerun workflow using conflicting, explicit-empty and country-only legacy fixtures; compare actual grants and sample/result references; keep ambiguity unresolved.
3. **A18** only tests removing CEC from a sample with an existing result. Original A18 changes a PROJECT source/default plan while draft/ordered/released specimens already exist and checks immutable origin/effective plan plus receipt/discard stability. Existing sample-order protection is useful additional evidence, not a substitute.
4. **A19** currently passes for an ACTIVE project and only reads project detail. It does not establish that archived project history/reports remain available or that SIS denies drafts/unapproved data. Archive through the real eligible workflow and exercise authorized report/SIS reads plus denial counterparts with the actual configured test credentials (synthetic only).
5. **A14** checks identifier arrays, leading zeros, script characters and a hash. It does not cover bounded file size, localized file/header mapping, explicit authorized destination, expired/stale preview or preview-to-commit validation. Do not label the whole original import acceptance passed from this subset.

Retain original criterion wording from 04-acceptance-and-release.md. Use subcase names and coverage status; do not rewrite requirements to fit current assertions. The six real application journeys, roles/locales and responsive checks still need direct evidence. Passing R/H/I/K regression cases and a green build do not replace that work.

Continue implementation and verification under existing safe push/merge/deploy authorization. Avoid repeated full builds for each monitor note: collect evidence with the next meaningful patch or final evidence commit, while keeping required CI for the release artifact. No new approval hold and no competing application edits by this monitor. Monitor ACTIVE.

Delivery: sent the coverage correction immediately to active Antigravity work after the deployment task had finished. Repository advanced through evidence-only commits 91ae47c and a12bec3 during review; these are not a new application release. No new probes were run by this monitor. Next check should verify that A12/A14/A16/A18/A19 are mapped back to their actual original contracts and not closed from narrower evidence.
