Startup currently repeats database integrity/FK checks and policy/chart snapshot work across 26 readiness stages. This performance-only change shares those results within one explicit startup context and uses one set query for order-revision impact, while preserving the existing reports and refusal conditions.

Follows Claudio's [corrected performance-only direction](https://github.com/yigini/soilfer-lims/issues/162#issuecomment-6189025975). All existing integrity/FK checks, full-file hashes, migration-source digests, DB/WAL/SHM copy/race guards, refusal codes and triggers remain. Invalid stored analyses and continuing OPEN reservations remain reported; approved-amendment nonzero remains a separate kit/gate STOP. No schema migration or new startup STOP is introduced.

- One private readonly context is passed through every direct READY check and nested prerequisite. Earlier checks share a read transaction; policy, chart and order use the same owner-created retained copy. Full main/WAL byte hashes bind cached full pragma rows, and the owner's separate full DB/WAL/SHM checks still protect copying and races. Changed original/copy/source bytes invalidate results and use the existing owner refusal path.
- The chart classification is reused. Nested order checks stay on the captured copy and keep the final original-file `ORDER_REVISION_SNAPSHOT_CHANGED` guard, including an original-file change after policy capture but before the nested chart call.
- Every READY event adds `elapsed_ms` and `rss_bytes`. The startup owner closes the context before HTTP and on failure. There is no global Database prototype change. All 26 installers load the context dependency only on explicit opt-in; default CLI/import/install/dry-run paths retain ordinary database construction and existing output/error handling.
- Order impact uses one WorkItem LEFT JOIN Sample query with the original four owner fields and ordering. Full reports and the existing missing-Sample error remain equivalent. Fewer point lookups are verified; no wall-clock query speedup or production readiness improvement is claimed from synthetic timing.

Validation for exact head `eba02837eaa2ab797cad0572fecada686f660346` / tree `676b01e71211786d1aeace50f19a0b2c9f9c482e`, base `cde8c8896f5f9d5f1ab07b0ae16b1a765e0a6367`:

- Closed complete local ordinary run at 2026-10-15T12:52:22.721011UTC: **Test Suites: 373 passed, 373 total** / **Tests: 5679 passed, 5679 total**; zero failed/pending/todo. All 373 unique paths match discovery, all 1,333 frozen input hashes and visible assets remain unchanged. Both ordinary setups, stock assertions, one worker, 512000000-byte worker recycling and blank local NODE_OPTIONS remain enabled. Local Windows storage fixtures retain physical owned test files and serve byte-identical built assets/disposable uploads outside the hidden checkout. Standard CI uses none of these local retention/storage/testMatch fixtures and must run ordinary npm test with its unchanged configured heap, then the candidate and supported-baseline real Docker builds, real boundary rehearsal and deployment-readiness acceptance.
- Final focused run: 5 suites / 167 tests pass, including both suites that failed the original full run. New context contracts compare all 26 reports and refusal behavior with the legacy path; verify exactly one integrity check, one FK check, one retained policy snapshot and one chart classification; and cover owned WAL-mode absent/empty/genuinely nonempty WAL with an idle writer, original/copy races, retained-copy byte changes, migration digest changes, simple/full pragma views, readonly behavior, cross-start isolation and closure. All **370 preexisting current-main test files** are byte-identical. A 371-file unchanged manifest additionally includes the new unchanged telemetry test.
- The original full run remains honestly FAILED (371/373 suites, 5670/5672 tests). The isolated CLI-copy missing-dependency regression and scanner findings were corrected in new source; an initially failing earlier-race contract led to the pinned-copy correction. A later full attempt executed zero test bodies because the local retention fixture correctly rejected its stale directory pin; the final run used a new exact-bound fixture. All failures, originals and successors are retained; none is relabelled or replayed.

[Complete raw reports/logs/exit/config/command/inventory/source hashes, focused failures and successes](https://github.com/yigini/soilfer-lims/tree/7bb585c8e465a529455dfb5ba6f1b8d229f37521/WP/startup-order-readiness-20261015). The final complete result is indexed by `full-pinned-copy-retention-bound-closed-pass-once/publication-index.json`; the application/source evidence by `private-context-closed-guards-pinned-copy-complete-publication-index.json`.

Fixture authority is explicit: `qcGateFixture` adds an opt-in `managedStartup` mode using the real workflow installer and existing guarded empty PT/NCR bootstrap; the default fixture is unchanged. New `startupImpactFixture` is digest-pinned, memory-only, admits one declared test caller and closed sample-count/orphan options, accepts no database path/connection/SQL/callback, and seals query-only after literal fixture construction. Caller/digest/capability negatives and passive SQLite execution tracing replace opaque SQL forwarding. Existing scanner predicates and assertions remain unchanged; only this narrow test-only registry binding is added. Exact changes to the two retained helpers follow.

<details><summary>Changed retained fixture/scanner lines</summary>

```diff
diff --git a/server/tests/helpers/qcGateFixture.js b/server/tests/helpers/qcGateFixture.js
index 86327e76..a2756429 100644
--- a/server/tests/helpers/qcGateFixture.js
+++ b/server/tests/helpers/qcGateFixture.js
@@ -8,24 +8,30 @@ const { beforeGuards } = require('./legacyWorkflowDatabase');
 const { createSampleFixture, createWorkItemFixture } = require('./workflowFixtures');
 const { installCalculationReleasePrerequisites } = require('./calculationReleasePrerequisites');
 
-async function qcGateFixture({ count = 1, criteria = {}, status = 'IN_PROGRESS', sharedSample = false, resolvedRules = true, installSelectionEvidence = true, installOverrideRequests = true, installInstrumentImports = true, installSampleContainers = true, installControlCharts = true, installOrderRevisions = true, fixedWindowPolicy = criteria.lrmMode !== 'CONTROL_CHART' && criteria.lrmPerBatch !== 0 } = {}) {
+async function qcGateFixture({ managedStartup = false, count = 1, criteria = {}, status = 'IN_PROGRESS', sharedSample = false, resolvedRules = true, installSelectionEvidence = true, installOverrideRequests = true, installInstrumentImports = true, installSampleContainers = true, installControlCharts = true, installOrderRevisions = true, fixedWindowPolicy = criteria.lrmMode !== 'CONTROL_CHART' && criteria.lrmPerBatch !== 0 } = {}) {
     const labId = randomUUID(), analysisCode = `QC-GATE-${randomUUID()}`, username = 'system:fixture';
-    const historical = beforeGuards({ actor: username, schemaVariant: 'PRE_1_3_SAMPLE_CODES', relatedRows: {
+    const historical = beforeGuards({ actor: username, ...(managedStartup ? { installWorkflowStateGuards: true } : { schemaVariant: 'PRE_1_3_SAMPLE_CODES' }), relatedRows: {
         Lab: [{ id: labId, code: labId, name: 'QC gate fixture', country: 'TEST', updatedAt: Date.now() }],
         User: [{ id: username, username, email: 'qc-gate@example.test', password: 'fixture', role: 'SUPER_ADMIN', updatedAt: Date.now() }]
     } });
     const { file } = historical;
-    historical.applyPendingMigration({ migration: 'SAMPLE_CODES' });
-    const connection = new Database(file, { fileMustExist: true });
-    try { connection.exec('CREATE TABLE "_schema_migrations" ("id" TEXT PRIMARY KEY NOT NULL,"appliedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,"details" TEXT)'); }
-    finally { connection.close(); }
+    if (!managedStartup) {
+        historical.applyPendingMigration({ migration: 'SAMPLE_CODES' });
+        const connection = new Database(file, { fileMustExist: true });
+        try { connection.exec('CREATE TABLE "_schema_migrations" ("id" TEXT PRIMARY KEY NOT NULL,"appliedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,"details" TEXT)'); }
+        finally { connection.close(); }
+    }
     for (const [script, method] of [['install_result_attempt_links', 'installResultAttemptLinks'], ['install_sample_holds', 'installSampleHolds'],
         ['install_reference_materials', 'installReferenceMaterials'], ['install_qc_rules', 'installQcRules'], ['install_qc_runs', 'installQcRuns'],
         ['install_qc_gate_scope', 'installQcGateScope'], ['install_proficiency_evidence', 'installProficiencyEvidence'],
         ['install_result_equipment_evidence', 'installResultEquipmentEvidence'],
         ['install_work_attempt_contract','installWorkAttemptContract'],
         ['install_work_repeat_contract','installWorkRepeatContract'],
-        ['install_nonconformity_reports','installNonconformityReports']]) require(`../../scripts/${script}`)[method]({ dbPath: file, apply: true });
+        ['install_nonconformity_reports','installNonconformityReports']]) {
+        if (managedStartup && script === 'install_proficiency_evidence')
+            require('../../scripts/bootstrap_pt_nonconformity').bootstrapPtNonconformity({ dbPath: file, apply: true });
+        require(`../../scripts/${script}`)[method]({ dbPath: file, apply: true });
+    }
     if (installSelectionEvidence) require('../../scripts/install_reported_value_selections').installReportedValueSelections({ dbPath: file, apply: true });
     require('../../scripts/install_batch_reagent_lots').installBatchReagentLots({ dbPath: file, apply: true });
     if (installOverrideRequests) require('../../scripts/install_result_override_requests').installResultOverrideRequests({ dbPath: file, apply: true });
diff --git a/server/tests/helpers/workflowWriteScanner.js b/server/tests/helpers/workflowWriteScanner.js
index af06fe33..f0bc3cee 100644
--- a/server/tests/helpers/workflowWriteScanner.js
+++ b/server/tests/helpers/workflowWriteScanner.js
@@ -150,6 +150,14 @@ const deferredSources = Object.freeze([Object.freeze({
     reason: '#146 synthetic Docker fault adapter; deferred, see #245'
 })]);
 
+// Performance-only startup impact equivalence: one closed in-memory builder,
+// digest-bound export and explicit test caller. No runtime writer exemption.
+const STARTUP_IMPACT_FIXTURE = Object.freeze({
+    file: 'tests/helpers/startupImpactFixture.js', exportName: 'createStartupImpactFixture',
+    sha256: 'b516abe71f18df6571201e30a852ae50bd078956c1d7f898b922bd6c05d06a4b',
+    caller: 'tests/contracts/order_revision_impact_set_query.test.js'
+});
+
 const mutations = new Set(['create', 'createMany', 'createManyAndReturn', 'update', 'updateMany', 'updateManyAndReturn', 'upsert', 'save', 'saveMany', 'bulkUpdate', 'delete', 'deleteMany']);
 const sqlMethods = new Set(['prepare', 'exec', 'execute', 'pragma', '$executeRaw', '$executeRawUnsafe', '$queryRaw', '$queryRawUnsafe']);
 const workflowModels = new Map([['sample', 'Sample'], ['samples', 'Sample'], ['workItem', 'WorkItem'], ['workItems', 'WorkItem'], ['result', 'Result'], ['results', 'Result']]);
@@ -272,6 +280,10 @@ const AMENDMENT_MAIN_FIXTURE = Object.freeze({
 function scanSource(source, filename, exceptions = []) {
     const violations = [];
     const report = (node, code, detail) => violations.push({ file: filename, line: node?.loc?.start?.line || node?.loc?.line || 1, code, detail });
+    const validStartupImpactFixture = filename === STARTUP_IMPACT_FIXTURE.file &&
+        createHash('sha256').update(source).digest('hex') === STARTUP_IMPACT_FIXTURE.sha256;
+    if (filename === STARTUP_IMPACT_FIXTURE.file && !validStartupImpactFixture)
+        report(null, 'HISTORICAL_FIXTURE_SOURCE_MISMATCH', 'The closed startup impact builder differs.');
     let validAttemptFixture = false;
     let validCalculationFixture = false;
     let validInstrumentImportFixture = false;
@@ -792,6 +804,7 @@ function scanSource(source, filename, exceptions = []) {
     function authorized(p, entities, operation) {
         const name = owner(p);
         if (!exportedNames.has(name)) return false;
+        if (validStartupImpactFixture && name === STARTUP_IMPACT_FIXTURE.exportName) return true;
         if (validCalculationFixture && name === CALCULATION_FIXTURE.exportName) return true;
         if (validInstrumentImportFixture && name === INSTRUMENT_IMPORT_FIXTURE.exportName) return true;
         if (validInstrumentImportMainFixture && name === INSTRUMENT_IMPORT_MAIN_FIXTURE.exportName) return true;
@@ -837,6 +850,20 @@ function scanSource(source, filename, exceptions = []) {
             const root = path.resolve(__dirname, '../..');
             const resolved = path.relative(root, path.resolve(root, path.dirname(filename), specifier))
                 .replace(/\\/g, '/').replace(/\.(?:js|cjs)$/, '');
+            if (resolved === STARTUP_IMPACT_FIXTURE.file.replace(/\.js$/, '')) {
+                const declaration = p.parentPath;
+                const allowed = filename === STARTUP_IMPACT_FIXTURE.caller && declaration.isVariableDeclarator() &&
+                    declaration.get('id').isObjectPattern() && declaration.get('id.properties').length === 1 &&
+                    declaration.get('id.properties').every(property => {
+                        if (!property.isObjectProperty() || property.node.computed || !property.get('value').isIdentifier() ||
+                            (property.node.key.name || property.node.key.value) !== STARTUP_IMPACT_FIXTURE.exportName) return false;
+                        const binding = declaration.scope.getBinding(property.node.value.name);
+                        return binding && binding.constantViolations.length === 0 && binding.referencePaths.length > 0 &&
+                            binding.referencePaths.every(reference => reference.key === 'callee' && reference.parentPath.isCallExpression() &&
+                                reference.parentPath.get('arguments').length === 1 && reference.parentPath.get('arguments.0').isIdentifier());
+                    });
+                if (!allowed) report(p.node, filename.startsWith('tests/') ? 'HISTORICAL_FIXTURE_CALLER_NOT_ALLOWED' : 'TEST_HELPER_IMPORTED_BY_RUNTIME', specifier);
+            }
             if (resolved === CALCULATION_PREREQUISITES.file.replace(/\.js$/, '')) {
                 const declaration = p.parentPath;
                 const allowed = CALCULATION_PREREQUISITES.callers.includes(filename) && declaration.isVariableDeclarator() &&

```

</details>

This is a source PR and local-suite result. Actual complete PR CI and Claudio's final exact-head audit PASS are required before merge; current-main CI follows. A future release needs a NEW application image/build, NEW image-bound tooling/all-hash source review, fresh computed capacity plus 10GB before each build/proof, and a NEW proof root. Historical cde8/B5/100000 attempts remain consumed. The 600-second readiness and 805306368-byte runtime limits remain. No production operation, cleanup replay or #103 apply occurred. Refs #162; existing deployment issues stay open for actual post-deploy checks.
