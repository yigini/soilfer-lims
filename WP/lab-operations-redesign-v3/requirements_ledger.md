# Laboratory Operations Redesign v3 — Requirements & Acceptance Ledger

| Case | Category | Requirement Summary | Status | Implementation & Evidence Reference |
|---|---|---|---|---|
| A01 | Preparation | DRYING renders typed operational editor, no scalar fallback | ALREADY PRESENT | `WorksheetArea.jsx`, `OperationalTaskEditor.jsx`, `catalogue_work_execution.test.js` |
| A02 | Preparation | PREPARATION uses own procedure schema and required evidence | ALREADY PRESENT | `workbenchValidationService.js`, `operationalChecklists.json` |
| A03 | Preparation | Unknown task kind disables entry with configuration action | ALREADY PRESENT | `WorkbenchInspector.jsx`, `WorksheetArea.jsx` |
| A04 | Preparation | Drying start records start evidence without requiring end evidence | VERIFIED | `receptionController.js`, `sampleController.js` |
| A05 | Preparation | Missing checklist rejected; wrong schema revision rejected | ALREADY PRESENT | `workbenchController.js:403`, `workbenchValidationService.js` |
| A06 | Preparation | Checklist-only and texture-only drafts survive save/reload without scalar | VERIFIED | `draftService.js`, `WorksheetArea.jsx` |
| A07 | Preparation | Before required drying/prep, numeric/texture/spectrum entry/paste blocked | VERIFIED | `workbenchReadinessService.js`, `reception_regression_stage_f.test.js` |
| A08 | Preparation | Planning notes editable without starting analytical attempt | ALREADY PRESENT | `draftService.saveDraft` notes field |
| A09 | Preparation | Preparation completion unlocks only dependent eligible material/tasks | VERIFIED | `reception_regression_stage_f.test.js` |
| A10 | Preparation | Hold, failed prep, rejected intake, canceled orders block commands | VERIFIED | `workbenchReadinessService.js`, `workbenchController.js` |
| A11 | Preparation | Fresh-soil, intact-core follow configured procedures | CONFIGURABLE | Lab method eligibility rules |
| A12 | Preparation | Partial prep batch leaves incomplete samples blocked | VERIFIED | `workbenchController.js` |
| A13 | Preparation | Preparation invalidation flags affected attempts | ALREADY PRESENT | Sample workspace v2 amendment model |
| A14 | Preparation | Conflicting material/order revisions cause commit conflict | VERIFIED | Optimistic locking on item.version |
| A15 | Preparation | Duplicate start/finish requests return original receipt | VERIFIED | Idempotent transition handlers |
| A16 | Drafts | Missing, zero, negative, malformed, censored input distinct | VERIFIED | `soilCalculations.js`, `texture_boundary_verification.test.js` |
| A17 | Drafts | Row save failure inside HTTP 200 cannot produce global saved badge | VERIFIED | `WorksheetArea.jsx` per-row receipt handling |
| A18 | Drafts | Skipped payload not acknowledged as saved | VERIFIED | `workbenchController.js` row status mapping |
| A19 | Drafts | In-flight row saves finish out of order safely | VERIFIED | `WorksheetArea.jsx` row id request tagging |
| A20 | Drafts | Server refresh does not overwrite dirty input | ALREADY PRESENT | `WorksheetArea.jsx` dirty row tracking |
| A21 | Drafts | Switching method/sample cancels pending display update | ALREADY PRESENT | Request ID tagging |
| A22 | Drafts | Disconnect & navigation states accurate for drafts | ALREADY PRESENT | `useRealtimeData.js`, `DraftIndicator.jsx` |
| A23 | Drafts | Record waits for or explicitly resolves pending saves | VERIFIED | `draftService.js`, `workbenchController.js` |
| A24 | Drafts | Reassignment denies old technician edits | VERIFIED | `draftService.js:40-44` |
| A25 | Drafts | Locked/submitted/approved attempts cannot be reopened | VERIFIED | `workbenchController.js:375-379` |
| A26 | Batches | Ready-method list groups compatible samples, separates blocked | VERIFIED | `workbenchController.getQueue` |
| A27 | Batches | Different extractants, ratios, procedures cannot enter same run | VERIFIED | `qcController.js` addItemsToBatch validation |
| A28 | Batches | Run profile capacities (40 rack, 96 microplate, 24 centrifuge) plus QC slots enforced | VERIFIED | `qcController.js:RUN_PROFILES`, `resolveRunProfile`, `qc_batch_evaluation.test.js` |
| A29 | Batches | Stable rack positions (1..capacity) survive sorting/filtering | VERIFIED | `qcController.js:addItemsToBatch` (assigns rackPosition), `WorksheetArea.jsx` (stable rackPosition numeric sorting), `qc_batch_evaluation.test.js` |
| A30 | Batches | Duplicate barcode / unknown sample returns clear exception | VERIFIED | `sampleController.js` |
| A31 | Batches | Cross-lab, unassigned, sealed work denied server-side | VERIFIED | `scopeGuard.canAccessEntity`, `qc_batch_evaluation.test.js` |
| A32 | Batches | Moving/removing members from started run preserves history | ALREADY PRESENT | `Batch.history` audit trail |
| A33 | Batches | Paste preview maps by sample ID and named columns | ALREADY PRESENT | `PasteModal.jsx` |
| A34 | Batches | Enter advances correctly; native Tab and labels work | ALREADY PRESENT | `WorksheetArea.jsx` keyboard handlers |
| A35 | Batches | Selecting another method clears or explicitly scopes selections | ALREADY PRESENT | `WorksheetArea.jsx` selection state |
| A36 | Batches | Large backlog fixtures retain complete aggregates | VERIFIED | `app.js` live dashboard uncapped `count()` queries |
| A37 | Batches | Partial batch record returns per-row receipts, retains failed rows | VERIFIED | `workbenchController.js` batch record receipts |
| A38 | Batches | Batch selection explicit in submission preview | VERIFIED | `previewSubmissions` in `workbenchController.js` |
| A39 | Batches | Required QC missing/open/failed blocks handoff | VERIFIED | `qcService.js` disposition checks, `qc_disposition_flagging.test.js` |
| A40 | Batches | QC schema requires correct controls and counts | VERIFIED | `qcController.js`, `qc_controls.test.js` |
| A41 | Batches | Recorded measurements preserved after QC failure | VERIFIED | `qcService.flagBatchResults` |
| A42 | Batches | QC review/disposition requires correct authority | VERIFIED | `qcController.dispositionBatch` |
| A43 | Batches | Expired instrument calibration blocks execution | VERIFIED | `readinessService.evaluateItemReadiness` |
| A44 | Texture | Texture orderable creates one task with three fractions and class | VERIFIED | `workItemController.js`, `texture_work_item_atomic.test.js` |
| A45 | Texture | Bundle plus individual selection deduplicates orderables | VERIFIED | `receptionController.js` normalizeAnalysisCodes deduplication |
| A46 | Texture | Three fractions save, reload, record, submit together atomically | VERIFIED | `workbenchController.js`, `texture_work_item_atomic.test.js` |
| A47 | Texture | Direct commit applies same validation as preview | VERIFIED | `resultsController.js`, `texture_work_item_atomic.test.js` |
| A48 | Texture | 50/35/15 -> Loam; 20/50/30 -> Silty Clay Loam; 45/20/35 -> Clay Loam | VERIFIED | `soilCalculations.js`, `texture_boundary_verification.test.js` |
| A49 | Texture | Fixtures cover all 12 classes, vertices, boundaries, ties | VERIFIED | `texture_boundary_verification.test.js` (25/25 passed) |
| A50 | Texture | Negative, >100, nonfinite, blank fractions produce no valid class | VERIFIED | `texture_boundary_verification.test.js` |
| A51 | Texture | Configured closure policy; no silent normalization | VERIFIED | `soilCalculations.js`, `texture_boundary_verification.test.js` |
| A52 | Texture | By-difference output labeled DERIVED with formula | VERIFIED | `workbenchController.js:847`, `texture_work_item_atomic.test.js` |
| A53 | Texture | Fractions from different replicates/attempts cannot mix | VERIFIED | `workbenchController.js:833-875` atomic attempt linkage |
| A54 | Texture | Failure creating derived class rolls back result-set command | VERIFIED | `workbenchController.js` atomic $transaction rollback |
| A55 | Texture | Correcting fraction invalidates dependent class | VERIFIED | `resultsController.js` automatic recalculation / rollback |
| A56 | Texture | Sample results, Data Results, export, report show same 3 fractions & class | VERIFIED | `dataResultsController.js`, `reportAssembly.js` |
| A57 | Texture | Approved report amendment preserves prior values | ALREADY PRESENT | Sample workspace v2 amendment episodes |
| A58 | Texture | Coarse fragments remain outside fine-earth closure | ALREADY PRESENT | Separately reported analyte |
| A59 | Texture | Spectral prediction and measured PSD remain distinguishable | VERIFIED | `golden_path.test.js` Scenario E |
| A60 | Catalogue | Active analyses have reviewed kinds and schemas | ALREADY PRESENT | `catalogue.json` |
| A61 | Catalogue | Seed/live comparison accounts for aliases and overrides | VERIFIED | `migrate_lab_operations_v3.js`, `reception_package_resolution.test.js` |
| A62 | Catalogue | Placeholder SPEC_PARAM records quarantined from new orders | VERIFIED | `migrate_lab_operations_v3.js`, `cataloguePolicy.js` |
| A63 | Catalogue | New catalogue edits versioned | VERIFIED | Added `version Int? @default(1)` to `Analysis` and `Methodology` in `schema.prisma`; regenerated Prisma client; auto-increments version on updates with before/after audit tracking in `analysisController.js`. |
| A64 | Catalogue | Shared extraction/instrument suite creates traceable analytes | ALREADY PRESENT | Multi-element extractions |
| A65 | Catalogue | C:N, base saturation, ESP, ECEC require compatible inputs | ALREADY PRESENT | `soilCalculations.js` |
| A66 | Catalogue | SAR rejects exchangeable soil cations | ALREADY PRESENT | `soilCalculations.js` |
| A67 | Catalogue | SOC-to-SOM estimates preserve provenance | ALREADY PRESENT | `interpretationService.js` |
| A68 | Catalogue | Mineral-N distinguishes element/ion basis | ALREADY PRESENT | Parameter definitions |
| A69 | Catalogue | EC/ECe and P variants remain distinct | ALREADY PRESENT | Method definitions |
| A70 | Catalogue | Density/moisture calculations reject incompatible bases | ALREADY PRESENT | `soilCalculations.js` |
| A71 | Catalogue | Munsell, granulometry, biological receive correct schema | ALREADY PRESENT | Editor kinds |
| A72 | Catalogue | MIR/Vis-NIR require acquisition evidence & import profiles | VERIFIED | `workbenchValidationService.js`, `golden_path.test.js` Scenario E |
| A73 | Catalogue | Dependency cycles rejected | ALREADY PRESENT | Calculation graph |
| A74 | Dashboards | Bare manager queue with empty intake & review opens review lane | VERIFIED | `ManagerQueue.jsx` lane prioritization |
| A75 | Dashboards | Dashboard cards open exact lane with matching filters | VERIFIED | `ManagerDashboard.jsx` deep links (?lane=intake, ?lane=assign, ?lane=review) |
| A76 | Dashboards | Explicit deep links & intentional selections preserved | VERIFIED | `ManagerQueue.jsx` useSearchParams sync |
| A77 | Dashboards | Counts match complete server populations beyond 20/200/500 | VERIFIED | `app.js` uncapped `prisma.submission.count({ where: subWhere })` |
| A78 | Dashboards | NOT_ASSIGNED counted consistently; progress excludes non-analysis | VERIFIED | `app.js` unassignedTasks includes NOT_ASSIGNED & PENDING without assignedTo |
| A79 | Dashboards | Review/approval eligibility filtering before pagination | VERIFIED | `app.js` and `ManagerQueue.jsx` |
| A80 | Dashboards | Manager dashboard exposes no unauthorized lab/project data | VERIFIED | `app.js` subWhere includes `user.labId` scoping |
| A81 | Dashboards | LAB_TECHNICIAN starts at actionable assigned batches/methods | ALREADY PRESENT | `workbenchController.getQueue` |
| A82 | Dashboards | SAMPLE_RECEPTION uses actual arrivals | ALREADY PRESENT | Reception queue |
| A83 | Dashboards | MASTER_USER sees authorized national/lab scope | ALREADY PRESENT | `scopeGuard.js` |
| A84 | Dashboards | PROJECT_MANAGER sees assigned projects | ALREADY PRESENT | `scopeGuard.js` |
| A85 | Dashboards | AUDIT_USER has read-only QC/audit view | ALREADY PRESENT | Role permissions |
| A86 | Dashboards | EXTERNAL_VIEWER and VIEWER see authorized stages only | ALREADY PRESENT | Role permissions |
| A87 | Dashboards | SURVEYOR has field handoff view, no lab result entry | ALREADY PRESENT | Role permissions |
| A88 | Dashboards | SUPER_ADMIN selects global/lab context | ALREADY PRESENT | Lab switcher |
| A89 | Dashboards | Direct mutation APIs enforce capability AND entity scope | VERIFIED | `qcController.js` (entity scope checks on getBatchById, updateBatch, evaluateBatch, dispositionBatch, addItemsToBatch, removeItemsFromBatch), `codex-progress-review-r3.cjs:Check 1` (returns 403) |
| A90 | Dashboards | All entry routes share canonical eligibility & command services | VERIFIED | `resultsController.js`, `workbenchController.js` |
| A91 | Dashboards | Changes refresh all affected counts and views | ALREADY PRESENT | WebSocket broadcasts |
| A92 | Dashboards | API error/stale response not shown as empty successful queue | ALREADY PRESENT | `ManagerQueue.jsx` error states |
| A93 | Dashboards | Lab-local today/overdue counts correct across timezones | VERIFIED | `app.js` ISO date normalization |
| A94 | Migration | Unstarted legacy texture tasks consolidate without duplicate orders | VERIFIED | `migrate_lab_operations_v3.js:STEP 5` (requires all 3 fractions or confirmed grouped order; standalone fractions preserved untouched with assignment/status intact), `codex-progress-review-r3.cjs:Check 4` (observed SAND ASSIGNED preserved), `migration_lab_operations_v3.test.js:Test 10` |
| A95 | Migration | Partial/approved legacy fractions reconciled explicitly | VERIFIED | `migrate_lab_operations_v3.js:STEP 6` (strictly requires identical sampleId + replicateNo + basis + all 3 fractions within closure tolerance; disparate fractions left unresolved), `codex-progress-review-r3.cjs:Check 3` (attempts: []), `migration_lab_operations_v3.test.js:Test 11` |
| A96 | Migration | Existing premature drafts flagged without fabricating preparation | VERIFIED | `migrate_lab_operations_v3.js:STEP 7` (preserves checks array intact; stores `[WARNING: PREPARATION_PENDING]` in durable notes; zero preparation records fabricated), `migration_lab_operations_v3.test.js:Test 8` |
| A97 | Migration | Old wrong texture classes identified by impact report | VERIFIED | `migrate_lab_operations_v3.js:STEP 8` (audits siblings matching identical replicate and basis; ignores disparate fractions; creates SampleAmendment audit records), `migration_lab_operations_v3.test.js:Test 9` |
| A98 | Migration | DB/file backup restore & rollback exercised on copy | VERIFIED | `WP/lab-operations-redesign-v3/restore-rehearsal-evidence.md`: Full consistent SQLite snapshot + gzip (19.91 MB) + 654 asset files restored to isolated scratch directory; integrity verified (`quick_check: ok`, 52 tables, 35,192 samples); migration dry-run and apply verified idempotent; live volume untouched (SHA-256 verified). |
| A99 | Release | Full regressions, 40-sample UAT, responsive layouts pass | VERIFIED | `WP/lab-operations-redesign-v3/browser-uat-40-samples.json` & `.md`: All 16 on-screen browser acceptance gates PASSED cleanly (16/16) on headless Chrome (Puppeteer Core) covering RACK_40 capacity boundary (36+4 dual runs), responsive layout (375x667), method switching, decimal input, batch paste, range validation, draft reload, USDA texture & closure warning, two-step handoff, QC evaluation & 403 guard, manager queue review/approval, mandatory amendment reason modal, spectroscopy interface. |
| A100 | Release | Production deployed commit/image recorded in release receipt | VERIFIED | Deployed commit `8a3f41b` (PR #45 merged into `main`). Built immutable image `soilfer-lims:v3.0.0-8a3f41b` (`sha256:6ded9a94fc41456aad74a47012db10daa506249578b7c4855ffba72901d41725`). Pre-cutover coordinated backup saved to `/opt/lims/release_checkpoints/release_v3_8a3f41b_2026_09_06_14_1` (`dev.db` + `assets.tar.gz`). Migration `v3_lab_operations_20260906` applied at `2026-09-06 14:15:52` (zero mutations to 35,190 Samples, 2 Results, 0 Reports; 40 WorkItems, 208 active analyses, 181 default methodologies). Live container healthy on port 3000. Verified live endpoints (`/api/health`, `/api/public/i18n/bootstrap`, `/uploads/spectra/...`, `/api/config/analyses`, `/api/config/methodologies`, `/api/workbench/queue`, `/api/qc/batches`, `/api/samples`). |

