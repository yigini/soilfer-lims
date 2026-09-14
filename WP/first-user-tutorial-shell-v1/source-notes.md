# Current source and integration notes

Read-only review on 14 September 2026, baseline HEAD `10f8e08`; the working tree also contains concurrent Antigravity edits to Workbench/ManagerQueue and its browser tests. This package is not an acceptance audit of those changes. Inspect the exact current files again before implementation.

| Area | Source | Integration consequence |
| --- | --- | --- |
| Routes | `client/src/App.jsx` around 343–403 | Mount outside Routes. Existing `/login`, `/workbench`, `/manager-queue`, `/reception`, sample/map, equipment/inventory, project, reports/help routes should be reused. |
| Providers | `client/src/main.jsx` around 241 | Router, theme, language, auth already surround App; no new provider rearrangement. |
| Auth | `client/src/context/AuthContext.jsx` around 60, 73, 125, 198 | Cached initial user, asynchronous validation, no ready flag. Module-local verified identity required. Logout preserves unrelated session keys; don't touch token storage. |
| Login | `client/src/pages/Login.jsx` around 46 | Normal login goes to `/`; a mounted guide resumes its own navigation afterward. |
| Forced password change | `client/src/App.jsx` around 305 | Existing activation/password flow takes precedence. |
| Languages | `client/src/lib/localeResolver.js`; `LanguageContext.jsx` around 136 | en/es/es-419/fr/pt. Existing changeLanguage persists settings; guide-local language avoids changing profile/local preference. |
| Offline sync | `client/src/context/SyncContext.jsx` around 73 | Existing app outbox may synchronize on reconnect. The tutorial is not a global write blocker. |
| Workbench | `client/src/pages/TechWorkbench.jsx`; `components/workbench/WorkbenchShell.jsx` | Supported parameters include analysis/method, methodologyId, revision, sampleId/sample, workItemId, runId/batchId, queue. Use exact work-item IDs. Editing can autosave. |
| Procedure evidence | `components/workbench/OperationalTaskEditor.jsx`; `server/data/operationalChecklists.json` | Checklist Confirm Complete / saved receipt / legacy evidence-gap states. Learn configured SOP, do not hard-code universal laboratory conditions. |
| Result submission | `components/workbench/ReviewCompletionView.jsx` and submission view | Existing record/submit contract is being corrected concurrently. Do not teach a mock success as verified application behavior. |
| Spectra | Workbench spectral intake components | “Stage & Inspect Scans” posts staging data. Local practice only; no live server preview in no-write exercises. |
| Project | `client/src/pages/ProjectWorkspace.jsx` | `tab=overview|samples|plan|team|connections|activity`, stage/q/page/limit. Reuse existing scope. |
| Reception | `client/src/pages/Reception.jsx` around 353 | `sampleId` or `id` binding; lookup code/originalId. Existing receivedMass data-field-key is a candidate anchor. |
| Manager | `client/src/pages/ManagerQueue.jsx` | Lanes intake/assign/review/approve; use lane explicitly. Do not assume sampleId filters this queue. |
| Workflow | SampleWorkflowMap components | Some map links emit room/sampleId query keys that destination consumers don't use. The tutorial needs its own verified route registry, not blind replay of such links. |
| Report | `client/src/pages/ResultReports.jsx` and SampleDetail reports/history tabs | `reportId` opens a specific report; do not generate a new report for the tutorial. |
| Equipment/inventory | Equipment and Inventory pages | Search + drawers. No confirmed item deep-link receiver; avoid invented `?assetId=` or `?lotId=` navigation. |
| Admin/SIS | AdminPanel API keys tab | `/admin?tab=api-keys` is supported now; older packet's missing-query warning is stale. Live API tester is not a local practice tool. |
| Deployment | Dockerfile, `server/app.js` around 944 | Normal client dist build + SPA fallback. An arbitrary asset path returning 200 can still be HTML; validate content type/body. No tutorial-specific service worker needed. |

No established `data-tour` anchor contract was found. Accessible labels can guide implementation discovery, but production selectors should not depend on changing translations, icons or CSS utilities.

Public deployed login check found ordinary application HTML booting `/assets/index-CjrEn-Xr.js`; the entry bundle did not include tutorialmode/director-3m/tutorial-loader markers. This supports absence of a current runtime loader, but does not prove all separately hosted historical demo files are gone. Inventory before replacing any legacy tour. `tour=director-3m` must not accidentally map to the new first-visit state.

Keep known product limitations distinct from tutorial issues. Report 44 in the project-management packet records incomplete browser acceptance; no renewed full-app audit was performed here. In current source, a sample review QC fallback can render absent qcStatus as PASS; the guide must not interpret that as observed QC evidence. Keep physical-device and data-reconciliation claims qualified. Do not patch these application issues inside the tutorial PR to make a demo appear successful.

External design references (accessed 14 September 2026):

- https://www.nngroup.com/articles/onboarding-tutorials/ — task-contextual, optional learning rather than a long mandatory feature tour.
- https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/ — modal focus, Escape, restoration and semantic constraints.
- https://developer.mozilla.org/en-US/docs/Web/API/Web_components/Using_shadow_DOM — scoped DOM/style boundary, not a data-security boundary.
