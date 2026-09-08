# Implement mobile and offline work — desktop protection is mandatory

User handoff: 8 September 2026. Project **LIMSI**, existing chat **LIMS Dev**, working folder **C:\Users\yigin\Documents\soilfer-lims**.

The user has now requested that Antigravity receive and implement this mobile redesign. This document activates the planning handoff in `ANTIGRAVITY_PROMPT.md` and adds the user's desktop-preservation requirement. Read the complete package before editing, then carry out implementation in verified stages. Do not stop after drafting another plan.

## Desktop contract

Preserve the approved desktop appearance, navigation, controls and normal laboratory workflows. This project is not authorization for another desktop redesign. Capture the current desktop visual and functional baseline after reconciling all existing local work, including the recent signature visual refresh and spectral fixes.

Mobile and tablet presentation must use scoped responsive variants and available-width rules. Do not replace the desktop sidebar, reorganize desktop pages, change desktop typography/spacing/colors, shrink its worksheets or hide existing controls. Avoid broad CSS selectors that silently affect desktop. A desktop browser resized into a narrow layout may naturally use the compact variant; full-width desktop must retain its approved design.

Shared components, storage interfaces and additive server services may be changed where required for mobile/offline support, with backward compatibility. Keep current desktop APIs, result editing/submission semantics, role/scope checks, scientific calculations, reports and integration contracts working. Use one domain implementation and separate presentation variants.

An existing approval/readiness defect is not permission for an unreviewed workflow redesign. Identify each correction and its intended behavior separately; reuse established laboratory rules and existing authorization. Any broader desktop workflow change outside the approved mobile/offline scope must be presented separately before it is made.

No stage is complete until relevant desktop screenshots and complete online laboratory journeys pass regression checks, alongside phone/tablet tests. Include login, reception, assignment, drying/preparation, result entry, submission, review/amendment, reports, equipment, inventory, analysis catalogue, translations and KoBo/SIS interfaces where affected. Preserve five languages and the light-default/session-override/profile-preference appearance policy.

## Implementation order

1. Reconcile source, record current SHA/dirty state, review all 35 routes and embedded controls, and capture desktop baselines. Preserve unrelated work and the package.
2. Implement and verify adaptive navigation, headers, forms, dialogs, lists and method-run views. Keep desktop behavior intact. This can be an intermediate responsive release; do not describe it as completed offline support.
3. Add durable offline storage, scoped work packs/enrollment and recoverable outbox using the specified native/web adapters. Then add compatible server synchronization, causal ordering, transactional idempotency, attachments, conflicts and recovery.
4. Complete every eligible laboratory flow and the remaining feature coverage. Results are recorded through the canonical workbench; sample views display them and link to exact tasks. Drying/preparation are operational checklists; texture is atomic; spectroscopy preserves original files.
5. Produce and test installable web access plus Android/iOS packages. Treat actual iPhone/iPad/Android offline lifecycle and storage tests as release gates. Prepare everything possible before identifying any genuine missing signing/device resource.
6. Pilot and release in compatible stages through the project's established GitHub and deployment process. Push reviewed commits and verify CI. Apply only tested additive migrations with a rollback path. Keep incomplete offline capability disabled and do not deploy it as production-ready. Report web/API/Android/iOS readiness and deployed versions separately; update relevant issues using actual evidence.

Full offline work with later synchronization remains required scope. Local drafts, operational evidence and eligible submission intentions must survive process termination. Distinguish saved-on-device from accepted-by-server. Required verification cannot be bypassed; final approval/release requires fresh online authority. Never silently overwrite scientific values, create duplicate intakes on retry, erase unsent records or leak another user's queue.

## Material to use

- `README.md` and `IMPLEMENTATION_PLAN.md`
- `SCREEN_SPECIFICATIONS.md` and `ROUTE_COVERAGE.md`
- `OFFLINE_SYNC_CONTRACT.md`
- `AUDIT_FINDINGS.md` and `source-audit.json` (historical baseline, not proof the current version is unchanged)
- `ACCEPTANCE_TESTS.md` and `RESEARCH.md`
- `ANTIGRAVITY_PROMPT.md`
- `review-preview.html`, `mobile-lab.fragment.html` and `mockup-*.png`
- `prototype-qa.json` (26 prototype checks and 54 layout cases; these do not test real persistence, devices or backend correctness)

The preview is illustrative and contains in-memory demonstration state. Do not copy its store, demo scientific checks, fake role switch, sync simulation or approval simulation into the product.

Keep progress messages friendly and simple: what improved for lab staff, what you checked, what remains. Explain any necessary shared desktop/server touch before doing it, without seeking repeated approval for work already authorized. Distinguish implementation, verification, GitHub push and actual deployment. Return clear evidence and remaining limitations; never claim universal mobile readiness or zero defects from screenshots alone.

The full package is already on this computer at C:\Users\yigin\Documents\soilfer-lims\WP\mobile-lab-redesign-v1. Start by reading IMPLEMENT_NOW.md there, then every document and visual reference listed above. The project root remains C:\Users\yigin\Documents\soilfer-lims. Please confirm that folder and desktop-preservation boundary, then begin implementation.
