const fs = require('node:fs'), path = require('node:path'), { randomUUID, createHash } = require('node:crypto');
const Database = require('better-sqlite3');
const { assertOwnedTestDatabase } = require('./testOwnedDatabase');
// #201 working agreement6089928620; closed factory precedent6088661994.
// Unmodified fresh Prisma7.10 DDL, schema at7ea12c66 (84 models,68418 bytes).
// prisma migrate diff --from-empty --to-schema <unchanged schema> --script
const DDL_SHA256 = '6ae0cc1d26dc3ba301d435d3f332d432a9765c3d30b7fd0725aa119db6f8f622';
const CALLER = 'tests/contracts/audit_4_8_cross_check_install.test.js';
function createPre201CrossCheckFixture() {
    if (arguments.length) throw Error('The pre-201 factory accepts no arguments.');
    if (path.relative(path.resolve(__dirname, '../..'), globalThis.expect?.getState?.().testPath || '').replace(/\\/g, '/') !== CALLER)
        throw Error('The pre-201 factory refuses an unlisted caller.');
    const bytes = fs.readFileSync(path.join(__dirname, 'fixtures/pre201_full_application_schema.sql'));
    if (bytes.length !== 68418 || createHash('sha256').update(bytes).digest('hex') !== DDL_SHA256) throw Error('The literal pre-201 DDL differs.');
    const directory = path.resolve(__dirname, '../.tmp'); fs.mkdirSync(directory, { recursive: true });
    const file = assertOwnedTestDatabase(path.join(directory, 'audit_legacy_pre201_' + randomUUID() + '.db'), 'system:fixture');
    fs.closeSync(fs.openSync(file, 'wx')); const db = new Database(file, { fileMustExist: true });
    try { db.pragma('foreign_keys=ON'); db.transaction(() => db.exec(bytes.toString('utf8')))(); }
    finally { db.close(); }
    // Only real predecessor installers create receipts; none are fabricated.
    for (const [moduleName, method] of [
        ['workflow_state_guards', 'installWorkflowStateGuards'], ['result_attempt_links', 'installResultAttemptLinks'],
        ['sample_holds', 'installSampleHolds'], ['reference_materials', 'installReferenceMaterials'], ['qc_rules', 'installQcRules']
    ]) require('../../scripts/install_' + moduleName)[method]({ dbPath: file, apply: true });
    const { installQcRuns } = require('../../scripts/install_qc_runs');
    const plan = installQcRuns({ dbPath: file });
    installQcRuns({ dbPath: file, apply: true, planSha256: plan.backfillFingerprint });
    for (const [moduleName, method] of [
        ['qc_gate_scope', 'installQcGateScope'], ['result_equipment_evidence', 'installResultEquipmentEvidence'],
        ['workitem_uniqueness', 'installWorkItemUniqueness'], ['work_attempt_contract', 'installWorkAttemptContract'],
        ['work_repeat_contract', 'installWorkRepeatContract'], ['reported_value_selections', 'installReportedValueSelections'],
        ['batch_reagent_lots', 'installBatchReagentLots'], ['result_override_requests', 'installResultOverrideRequests']
    ]) require('../../scripts/install_' + moduleName)[method]({ dbPath: file, apply: true });
    return { file };
}
module.exports = { createPre201CrossCheckFixture };
