# B1: canonical intake and basic configuration

4 October 2026. Implemented in the isolated Codex checkout; exact-candidate review, CI and release are still required. This is initial delivery for issue156; B2 custom editing and explicit draft upgrades remain required.

One transactional intake command now serves reception, batches, physical receipt, acceptance, walk-in compatibility and existing offline RECORD_INTAKE. Receipt creates neither accession nor preparation/analysis work. Acceptance checks the server-selected immutable revision, current authority, admission/holds and persistence version. Work generation, audit and durable command receipt share the transaction. A matching committed receipt survives a lost response/retry; changed payloads and stale versions conflict without replacing input.

Basic manager controls select published forms and toggle enabled/required catalogue rows. Project selection also requires actual project-plan authority. Published schemas cannot be edited/deleted/downgraded in storage. Original saved revisions stay pinned through default changes and retirement; emergency revocation requires recovery. Accepted history renders its recorded schema/answers once, rather than the incompatible legacy checklist.

The command preserves photographs, profile/source details, zero/decimal values, custody, original physical receipt and existing orders. Batch confirmation is explicit and attributed to the authenticated actor. Selecting a bulk bundle adds its analyses/group to existing row orders. Untouched defaults do not erase observed foreign material. No default PASS,500g,moisture,accuracy or0–20cm is fabricated. Other material has no soil-only context. Incomplete drafts are permitted; invalid entered values are reported.

Local autosave, cached published definitions, queue receipts and recovery remain user/lab scoped. Legacy ownerless autosave is preserved for explicit ownership review. Device-only input is labelled awaiting synchronization; no accession or completion is claimed until the server confirms it. Existing shared-device account-switch protection was reused and tested.

## Finite checks

25 new tests pass in `intake_templates_and_sync.test.js`: seed semantics; authorized context/precedence; origin tampering; pinned revisions;0/20.5/photos/custody/profile; own-lab/project scope; immutable storage; retire/revoke; receipt-only/legacy bypass; all three offline intentions; full-payload retry; legacy conflict; concurrent record edit; current authority before replay; atomic batch rollback and bulk attribution; malformed alias and required persistence version; lost online response→sync duplicate; pinless offline accept; PT round identity; real categorized work generation; injected work/receipt failure rollback; same temporary bag across draft/accept; source/custody preservation; servicing-manager denial; original physical receiver preserved; simultaneous compare-and-set saves.

Relevant existing focused contracts passed: `reception_compliance`, `reception_stage_a`, `intake_profile_capture`, `reception_compliance_component`, `reception_stage_b`, `reception_stage_d`, `reception_stage_e`, `reception_regression_stage_f`, `reception_post_release_correction`, `mobile_offline_sync`, `reception_admissions_pm14`, `reception_package_resolution`, `reopened_governance_scenarios`. This includes an actual40-row transactional consignment with38 accepted and2 rejected. No broad production test fixture was inserted.

Windows worktree invocation:

```text
node node_modules/jest/bin/jest.js --testMatch '**/tests/**/*.test.js' --runTestsByPath tests/contracts/intake_templates_and_sync.test.js --runInBand --silent
```

Client production build passes; existing large-chunk/Browserslist warnings remain documented rather than prompting unrelated upgrades.

## Migration and browser evidence

Final additive migration ran twice on a separate563,322,880-byte read-only-source copy:38,566 samples,19 results,49 users,10 labs,90 work items,12,462 audit rows unchanged; integrityOK/FK0 both before/after. Four seeds created; second execution idempotent. Seed semantic/hash mismatch fails closed, never replaces historical definitions. Private database/report remain outside Git.

Real local Chromium browser uses guarded synthetic fixture/accounts only. Manager changed CoC required control and saved/applied a new immutable version through the actual Settings screen; server-confirmed feedback and published selection observed, no console errors. English, Spanish, Latin-American Spanish, French and Portuguese controls/criterion/context labels inspected. At320px viewport, document width320px; mobile screenshot retained. Browser viewport emulation is not physical iOS/Android qualification.

Offline browser journey deliberately disabled networking: incomplete commercial draft with observed mass0 showed “Saved on this device”, no issued accession, and awaiting-server draft state. Restoring networking synchronized through the existing engine and produced an owned durable server receipt and confirmation. Synthetic-source administrative-units404 is a fixture limitation, and deliberate offline network errors are not a product defect. Screenshots: `output/playwright/intake-b1-device-draft.png`, `intake-b1-manager-saved.png`, `intake-b1-manager-mobile.png`.

Remaining for B1: identified-candidate independent review, exact CI/guarded merge, exact merged-main CI, stopped-writer backup/cutover, live read-only touched-role checks. B2 remains required; do not close156 at this point.
