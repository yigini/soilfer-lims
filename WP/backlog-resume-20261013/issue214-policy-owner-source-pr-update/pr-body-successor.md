Schema prerequisite correction accepted by Claudio in [6160619940](https://github.com/yigini/soilfer-lims/issues/214#issuecomment-6160619940) is included in this same PR. The original CI38467368095 attempt1 remains FAILED: server365/5547, client and both Docker builds/boundary passed; real readiness Scenario6 on PRE_199 refused `QC_CHART_PREREQUISITE_REQUIRED`. It was never retried.

The owner reuses ONLY unchanged canonical20261004085500 DDL, SHA256 fa6ef0563f80704dbc4ee08d90ceae91f632c912813ca037221b02aa03ef7b70, before214 in the default entrypoint and startup readiness. ABSENT creates empty LabPolicy/Override and canonical indexes, plus nullable Report.policyVersion only if absent. PRESENT exact canonical or Prisma-created equivalent is NO_OP0. Every partial table/index/column, wrong Report type, and source tamper refuses0; **no normalization**, policy data writes, presets, overrides, backfill, or missing-table catches. Read-only classification hashes/copies the original DB/WAL/SHM into a retained snapshot and opens only that copy, because ordinary SQLite readonly opens can create sidecars. Existing policy/override/report/history bytes stay unchanged. Actual policyService with empty tables resolves shipped Strict CONTROL_CHART and minimum20 without inserting rows. Scientific rules, prebinding and frozen history are unchanged.

New head `8d564c24f05a3b069bf027bbb7ba4f92cea597b0`, tree `89689295ae06c5ffac0e4c2535c149e55c090bc1`, base `6d750914d8565acdd496767a7dd935811b5a89b2`: full local **366/366 suites and5565/5565 tests PASS**, no failures/skips/pending/todo, all366 unique paths exactly match discovery and all421 frozen inputs unchanged. Focused8/8 suites218/218 tests PASS includes actual active-WAL refusal and exact row/sidecar preservation. Both ordinary setups/assertions and approved worker512MB/blank local NODE_OPTIONS remain. Local visible-assets and retention-only teardown fixtures preserve held evidence; standard real CI retains its unchanged hooks and uses neither fixture. The two earlier focused failures are retained honestly. A new automatic PR CI, all real Docker checks, and fresh exact-head Claudio audit PASS remain mandatory before merge.

The real Docker acceptance now asserts PRE_199 policy ABSENT/DRY0, the shipped default entrypoint reaching COMPLETE_214 in policy-before-chart order, empty policy tables and immediate module NO_OP0 with original DB/WAL/SHM equality. The eventual production kit must include a read-only policy dry run showing PRESENT/NO_OP0 (production carries219), account for its retained snapshot allocation, and STOP/report any other classification without apply. No production collection or operation occurred. Existing actual chart-context/prebinding impact counts remain required before the kit gate.

[Closed source-bound local originals and hashes](https://github.com/yigini/soilfer-lims/tree/6dbad1a14ccd29e137408af077d5803a8c94b956/WP/backlog-resume-20261013/issue214-policy-owner-full-pass).

Additional retained fixture/scanner lines are explicit; no scanner predicate or writer exemption was weakened:

```diff
diff --git a/server/tests/contracts/deployment_readiness_bootstrap.test.js b/server/tests/contracts/deployment_readiness_bootstrap.test.js
index 4c7e3911..7f90215e 100644
--- a/server/tests/contracts/deployment_readiness_bootstrap.test.js
+++ b/server/tests/contracts/deployment_readiness_bootstrap.test.js
@@ -368,6 +368,7 @@ bash "${entryScript.replace(/\\/g, '/')}"
             .toMatchObject({classification:'COMPLETE_205',backfilledCount:0});
         require('../../scripts/install_instrument_imports').installInstrumentImports({ dbPath: targetDb, apply: true });
         require('../../scripts/install_sample_containers').installSampleContainers({ dbPath: targetDb, apply: true });
+        require('../../scripts/install_lab_policy_schema').installLabPolicySchema({ dbPath: targetDb, apply: true });
         require('../../scripts/install_control_charts').installControlCharts({ dbPath: targetDb, apply: true });
         const hashDb = () => createHash('sha256').update(fs.readFileSync(targetDb)).digest('hex');
         const beforeSha = hashDb();
@@ -428,6 +429,8 @@ bash "${entryScript.replace(/\\/g, '/')}"
                 `node "${path.join(serverDir, 'scripts/install_sample_containers.js').replace(/\\/g, '/')}"`)
             .replaceAll('node scripts/install_control_charts.js',
                 `node "${path.join(serverDir, 'scripts/install_control_charts.js').replace(/\\/g, '/')}"`)
+            .replaceAll('node scripts/install_lab_policy_schema.js',
+                `node "${path.join(serverDir, 'scripts/install_lab_policy_schema.js').replace(/\\/g, '/')}"`)
             .replaceAll('node scripts/install_result_raw_input.js',
                 `node "${path.join(serverDir, 'scripts/install_result_raw_input.js').replace(/\\/g, '/')}"`)
             .replace(/node scripts\/migrate_[^\n]+/g, '# noop migration');
diff --git a/server/tests/helpers/workflowWriteScanner.js b/server/tests/helpers/workflowWriteScanner.js
index 372ea9ba..6e7c5398 100644
--- a/server/tests/helpers/workflowWriteScanner.js
+++ b/server/tests/helpers/workflowWriteScanner.js
@@ -31,6 +31,11 @@ const QC_MEMBERSHIP_LOADER_SHA256 = '40c0af827c4d22b6fce1ee5b770f2c0146f456cfeea
 const QC_MEMBERSHIP_SQL_SHA256 = '1bc85113a3b6b7da327265bc7005eb4a1c97855943c599b1fe5ed8b126cf8572';
 // #189 additive evidence sources are inspected, never exempted as writers.
 const QC_EVIDENCE_SOURCES = Object.freeze([
+    // Claudio6160619940: inspect the existing canonical policy DDL; no writer exemption.
+    Object.freeze({ functionName: 'loadLabPolicyMigrationSource', loader: 'services/labPolicyMigrationSource.js',
+        loaderSha256: 'ff0e4a69226b442e97f91b5e569ec4e5c129b6aaef65a0490722e1ba82037bc1',
+        directory: '20261004085500_add_lab_policy_settings', sqlSha256: 'fa6ef0563f80704dbc4ee08d90ceae91f632c912813ca037221b02aa03ef7b70',
+        boundary: 'ALTER TABLE "Report" ADD COLUMN "policyVersion" INTEGER;' }),
     // #214: inspect only the exact additive chart evidence/guard source.
     // This adds no workflow writer exemption.
     Object.freeze({ functionName: 'loadControlChartMigrationSource', loader: 'services/controlChartMigrationSource.js',

```

Adds #214 control charts with immutable run-time scientific inputs, deliberate limit proposals, second-person approval and separate QC review obligations.

**Operational change:** Strict laboratories, and any context resolving to `CONTROL_CHART`, must bind served LRM lots before starting new runs, including Provisional series. An unbound position returns `422 QC_CHART_LOT_REQUIRED` naming the position; the same run can start once bound. `FIXED_WINDOW` laboratories and genuinely pre-release already-started runs retain their existing path. A started chart run cannot change its frozen lot or reference value.

The implementation follows Claudio's actual [scientific direction](https://github.com/yigini/soilfer-lims/issues/214#issuecomment-6148143929), [lot-binding direction](https://github.com/yigini/soilfer-lims/issues/214#issuecomment-6152114918) and [retained-fixture direction](https://github.com/yigini/soilfer-lims/issues/214#issuecomment-6152507558). Series are scoped by lab, analyte, method and reference lot. New starts freeze approved or provisional basis, policy/rule classification, deterministic observation order and exact measurement/value/reference identities. Corrections replace effective observations for future starts; historical evaluations and proposals retain their original inputs. R-4s evaluates only within one run; sequence rules use the frozen eligible chronology across runs. Provisional evaluations retain the fixed window and record multi-rules as not evaluated.

Baseline proposals use the arithmetic mean and sample SD (n-1), the frozen `qc.controlChartMinPoints` registry/policy value (shipped default 20), eligible passing observations and explicit excluded IDs with reasons. There is no automatic outlier removal. A named eligible approver must differ from the proposer; superseded sets and old evaluations remain readable. Strict adds review actions for 4-1s/10x; other presets use an empty review set. Stored legacy overrides missing `review` are read as [] without rewriting rows. Review obligations are idempotent by immutable evaluation and rule, scoped by laboratory, and resolved through append-only noted outcomes; they do not alter verdicts, block release, or reuse CRM NCR/sample-closure tasks.

The additive installer creates four tables, binds its migration source by digest and refuses partial, populated-unmarked or tampered states. Tests verify DRY 0/APPLY 1/immediate NO_OP 0, unchanged old rows and policies, immutable evidence guards, approved-set supersession, startup readiness before jobs/listen and fresh-Prisma normalization. The historical regression actually starts a run using the byte-pinned released pre214 service, then installs 214 normally; it does not fabricate old criteria.

The read-only impact collector uses an explicit read-only SQLite connection and injected policy/rule evaluation, with no default Prisma connection or pragmas. It has been tested only against owned disposable data. Before any eventual deployment gate, the kit must retain the **actual** lab/analyte/method contexts resolving to CONTROL_CHART and created-but-unstarted runs with unbound served LRM positions, for Claudio's review and YY's impact visibility. No production collection or operation occurred in this PR preparation.

Historical validation before the policy-owner correction on source-only head `e47b842c2a7f6b4f06fa4c532f7460c01797821b` (tree `7269379790ada4e9766cae14e33abd3c91eb59fd`, base `6d750914d8565acdd496767a7dd935811b5a89b2`):
- Complete closed local server run: **Test Suites: 365 passed, 365 total** / **Tests:       5547 passed, 5547 total**, zero failed/skipped/pending. All 365 unique paths match the full discovery inventory; all 415 frozen source/fixture hashes stayed unchanged. Both ordinary database setups, stock assertions, single worker 512MB and blank local NODE_OPTIONS remained enabled. The retained local filesystem fixture serves byte-identical built assets and disposable uploads outside the hidden Windows checkout. Standard real PR CI must pass ordinary `npm test` without this fixture, then build the candidate and supported baseline 48d0e52 Docker images and run real disposable boundary/readiness acceptance.
- Corrected focused run: 14/14 suites and 293/293 tests pass, including all formerly failing suites and new chart/Strict-default contracts. Earlier failures and configuration refusals remain retained honestly and are never relabelled or replayed.
- Client production build and canonical lint pass: 0 errors and the same 14 baseline warnings. Actual detached Chromium inspections cover desktop 1440×1050 and mobile 390×844, plus keyboard lot selection/start, second-person approval and noted review resolution. These use the production components/CSS with injected owned synthetic API data. The first mobile overflow is retained; the corrected document 375px fits its 390px viewport.

[Closed originals, final summary, exact source/report hashes and browser evidence](https://github.com/yigini/soilfer-lims/tree/2cc71b2b11526c10f2a5a41ea307d3193feb32fa/WP/backlog-resume-20261013); `issue214-scanner-call-form-full-pass/index.json` indexes the complete local result. The approved Jest harness, existing CI heap, discovery and ordinary setup files remain enabled. No #214 final audit PASS is claimed; actual complete real CI and a new exact-head Claudio audit PASS are required before merge.

Retained fixture adjustments are explicit. The Native factory uses an ordinary FIXED_WINDOW override for its historical LRM assertions. `qcGateFixture` uses that context only for retained LRM cases; no-LRM cases keep their original policy version, and the new Strict/default test opts out of the override. The compatibility factory installs the normal 190/191/calculation/200/206/214 predecessors only for its Native current-schema case. Removing that conditional fixture context reproduces every original compatibility statement byte-for-byte. Original Native and compatibility assertions are unchanged. The compatibility Native fixture is the only newly registered caller of the existing digest-pinned owned-file calculation prerequisite helper. Its destructured import, immutable direct call and owned-file identifier satisfy the existing scanner predicates; no predicate or runtime writer exemption is relaxed. The prior complete full run remains FAILED (364/365 suites,5546/5547 tests,one scanner finding), and the first registration-only focused run remains FAILED (13/14 suites,292/293 tests). Both closed originals are retained in the evidence directory. The policy editor expectation additionally checks the new empty `review` field; startup tests add 214 readiness/preservation assertions. The exact changed fixture and retained-test lines are below, including global setup, historical schema-gap and scanner-source registration.

<details><summary>Every changed retained fixture/test line</summary>

```diff
diff --git a/server/tests/contracts/audit_1_0_policy_components.test.js b/server/tests/contracts/audit_1_0_policy_components.test.js
index cfb80f5c..2e19eee2 100644
--- a/server/tests/contracts/audit_1_0_policy_components.test.js
+++ b/server/tests/contracts/audit_1_0_policy_components.test.js
@@ -82,7 +82,7 @@ describe('Audit 1.0: real policy page controls', () => {
         const h = await fixture(), change = jest.fn();
         const tree = h.editor({ definition: registry['qc.westgardRules'], value: { reject: [], warn: ['1-2s'] }, t, onChange: change });
         elements(tree).find(node => node.type === 'input').props.onChange({ target: { checked: true } });
-        expect(change).toHaveBeenCalledWith({ reject: ['1-2s'], warn: [] });
+        expect(change).toHaveBeenCalledWith({ reject: ['1-2s'], warn: [], review: [] });
     });
     test('calibration action editor offers bracket repeats only for continuing checks and preserves other kinds', async () => {
         const h = await fixture(), change = jest.fn();
diff --git a/server/tests/contracts/audit_1_2_guard_installer.test.js b/server/tests/contracts/audit_1_2_guard_installer.test.js
index 4a82e4e7..6894eebc 100644
--- a/server/tests/contracts/audit_1_2_guard_installer.test.js
+++ b/server/tests/contracts/audit_1_2_guard_installer.test.js
@@ -440,6 +440,12 @@ test('a complete guarded database passes the read-only gate, listens and answers
     expect(fingerprint(fixture.file)).toBe(beforeContainers);
     expect(require('../../scripts/install_sample_containers').installSampleContainers({dbPath:fixture.file,apply:true}))
         .toMatchObject({classification:'COMPLETE_206',previousClassification:'FRESH_PRISMA_206',backfilledCount:0,totalChanges:1});
+    const beforeCharts=fingerprint(fixture.file), missingCharts=await realStartup(fixture.file,false);
+    expect(missingCharts.code).toBe(1); expect(JSON.parse(missingCharts.stderr).error).toBe('QC_CHART_STARTUP_REQUIRED');
+    expect(missingCharts.stdout).not.toMatch(/Enterprise Server running on|\[PRISMA\]|SCHEDULER/);
+    expect(fingerprint(fixture.file)).toBe(beforeCharts);
+    expect(require('../../scripts/install_control_charts').installControlCharts({dbPath:fixture.file,apply:true}))
+        .toMatchObject({classification:'COMPLETE_214',previousClassification:'FRESH_PRISMA_214',backfilledCount:0,totalChanges:1});
     const child = await realStartup(fixture.file, true);
     expect(child.accepted).toBe(true);
     const benchReady=JSON.parse(child.stdout.split('\n').find(line=>line.startsWith('{"event":"BENCH_CREDENTIAL_STARTUP_READY"')));
@@ -466,6 +472,9 @@ test('a complete guarded database passes the read-only gate, listens and answers
     const containersReady=JSON.parse(child.stdout.split('\n').find(line=>line.startsWith('{"event":"SAMPLE_CONTAINER_STARTUP_READY"')));
     expect(containersReady).toMatchObject({classification:'COMPLETE_206',totalChanges:0});
     expect(child.stdout.indexOf('SAMPLE_CONTAINER_STARTUP_READY')).toBeLessThan(child.stdout.indexOf('Enterprise Server running on'));
+    const chartsReady=JSON.parse(child.stdout.split('\n').find(line=>line.startsWith('{"event":"CONTROL_CHART_STARTUP_READY"')));
+    expect(chartsReady).toMatchObject({classification:'COMPLETE_214',totalChanges:0});
+    expect(child.stdout.indexOf('CONTROL_CHART_STARTUP_READY')).toBeLessThan(child.stdout.indexOf('Enterprise Server running on'));
     const holdsReady = JSON.parse(child.stdout.split('\n').find(line => line.startsWith('{"event":"SAMPLE_HOLD_STARTUP_READY"')));
     expect(holdsReady).toMatchObject({ classification: 'COMPLETE', totalChanges: 0 });
     expect(child.stdout.indexOf('SAMPLE_HOLD_STARTUP_READY')).toBeLessThan(child.stdout.indexOf('Enterprise Server running on'));
diff --git a/server/tests/contracts/audit_2_1_reference_ui.test.js b/server/tests/contracts/audit_2_1_reference_ui.test.js
index 1c2d49a6..999f21d1 100644
--- a/server/tests/contracts/audit_2_1_reference_ui.test.js
+++ b/server/tests/contracts/audit_2_1_reference_ui.test.js
@@ -40,6 +40,7 @@ function host(file, { canEdit = true, savedControl = null, materials = [material
             if (name === '@lims/number-parse') return require('../../../shared/numberParse');
             if (name === './NumberPreview') return () => null;
             if (name === './NativeRunPanel') return () => null; // These retained contracts exercise the profile form.
+            if (name === '../qc/ControlCharts') return () => null; // Chart interactions have their own contracts.
             throw new Error(`Unexpected reference component dependency: ${name}`);
         } });
     return { axios,
diff --git a/server/tests/contracts/audit_2_3_compatibility_runs.test.js b/server/tests/contracts/audit_2_3_compatibility_runs.test.js
index 592e9457..98360158 100644
--- a/server/tests/contracts/audit_2_3_compatibility_runs.test.js
+++ b/server/tests/contracts/audit_2_3_compatibility_runs.test.js
@@ -25,7 +25,7 @@ const owned = [];
 const input = (blank = 0.0123456789) => ({ blanks: [{ value: blank }], controls: [{ expected: 7.123456789, measured: 7.123456780 }],
     duplicates: [{ value1: 2.123456789, value2: 2.123456780 }, { value1: 2.123456789, value2: 2.123456780 }] });
 
-async function fixture({ migrated = false, sampleMember = false, finalClear = false, legacyRepeat = false, multiAnalyte = false } = {}) {
+async function fixture({ migrated = false, sampleMember = false, finalClear = false, legacyRepeat = false, multiAnalyte = false, nativeCurrentSchema = false } = {}) {
     const labId = randomUUID(), analysisCode = randomUUID(), username = 'system:fixture', batchId = randomUUID();
     const sampleId = randomUUID(), workItemId = randomUUID(), secondCode = randomUUID(), secondItemId = randomUUID();
     const members = sampleMember ? [{ id: workItemId, sampleId, labId, analysis: analysisCode, batchId, rackPosition: 3,
@@ -57,6 +57,17 @@ async function fixture({ migrated = false, sampleMember = false, finalClear = fa
     require('../../scripts/install_nonconformity_reports').installNonconformityReports({ dbPath: record.file, apply: true });
     require('../../scripts/install_batch_reagent_lots').installBatchReagentLots({ dbPath: record.file, apply: true });
     require('../../scripts/install_result_equipment_evidence').installResultEquipmentEvidence({ dbPath: record.file, apply: true });
+    if (nativeCurrentSchema) {
+        // Only the new Native case needs the current normal installation; all assertions are retained.
+        require('../../scripts/install_work_attempt_contract').installWorkAttemptContract({ dbPath: record.file, apply: true });
+        require('../../scripts/install_work_repeat_contract').installWorkRepeatContract({ dbPath: record.file, apply: true });
+        const { installCalculationReleasePrerequisites } = require('../helpers/calculationReleasePrerequisites');
+        const ownedDatabaseFile = record.file;
+        installCalculationReleasePrerequisites(ownedDatabaseFile);
+        require('../../scripts/install_instrument_imports').installInstrumentImports({ dbPath: record.file, apply: true });
+        require('../../scripts/install_sample_containers').installSampleContainers({ dbPath: record.file, apply: true });
+        require('../../scripts/install_control_charts').installControlCharts({ dbPath: record.file, apply: true });
+    }
     const db = new PrismaClient({ adapter: new PrismaBetterSqlite3({ url: `file:${record.file}` }) }); record.db = db;
     const actor = { id: username, username, role: 'LAB_MANAGER', labId }, f = { db, file: record.file, actor, labId, analysisCode };
     await db.analysis.create({ data: { code: analysisCode, name: 'Compatibility fixture analysis' } });
@@ -139,7 +150,7 @@ test.each([null, 'REPEAT_BATCH', 'REJECT'])('a migrated sibling status change pr
 });
 
 test.each(['PROFILE', 'NATIVE'])('a migrated REJECT_REANALYSIS item joins a new %s run while preserving its old evidence and membership', async targetKind => {
-    const f = await fixture({ migrated: true, sampleMember: true, legacyRepeat: true });
+    const f = await fixture({ migrated: true, sampleMember: true, legacyRepeat: true, nativeCurrentSchema: targetKind === 'NATIVE' });
     const old = await f.db.batch.findUnique({ where: { id: f.batch.id }, include: QC_RUN_INCLUDE });
     const workItemId = f.batch.workItems[0].id;
     expect(old.analytes[0].status).toBe('REPEAT_ORDERED');
diff --git a/server/tests/contracts/audit_2_3_native_runs.test.js b/server/tests/contracts/audit_2_3_native_runs.test.js
index bce6408e..ffd6bf80 100644
--- a/server/tests/contracts/audit_2_3_native_runs.test.js
+++ b/server/tests/contracts/audit_2_3_native_runs.test.js
@@ -35,6 +35,28 @@ const request = require('supertest');
 const { withQcRunHttp } = require('../helpers/qcRunHttpHarness');
 const owned = [];
 
+test('#214 new Provisional chart-mode start refuses an unbound served LRM lot atomically', async () => {
+    const f = await require('../helpers/qcGateFixture').qcGateFixture({ fixedWindowPolicy: false, criteria: {
+        blankPerBatch: 0, duplicateEvery: 0, lrmPerBatch: 1
+    } });
+    try {
+        const built = await buildNativeRun(f.db, f.actor, f.input), before = await f.snapshot();
+        const position = built.positions.find(row => row.kind === 'LRM');
+        await expect(startNativeRun(f.db, built.id, f.actor)).rejects.toMatchObject({
+            statusCode: 422, code: 'QC_CHART_LOT_REQUIRED', message: expect.stringContaining(position.id)
+        });
+        expect(await f.snapshot()).toEqual(before);
+        expect(await f.db.controlLimitSet.count()).toBe(0);
+        expect((await f.db.batch.findUnique({ where: { id: built.id } })).startedAt).toBeNull();
+        expect(await policies.get(f.labId, 'qc.lrmLimitMode', {db:f.db,analysisCode:f.analysisCode,methodologyId:f.method.id})).toBe('CONTROL_CHART');
+        expect(await f.db.labPolicyOverride.count()).toBe(0);
+        const lot = await referenceLot(f);
+        const started = await startNativeRun(f.db, built.id, f.actor, { references: [{ positionId: position.id, referenceMaterialId: lot.id }] });
+        expect(started.startedAt).not.toBeNull();
+        expect(JSON.parse((await f.db.batchAnalyte.findFirst()).criteriaSnapshot).controlCharts[0].basis.mode).toBe('PROVISIONAL');
+    } finally { await f.close(); }
+});
+
 async function fixture(count = 1, criteria = { crmEveryNBatches: 0 }, recordedAnalysisCode = null) {
     const labId = randomUUID(), analysisCode = recordedAnalysisCode || `NATIVE-${randomUUID()}`, username = 'system:fixture';
     const historical = beforeGuards({ actor: username, schemaVariant: 'PRE_1_3_SAMPLE_CODES', relatedRows: {
@@ -63,6 +85,10 @@ async function fixture(count = 1, criteria = { crmEveryNBatches: 0 }, recordedAn
     const method = await db.methodology.create({ data: { analysisCode, name: 'Recorded native method', loq: 0.123456789 } });
     const instrument = await db.equipmentAsset.create({ data: { id: randomUUID(), labId, name: 'Fixture instrument', assetType: 'OTHER', status: 'IN_SERVICE', criticality: 'NON_CRITICAL' } });
     const actor = { username, role: 'SUPER_ADMIN', labId }, f = { db, file, actor, labId, analysisCode, method, instrument };
+    // Claudio6152507558: retain these pre-chart assertions in their explicit
+    // fixed-window policy context; production Strict remains CONTROL_CHART.
+    await policies.change(actor, labId, { changes: [{ key: 'qc.lrmLimitMode', value: 'FIXED_WINDOW' }],
+        reason: 'Retained pre-chart Native fixture context' }, { db });
     await rules.change(actor, { labId, analysisCode, methodologyId: method.id, criteria, expectedVersion: 0, reason: 'Reviewed fixture criteria' }, { db });
     f.workItemIds = await members(f, count);
     f.input = { instrumentId: instrument.id, workItemIds: f.workItemIds, seed: 'native-integration-fixture' };
diff --git a/server/tests/contracts/audit_2_3_native_ui.test.js b/server/tests/contracts/audit_2_3_native_ui.test.js
index d3eb29fd..36beaba8 100644
--- a/server/tests/contracts/audit_2_3_native_ui.test.js
+++ b/server/tests/contracts/audit_2_3_native_ui.test.js
@@ -51,6 +51,17 @@ function mount(batch) {
         tree = module.exports.default(props); effects.splice(0).forEach(effect => effect()); await new Promise(resolve => setImmediate(resolve)); } },
     find: id => nodes(tree).find(node => node.props?.['data-testid'] === id), all: () => nodes(tree) };
 }
+
+test('#214 lot selections are bound by the actual start request; frozen chart lots cannot be changed in the UI', async () => {
+    const unstarted = mount(fixture({ started: false })); await unstarted.render();
+    unstarted.find('native-lot-lrm').props.onChange({ target: { value: 'lot-a' } }); await unstarted.render();
+    await unstarted.find('native-run-start').props.onClick();
+    expect(unstarted.axios.post).toHaveBeenCalledWith('/api/qc/batches/native-run/start', { references: [{ positionId: 'lrm', referenceMaterialId: 'lot-a' }] });
+    const batch = fixture();
+    batch.analytes[0].criteriaSnapshot = JSON.stringify({qcRule:{resolved:{lrmMode:{value:'CONTROL_CHART'}}},controlCharts:[{positions:[{positionId:'lrm',referenceMaterialId:'lot-a'}]}]});
+    const started = mount(batch); await started.render();
+    expect(started.find('native-lot-lrm').props.disabled).toBe(true);
+});
 function fixture({ started = true, mode = 'REQUIRED_BLOCKING', measured = false } = {}) {
     const sample = { id: 'sample', position: 3, kind: 'SAMPLE', sampleId: 's' }, duplicate = { id: 'duplicate', position: 4, kind: 'DUPLICATE', sampleId: 's', duplicateOfPositionId: 'sample' };
     const positions = mode === 'OFF' ? [sample] : [{ id: 'blank', position: 1, kind: 'BLANK' }, { id: 'lrm', position: 2, kind: 'LRM', references: [] }, sample, duplicate];
diff --git a/server/tests/contracts/audit_4_1_run_first_ui.test.js b/server/tests/contracts/audit_4_1_run_first_ui.test.js
index 6058342f..0a68792a 100644
--- a/server/tests/contracts/audit_4_1_run_first_ui.test.js
+++ b/server/tests/contracts/audit_4_1_run_first_ui.test.js
@@ -6,6 +6,20 @@ const group = count => ({ analysis: 'A', analysisName: 'Owned analysis', items:
 })) });
 const options = { labId: 'owned-lab', defaultMethodologyId: 'method', methodologyId: 'method', maxBatchSize: 40, equipmentRequired: true,
     methods: [{ id: 'method', analysisCode: 'A', name: 'Owned method' }], eligibleEquipment: [{ id: 'instrument', name: 'Qualified instrument' }] };
+
+test('#214 chart-mode start visibly requires an offered LRM lot and sends its identity with the run', async () => {
+    const { view, axios } = await form(1, { ...options, chartLotRequired: true,
+        eligibleLrmLots: [{ id: 'lot-a', code: 'LRM-A', lotNumber: 'LOT-A' }] });
+    view.find('start-run-instrument').props.onChange({ target: { value: 'instrument' } }); await view.render();
+    expect(view.find('start-run-select-all').props.disabled).toBeTruthy();
+    expect(view.find('start-run-lrm-lot').props.required).toBe(true);
+    view.find('start-run-lrm-lot').props.onChange({ target: { value: 'lot-a' } }); await view.render();
+    view.find('start-run-select-all').props.onClick(); await view.render();
+    expect(view.find('start-run-confirm').props.disabled).toBeFalsy();
+    await view.find('start-run-form').props.onSubmit({ preventDefault() {} });
+    expect(axios.post).toHaveBeenCalledWith('/api/qc/runs/start', { analysisCode: 'A', labId: 'owned-lab', methodologyId: 'method',
+        instrumentId: 'instrument', workItemIds: ['item-0'], referenceMaterialLotId: 'lot-a' });
+});
 function api(data = options) { return { get: jest.fn(async () => ({ data })), post: jest.fn(async () => ({ data: { batch: { id: 'started-run' } } })) }; }
 async function form(count = 40, data = options) {
     const axios = api(data), onStarted = jest.fn(), groups = [group(count)];
diff --git a/server/tests/contracts/deployment_readiness_bootstrap.test.js b/server/tests/contracts/deployment_readiness_bootstrap.test.js
index ee47fbef..4c7e3911 100644
--- a/server/tests/contracts/deployment_readiness_bootstrap.test.js
+++ b/server/tests/contracts/deployment_readiness_bootstrap.test.js
@@ -368,6 +368,7 @@ bash "${entryScript.replace(/\\/g, '/')}"
             .toMatchObject({classification:'COMPLETE_205',backfilledCount:0});
         require('../../scripts/install_instrument_imports').installInstrumentImports({ dbPath: targetDb, apply: true });
         require('../../scripts/install_sample_containers').installSampleContainers({ dbPath: targetDb, apply: true });
+        require('../../scripts/install_control_charts').installControlCharts({ dbPath: targetDb, apply: true });
         const hashDb = () => createHash('sha256').update(fs.readFileSync(targetDb)).digest('hex');
         const beforeSha = hashDb();
         fs.writeFileSync(path.join(testDir, 'prisma', '.seed_complete'), 'done');
@@ -425,6 +426,8 @@ bash "${entryScript.replace(/\\/g, '/')}"
                 `node "${path.join(serverDir, 'scripts/install_instrument_imports.js').replace(/\\/g, '/')}"`)
             .replaceAll('node scripts/install_sample_containers.js',
                 `node "${path.join(serverDir, 'scripts/install_sample_containers.js').replace(/\\/g, '/')}"`)
+            .replaceAll('node scripts/install_control_charts.js',
+                `node "${path.join(serverDir, 'scripts/install_control_charts.js').replace(/\\/g, '/')}"`)
             .replaceAll('node scripts/install_result_raw_input.js',
                 `node "${path.join(serverDir, 'scripts/install_result_raw_input.js').replace(/\\/g, '/')}"`)
             .replace(/node scripts\/migrate_[^\n]+/g, '# noop migration');
diff --git a/server/tests/globalSetup.js b/server/tests/globalSetup.js
index 1aaddb7c..e6315af9 100644
--- a/server/tests/globalSetup.js
+++ b/server/tests/globalSetup.js
@@ -90,6 +90,7 @@ module.exports = async function globalSetup() {
         require('../scripts/install_preparation_records').installPreparationRecords({dbPath:testDbPath,apply:true});
         require('../scripts/install_instrument_imports').installInstrumentImports({dbPath:testDbPath,apply:true});
         require('../scripts/install_sample_containers').installSampleContainers({dbPath:testDbPath,apply:true});
+        require('../scripts/install_control_charts').installControlCharts({dbPath:testDbPath,apply:true});
     }
 
     process.env.DATABASE_PATH = testDbPath;
diff --git a/server/tests/helpers/legacyWorkflowDatabase.js b/server/tests/helpers/legacyWorkflowDatabase.js
index ec488e0c..6bf76312 100644
--- a/server/tests/helpers/legacyWorkflowDatabase.js
+++ b/server/tests/helpers/legacyWorkflowDatabase.js
@@ -242,6 +242,12 @@ function beforeGuards(options) {
             expected.push({table:'UserBenchCredential',missingTable:true});
             // #205 adds exactly one append-only evidence table and one nullable draft column; its installer creates both.
             expected.push({table:'WorkItemDraft',fields:['records']},{table:'PreparationRecord',missingTable:true});
+            // #214 is four additive tables. Preserve the captured historical
+            // schema and continue refusing every other generated-model gap.
+            const chartTables = ['ControlLimitProposal', 'ControlLimitSet', 'QcReviewObligation', 'QcReviewResolution'];
+            const chartModels = chartTables.filter(table => modelNames.includes(table));
+            assert.ok(chartModels.length === 0 || chartModels.length === chartTables.length, 'Generated chart datamodel is partial.');
+            if (chartModels.length) expected.push(...chartTables.map(table => ({ table, missingTable: true })));
             // #200 adds only these two models and one nullable draft pointer.
             // The historical literals and every earlier expected gap stay fixed.
             const importTables = ['ImportTemplate', 'InstrumentImportReceipt'];
@@ -333,7 +339,7 @@ function beforeGuards(options) {
             const tables = source.prepare("SELECT name, sql FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_prisma_%' AND name NOT IN ('ResultEvidenceEvent','ContainerSequence')").all();
             // Copy schema-only indexes, leaving every additive release guard
             // and partial index for its actual installer on this new file.
-            const indexes = source.prepare("SELECT sql FROM sqlite_master WHERE type='index' AND sql IS NOT NULL AND tbl_name != 'ResultEvidenceEvent' AND name NOT IN ('ReferenceValue_current_generic','ReferenceValue_current_method','QcRule_scope_version_unique','BatchAnalyte_crm_ordinal_unique','BatchPositionReference_current_unique','QcMeasurement_current_unique','WorkAttempt_workItemId_attemptNo_unique','result_one_current','ReportedValueSelection_one_root','ResultOverrideRequest_one_active_cell','Report_amendmentId_key')").all();
+            const indexes = source.prepare("SELECT sql FROM sqlite_master WHERE type='index' AND sql IS NOT NULL AND tbl_name != 'ResultEvidenceEvent' AND name NOT IN ('ReferenceValue_current_generic','ReferenceValue_current_method','QcRule_scope_version_unique','BatchAnalyte_crm_ordinal_unique','BatchPositionReference_current_unique','QcMeasurement_current_unique','WorkAttempt_workItemId_attemptNo_unique','result_one_current','ReportedValueSelection_one_root','ResultOverrideRequest_one_active_cell','Report_amendmentId_key','ControlLimitSet_one_approved_series')").all();
             source.close();
             for (const table of tables) db.exec(['Sample', 'WorkItem'].includes(table.name)
                 ? table.sql.replace(/,\s*"(?:holdPriorStatus|legacyStatus)"\s+TEXT(?=\s*[,)])/g, '') : table.sql);
diff --git a/server/tests/helpers/qcGateFixture.js b/server/tests/helpers/qcGateFixture.js
index 30c22b6f..7589ddc4 100644
--- a/server/tests/helpers/qcGateFixture.js
+++ b/server/tests/helpers/qcGateFixture.js
@@ -8,7 +8,7 @@ const { beforeGuards } = require('./legacyWorkflowDatabase');
 const { createSampleFixture, createWorkItemFixture } = require('./workflowFixtures');
 const { installCalculationReleasePrerequisites } = require('./calculationReleasePrerequisites');
 
-async function qcGateFixture({ count = 1, criteria = {}, status = 'IN_PROGRESS', sharedSample = false, resolvedRules = true, installSelectionEvidence = true, installOverrideRequests = true, installInstrumentImports = true, installSampleContainers = true } = {}) {
+async function qcGateFixture({ count = 1, criteria = {}, status = 'IN_PROGRESS', sharedSample = false, resolvedRules = true, installSelectionEvidence = true, installOverrideRequests = true, installInstrumentImports = true, installSampleContainers = true, installControlCharts = true, fixedWindowPolicy = criteria.lrmMode !== 'CONTROL_CHART' && criteria.lrmPerBatch !== 0 } = {}) {
     const labId = randomUUID(), analysisCode = `QC-GATE-${randomUUID()}`, username = 'system:fixture';
     const historical = beforeGuards({ actor: username, schemaVariant: 'PRE_1_3_SAMPLE_CODES', relatedRows: {
         Lab: [{ id: labId, code: labId, name: 'QC gate fixture', country: 'TEST', updatedAt: Date.now() }],
@@ -37,12 +37,16 @@ async function qcGateFixture({ count = 1, criteria = {}, status = 'IN_PROGRESS',
     require('../../scripts/install_preparation_records').installPreparationRecords({dbPath:file,apply:true});
     if (installInstrumentImports) require('../../scripts/install_instrument_imports').installInstrumentImports({ dbPath: file, apply: true });
     if (installInstrumentImports && installSampleContainers) require('../../scripts/install_sample_containers').installSampleContainers({ dbPath: file, apply: true });
+    if (installInstrumentImports && installSampleContainers && installControlCharts) require('../../scripts/install_control_charts').installControlCharts({ dbPath: file, apply: true });
     const db = new PrismaClient({ adapter: new PrismaBetterSqlite3({ url: `file:${file}` }) });
     const actor = { username, role: 'SUPER_ADMIN', labId };
     await db.unit.create({ data: { code: 'fixture-unit', display: 'Fixture unit', quantityKind: 'MASS_FRACTION', factorToBase: 1 } });
     const instrument = await db.equipmentAsset.create({ data: { id: randomUUID(), labId, name: 'Fixture instrument', assetType: 'OTHER',
         status: 'IN_SERVICE', criticality: 'NON_CRITICAL' } });
     const items = [], methods = [];
+    if (fixedWindowPolicy) await require('../../services/policyService').change(actor, labId, {
+        changes: [{ key: 'qc.lrmLimitMode', value: 'FIXED_WINDOW' }], reason: 'Explicit retained pre-chart gate fixture context'
+    }, { db });
     let sample;
     for (let i = 0; i < count; i++) {
         const code = sharedSample ? `${analysisCode}-${i}` : analysisCode;
diff --git a/server/tests/helpers/workflowWriteScanner.js b/server/tests/helpers/workflowWriteScanner.js
index 1e06d429..372ea9ba 100644
--- a/server/tests/helpers/workflowWriteScanner.js
+++ b/server/tests/helpers/workflowWriteScanner.js
@@ -31,6 +31,12 @@ const QC_MEMBERSHIP_LOADER_SHA256 = '40c0af827c4d22b6fce1ee5b770f2c0146f456cfeea
 const QC_MEMBERSHIP_SQL_SHA256 = '1bc85113a3b6b7da327265bc7005eb4a1c97855943c599b1fe5ed8b126cf8572';
 // #189 additive evidence sources are inspected, never exempted as writers.
 const QC_EVIDENCE_SOURCES = Object.freeze([
+    // #214: inspect only the exact additive chart evidence/guard source.
+    // This adds no workflow writer exemption.
+    Object.freeze({ functionName: 'loadControlChartMigrationSource', loader: 'services/controlChartMigrationSource.js',
+        loaderSha256: '2e79cdf57bb09eed9f5e2e8721aa5c0ab540c16a7312d4ff02d138a20e604df6',
+        directory: '20261013000200_control_charts', sqlSha256: '49b378296a8a0ede3318ae1e543060478b55827db0ec981d8cc4bd6180a56df6',
+        boundary: '-- Contract guards' }),
     // #206: resolve only digest-bound additive container/counter DDL. No writer exception.
     Object.freeze({ functionName: 'loadSampleContainerMigrationSource', loader: 'services/sampleContainerMigrationSource.js',
         loaderSha256: 'ab223052522a5d74e899c4c372204a4a68574819a3f6b3c7bd8837f8ad7bb8d4',
@@ -216,6 +222,8 @@ const CALCULATION_PREREQUISITES = Object.freeze({
     file: 'tests/helpers/calculationReleasePrerequisites.js', exportName: 'installCalculationReleasePrerequisites',
     sha256: '5b091435c1e3ce5468a5dedcddf1f278fe3d6f6238c129804959f1826287ac57',
     callers: ['tests/helpers/qcGateFixture.js', 'tests/helpers/normalizedQcFixture.js', 'tests/helpers/repeatQcPredecessors.js',
+        // Claudio6152507558: current-schema Native case in this owned compatibility fixture only.
+        'tests/contracts/audit_2_3_compatibility_runs.test.js',
         'tests/contracts/audit_2_3_native_runs.test.js', 'tests/contracts/audit_1_2_guard_installer.test.js',
         'tests/contracts/deployment_readiness_bootstrap.test.js', 'tests/contracts/audit_3_1_attempt_sql_guards.test.js']
 });
```

</details>

Refs #214. The issue stays open for deployment and Claudio's actual post-deploy check; this PR deliberately has no closing keyword. Existing #206 source merge remains undeployed. A later batch requires each exact-head audit PASS, one exact-kit audit and a fresh single-use gate under the standing go. This PR authorizes no historical production replay and no #103 apply.
