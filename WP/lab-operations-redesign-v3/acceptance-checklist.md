# Acceptance scenarios

Status: **specified, not executed**. Each case needs a fixture, actual result, test/run reference and implementation commit. Use isolated data; never use S004 or other real samples for destructive testing. Read-only utility probes supplied separately are evidence of the old defects, not passing implementation acceptance.

## Preparation and readiness

- [ ] A01 — DRYING without an Analysis catalogue row still renders the typed operational editor; no scalar-result fallback or Paste Values.
- [ ] A02 — PREPARATION uses its own procedure schema and required evidence.
- [ ] A03 — Unknown task kind disables entry with a useful configuration action.
- [ ] A04 — Drying start records start evidence without requiring end evidence; finish requires all specified fields.
- [ ] A05 — Missing checklist is rejected; no `[true]` default. Wrong schema revision is rejected.
- [ ] A06 — Checklist-only and texture-only drafts survive save/reload without a scalar value.
- [ ] A07 — Before required drying/prep, numeric/texture/spectrum entry and paste are blocked in UI and direct API calls.
- [ ] A08 — Allowed planning notes remain editable without starting an analytical attempt.
- [ ] A09 — Successful preparation completion unlocks only dependent eligible material/tasks across workbench, sample and dashboard.
- [ ] A10 — Hold, failed preparation, rejected intake and canceled orders block appropriate commands, including draft values.
- [ ] A11 — Fresh-soil, intact-core and alternate-matrix fixtures follow explicitly configured procedures; no universal oven/milling steps.
- [ ] A12 — Completing a preparation batch with one exception leaves that sample blocked and records each outcome.
- [ ] A13 — Preparation invalidation after analysis flags affected attempts and release eligibility; it does not erase old evidence.
- [ ] A14 — Conflicting material/order revisions changed after preview cause commit conflict.
- [ ] A15 — Duplicate start/finish requests return the original receipt with no duplicate evidence/events.

## Drafts and safe entry

- [ ] A16 — Missing, zero, negative, malformed, comma-decimal and censored input have distinct outcomes; no blank-to-zero conversion.
- [ ] A17 — Row save failure inside HTTP 200 cannot produce a global saved badge.
- [ ] A18 — A skipped payload is not acknowledged as saved.
- [ ] A19 — Multiple in-flight row saves finish out of order without falsely declaring unsaved rows saved.
- [ ] A20 — Server refresh does not overwrite dirty input, focus, row order or selection.
- [ ] A21 — Switching method/sample while a request is pending cannot show the previous response in the new context.
- [ ] A22 — Network disconnect and page navigation accurately state whether drafts are durable; reload does not silently lose claimed saved data.
- [ ] A23 — Record waits for or explicitly resolves pending saves; newer values win through versioned commands, never stale closures.
- [ ] A24 — Reassignment denies old technician edits and resolves draft ownership visibly.
- [ ] A25 — Locked/submitted/approved attempts cannot be reopened through draft, conflict resolution, quick-edit or legacy routes.

## Batches and practical throughput

- [ ] A26 — Ready-method list correctly groups 40 compatible samples and separates four blocked samples.
- [ ] A27 — Different pH extractants, ratios, procedure revisions, matrices and labs cannot enter the same incompatible run.
- [ ] A28 — 40 sample positions plus configured QC positions fit the run rules; QC does not silently replace sample membership.
- [ ] A29 — Stable rack positions survive sorting/filtering; labels and barcode scans identify the intended aliquot.
- [ ] A30 — Duplicate barcode, unknown sample and insufficient material return clear exceptions.
- [ ] A31 — Adding cross-lab, unassigned, canceled, sealed or incompatible work to a batch is denied server-side.
- [ ] A32 — Moving/removing members from a started run follows a controlled rule and preserves history.
- [ ] A33 — Paste preview maps by sample ID and named columns; ambiguous/missing/duplicate identifiers cannot be silently applied.
- [ ] A34 — Enter advances correctly across scalar and texture columns; native Tab and screen-reader labels work.
- [ ] A35 — Selecting another method clears or explicitly scopes selections; hidden rows are never silently submitted.
- [ ] A36 — Large backlog fixtures of 200 and 1,000 tasks retain complete aggregates and responsive paginated queues.
- [ ] A37 — Partial batch record returns per-row receipts and retains failed rows for correction; retry does not duplicate successful results.
- [ ] A38 — Batch selection is explicit in the submission preview; unrelated completed samples are excluded.
- [ ] A39 — Required QC missing/open/failed blocks handoff according to the procedure; absent batch is not automatic permission.
- [ ] A40 — QC schema requires the correct controls and counts; an empty or partial QC payload cannot pass a required plan.
- [ ] A41 — Recorded measurements remain available for investigation after QC failure; they cannot be released accidentally.
- [ ] A42 — QC review/disposition requires correct authority, reason, scope and immutable evaluated version.
- [ ] A43 — Instrument calibration/qualification expires or instrument fails between planning and start; revalidation blocks new execution and preserves evidence.

## Texture and derived results

- [ ] A44 — Selecting the texture orderable once creates one task with three fraction outputs and a derived class, not three unrelated assignments.
- [ ] A45 — Bundle plus individual selection deduplicates orderables without deleting existing history or creating duplicate task outputs.
- [ ] A46 — Three valid fractions save, reload, record and submit together as one immutable result-set version.
- [ ] A47 — Direct commit applies the same validation as preview; it cannot complete texture with missing fractions.
- [ ] A48 — 50/35/15 returns Loam; 20/50/30 returns Silty clay loam; 45/20/35 returns Clay loam under recorded USDA scheme.
- [ ] A49 — Independently sourced fixtures cover all 12 texture classes, vertices, boundaries and just-either-side cases.
- [ ] A50 — Negative, >100, nonfinite, blank, malformed and censored fraction fixtures produce no valid class.
- [ ] A51 — Closure/rounding policy distinguishes 100% composition from recovery QC; failing totals are not silently normalized.
- [ ] A52 — Permitted by-difference output is labeled calculated with inputs/formula; no negative remainder is accepted.
- [ ] A53 — Replicate 1 sand cannot combine with replicate 2 clay or another method/basis/aliquot to make a class.
- [ ] A54 — Simulated failure creating derived class rolls back the whole required result-set command; no stale valid class remains.
- [ ] A55 — Correcting a fraction invalidates dependent class/review eligibility and creates versioned recalculation.
- [ ] A56 — Sample results, Data Results, exports and report all show the same three fractions, class, scheme and state.
- [ ] A57 — Approved report amendment preserves prior values/class and released report while creating a new reviewable version.
- [ ] A58 — Coarse fragments remain outside fine-earth sand+silt+clay closure.
- [ ] A59 — Spectral prediction, field estimate and measured PSD remain distinguishable and cannot silently satisfy each other's orders.

## Catalogue and other methods

- [ ] A60 — Every active production analysis/method has a reviewed task kind, procedure revision, material profile, output schema and report behavior.
- [ ] A61 — Catalogue seed/live comparison accounts for all aliases, duplicates, local overrides, disabled records and active orders.
- [ ] A62 — Placeholder SPEC_PARAM records cannot create new unconfigured laboratory tasks after controlled migration; history remains accessible.
- [ ] A63 — New catalogue edits are versioned; existing attempts retain the method, units and QC settings they used.
- [ ] A64 — A shared extraction/instrument suite creates traceable individual analytes with explicit ordered output scope.
- [ ] A65 — C:N, base saturation, ESP, ECEC and other calculations require compatible typed input versions and units; missing values are not zero.
- [ ] A66 — SAR does not accept exchangeable soil cations in place of the defined solution inputs; charge units are correctly converted.
- [ ] A67 — SOC-to-SOM estimates preserve factor/method/provenance and do not overwrite measured SOM.
- [ ] A68 — Mineral-N calculations distinguish element/ion basis and preserve material preparation requirements.
- [ ] A69 — EC/ECe and P extraction variants remain distinct in ordering, batching, results and reports.
- [ ] A70 — Density/moisture/water-retention calculations reject incompatible bases and unknown required inputs.
- [ ] A71 — Munsell, granulometry and biological/structured assays receive the correct schema, never a generic numeric fallback.
- [ ] A72 — MIR/Vis-NIR and configured XRF/GRS paths require appropriate acquisition evidence and explicit import profiles.
- [ ] A73 — Dependency cycles and incompatible output/input schemas are rejected before publishing a catalogue revision.

## Dashboards, routes and role boundaries

- [ ] A74 — Bare manager queue with empty intake and one review opens the review lane.
- [ ] A75 — Dashboard review/assignment/approval/intake cards open their exact lane with matching filters and scoped counts.
- [ ] A76 — Explicit deep links and intentional selections are preserved; refresh does not jump tabs during work.
- [ ] A77 — Counts match complete server populations beyond 20 submissions, 200 technician tasks and 500 lab tasks.
- [ ] A78 — NOT_ASSIGNED is counted consistently; completed/accepted progress uses consistent units excluding non-analysis gates.
- [ ] A79 — Review/approval eligibility filtering occurs before pagination; page totals and badges match.
- [ ] A80 — Manager dashboard counts, previews, audit entries and destinations expose no unauthorized lab/project data.
- [ ] A81 — LAB_TECHNICIAN starts at actionable assigned batches/methods; blocked and returned work are clearly separated.
- [ ] A82 — SAMPLE_RECEPTION uses actual arrivals/receipt times and discrepancies; expected/rejected material does not inflate pending operations.
- [ ] A83 — MASTER_USER sees explicitly authorized national/lab scope and escalation actions only.
- [ ] A84 — PROJECT_MANAGER sees only assigned projects and authorized deliverable/report states.
- [ ] A85 — AUDIT_USER has a working read-only QC/audit view; inspection is not permission to modify or approve.
- [ ] A86 — EXTERNAL_VIEWER and VIEWER see only authorized shared stages/results, with no draft/edit capability leaks.
- [ ] A87 — SURVEYOR has a field-handoff view and no lab result-entry shortcuts.
- [ ] A88 — SUPER_ADMIN clearly selects global/lab context; legacy COUNTRY_ADMIN accounts are mapped deliberately.
- [ ] A89 — Role-specific cards and all direct mutation APIs enforce capability AND entity scope; failed access causes no writes.
- [ ] A90 — `/my-work`, sample entry, quick edit, workbench, imports and scan routes share canonical eligibility and command services.
- [ ] A91 — Receipt/order/assignment/prep/result/submission/QC/review/report/amendment changes refresh all affected counts and views.
- [ ] A92 — API error/stale response is not shown as an empty successful queue; scope changes cancel/ignore old requests.
- [ ] A93 — Lab-local today/overdue counts remain correct across timezone boundaries and daylight-saving transitions.

## Migration, reports and release

- [ ] A94 — Unstarted legacy texture tasks consolidate without duplicate orders or lost audit links.
- [ ] A95 — Partial/approved legacy fractions are reconciled explicitly; ambiguous attempts are not auto-merged.
- [ ] A96 — Existing premature drafts are flagged/quarantined without fabricating preparation or deleting authorship.
- [ ] A97 — Old wrong texture classes are identified by impact report; released reports change only through amendments.
- [ ] A98 — Database/file backup restore and migration rollback are exercised on a copy, preserving spectra and released snapshots.
- [ ] A99 — Required authorization/workflow/spectral/report regressions, 40-sample operator UAT, keyboard/accessibility and 360/736/1024px layouts pass.
- [ ] A100 — Production deployed commit/migration version are recorded; read-only smoke verifies navigation/counts and configured methods. Remaining hardware/SOP checks are explicitly marked unverified.
