# Tutorial checkpoint 14 — responsive correction accepted

14 September2026, approximately16:39 Europe/Rome. `e78edf8641832e3cd23f60cd485bcbd08b12ea50` is pushed to main, CI34855783312 succeeded, and independent SSH confirms healthy `soilfer-lims:v3.5.8-e78edf8`. Exact public-asset/anonymous smoke evidence is being added in this checkpoint.

Update16:40: `independent-release-review14.json` confirms public/local index and all three entry/tutorial assets match, including index-CSyv44qJ.js SHA256ee74e1906f27509e782330e48b6508743b18c53622119ddcf171cce255d33828. `independent-live-review14.json` passes anonymous ordinary Login with no guide chunk, the explicit opt-in foundation, and clean Exit. Zero browser errors/non-read attempts. This is limited read-only anonymous live smoke, not authenticated laboratory workflow acceptance.

## Keep the completed fixes closed

`independent-responsive-review14.cjs/.json/.md` independently passes40/40 combinations:320×700,390×844,700×360 and1440×1000; Login and Workbench; en/es/es-419/fr/pt. Both expanded and collapsed controls fit, pointer hit tests and actual ordinary Pause/Resume/Minimize/Expand/Exit clicks work, and horizontal scrolling is not needed. The actual locale selector and translated Pause/expanded-Exit text were asserted. Selected narrow French/Portuguese screenshots were visually inspected. All APIs mocked; no app/backend/database/production writes. This closes review13's responsive defect. No broad unchanged tests or removal build are needed.

The earlier draft revision/no-loop and same-document pointer account handover remain accepted. Current application diff is confined to tutorial header markup and scoped CSS. No auth, Login, RBAC, core workflow or global appearance changes are requested.

Tested assets: TutorialShell-Dw7KOo2o.js SHA25699ba58ee761a7da5d549d96272f8f63a2d6f838d3dd50d2fea31fb9796f32c49; TutorialShell-BSpGr4x-.css SHA256d1a6cc7519e7a6cca274e74655bb7e82b6587d52b883d350f8bfb01c56bfa8ee; index SHA256b65439e30e00f2bbd385edddb86f451d378769440d51746cc48b9cad89753344. Source Shell SHA2569c5564913eefeaadcea5baef3a8c327b739b1a5e5ef89317e5ca0ab4af02bea5.

## One small tutorial-copy omission

The collapsed Exit button calls `t('common.exit', 'Exit')`, but `common.exit` is missing in all five dictionaries. It consequently stays English even with another actual locale selected. Add this short key to the tutorial dictionaries (en Exit; es/es-419 Salir; fr Quitter; pt Sair), or an equivalent existing short translated label. Check the actual collapsed label and320px action row after the copy change. Preserve the40/40 layout acceptance; no repeat of the full matrix, auth/draft suites, removal build or database audits is warranted for five dictionary entries.

Then finish the focused GitHub/CI/safe release and final delivery note under existing authorization. Record exact final revision, tutorial entry URL, changed-file inventory, tested boundaries, and precise disable/removal steps. Human novice, scientific-language and physical-device acceptance remains explicitly pending; do not claim human review or literal zero defects. A successful local build plus live health alone is not exact deployment proof.

This review supersedes the older checkpoint13 correction request still queued in LIMS Dev; do not redo the already accepted layout work.

The separate original operational work remains recorded in `WP/project-management-audit-v1/46-independent-status-follow-up.md`. Keep that workstream and its future commits separate from tutorial delivery. Its existing UI-closure/evidence/report gaps are not fixed by the overlay; human/policy issues102/103 and reported104–106 retain their stated limits. Do not guess lab-owner mappings or automate physical receipt on the basis of policy issue105.
