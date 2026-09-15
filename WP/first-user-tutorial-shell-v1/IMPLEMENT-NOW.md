# Superseded — tutorial removal authorized, 15 September 2026

The user rejected the deployed tutorial and requested: “i did not like it can we rollback and remove the tutorial mode”. This replaces the implementation authorization below. Antigravity has been instructed in LIMSI / LIMS Dev to remove the tutorial in a focused forward commit and safely push/deploy it, preserving all unrelated LIMS improvements, Help Centre, records, permissions and drafts. The tutorial implementation monitor is paused. Retain this package as historical evidence, not an instruction to restore or continue implementing the guide.

Remove the dedicated tutorial runtime and mount, tutorial-only anchors and enable configuration. Use the existing retirement mechanism for cached clients; old tutorial links must open the ordinary app. No whole-site historical rollback, database restore/migration or production test writes. Verify normal login, Help, mocked authenticated Workbench, old tutorial URLs, targeted cached-guide retirement, build/CI and the exact production release. Implementation and deployment are pending until evidenced; sending the handoff is not proof of removal.

# Historical approved implementation and monitored delivery

14 September 2026. The user reviewed the preview, clarified that visitors may know only the name LIMS, approved the revised beginner foundation, and instructed: “send this to antigravity and set timer for every 15 mins to checkin and see the progress and to ensure that all implemented propoerly.. all should be subtle without changing much in the codebase”.

This is the current authorization for this package. It supersedes earlier draft-only / awaiting-implementation wording in this directory. Proceed with the approved implementation. The user's earlier authorization for safe GitHub push/PR/merge and deployment continues to apply after relevant checks pass; do not ask for the same permission again. Report actual deployment separately from local implementation.

Work in **C:\Users\yigin\Documents\soilfer-lims**, Antigravity **LIMSI / LIMS Dev**. Read ANTIGRAVITY-HANDOFF.md and the entire linked package, especially absolute-beginner-foundation.md. Implement the current beginner design, not the earlier director demo or a pasted static imitation of the app.

## Small, subtle and removable

- New dedicated `client/src/tutorial/` module, lazy-loaded only after explicit opt-in. Target one small App.jsx mount outside Routes, plus only essential inert `data-tour` anchors. Enumerate existing files touched and why.
- No permanent menu entry, default first-login popup or global styling. Calm docked guidance, modest highlighting, mobile compact sheet; ordinary desktop/mobile pages remain unchanged when the guide is absent.
- No business-rule, backend, schema, RBAC, authentication, offline-draft or connector changes for this guide. Do not bundle unrelated corrections into its commits. Preserve ongoing work and real records.
- Implement actual authorized page orientation plus separately labelled synthetic practice. Live workbench fields may autosave; spectral preview stages files. The guide must neither type into live inputs nor write laboratory data to practise.
- Normal account sign-in only. Never embed production passwords or tokens in public files, URLs or the repository. Beginner overview is illustrated and usable without an account; protected pages remain protected.
- Complete beginner foundation, all approved chapters/role paths, glossary and five locales. Follow T01–T24; do not substitute the standalone preview tests for actual integration acceptance.

If the smallest safe implementation needs wider changes than this, first describe the exact dependency and the narrower alternative. This is not a reason to halt ordinary authorized work or ask again about the already approved small mount/anchors. Do not inflate the architecture to avoid touching one existing file.

## Delivery and review

Codex will monitor every 15 minutes and send focused corrections when needed. Give short, friendly updates stating what works, what is being checked and what remains. Do not change your selected model or wait idly for check-ins.

Use the established GitHub/CI/deployment workflow, preserve rollback, verify the exact deployed build and tutorial URL and check normal pages read-only. No production fixtures or migrations should be needed. Report local, pushed, CI-passed and deployed states distinctly. Any required native-device, scientific-language or novice-user review that cannot be performed must be labelled pending; no invented sign-off. Fix technical issues independently and request actual human evidence only when necessary.

The previous project-management/operational acceptance work remains open according to its verified status. Latest pre-handoff HEAD was `bd8f443`; report 45 has new claims that require independent review. Do not regress its fixes or imply the tutorial proves those workflows correct. Keep their evidence and commits separate.
