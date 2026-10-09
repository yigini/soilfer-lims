const fs = require('node:fs'), path = require('node:path');
const Database = require('better-sqlite3');
const { inventoryLegacyQcRuns } = require('../../services/qcRunBackfillPlan');
const { installCalculationReleasePrerequisites } = require('./calculationReleasePrerequisites');

// Retained contracts seed historical Batch JSON before exercising the routes.
// Translate that fixture through the actual reviewed importer plan, on the
// disposable test DB only. Every release trigger remains installed and active.
async function normalizeLegacyQcFixture(client, batchId) {
    require('../../services/workflowStateRules').assertFixtureContext();
    const databases = await client.$queryRawUnsafe('PRAGMA database_list');
    const file = path.resolve(databases.find(row => row.name === 'main')?.file || '');
    if (process.env.NODE_ENV !== 'test' || path.dirname(file) !== path.resolve(__dirname, '../.tmp') ||
        !/^[^/\\]+\.db$/.test(path.basename(file)) || !fs.existsSync(file) || fs.realpathSync(file) !== file) throw Error('QC fixture translation requires its disposable test database.');
    require('../../scripts/install_batch_reagent_lots').installBatchReagentLots({ dbPath: file, apply: true });
    const guardReader = new Database(file, { readonly: true, fileMustExist: true });
    let installed;
    try { installed = guardReader.prepare("SELECT count(*) n FROM sqlite_master WHERE type='trigger' AND name IN ('Batch_legacy_qc_immutable','BatchPosition_membership_insert_guard','QcMeasurement_insert_guard')").get().n; }
    finally { guardReader.close(); }
    if (installed === 0) {
        const { installQcRuns } = require('../../scripts/install_qc_runs');
        const reviewed = installQcRuns({ dbPath: file });
        installQcRuns({ dbPath: file, apply: true, planSha256: reviewed.backfillFingerprint });
        require('../../scripts/install_qc_gate_scope').installQcGateScope({ dbPath: file, apply: true });
        installCalculationReleasePrerequisites(file);
        return;
    }
    const db = new Database(file, { readonly: true, fileMustExist: true });
    let planned;
    try {
        const guardCount = db.prepare("SELECT count(*) n FROM sqlite_master WHERE type='trigger' AND name IN ('Batch_legacy_qc_immutable','BatchPosition_membership_insert_guard','QcMeasurement_insert_guard')").get().n;
        if (guardCount !== 3) throw Error('QC fixture translation requires active release guards.');
        if (db.prepare('SELECT count(*) n FROM "BatchAnalyte" WHERE batchId=?').get(batchId).n) throw Error('QC fixture already has normalized analytes.');
        const plan = inventoryLegacyQcRuns(db);
        const refused = plan.refusals.filter(row => row.batchId === batchId);
        if (refused.length) throw Error(`The reviewed importer refused this historical QC fixture: ${JSON.stringify(refused)}`);
        const positions = plan.rows.BatchPosition.filter(row => row.batchId === batchId), ids = new Set(positions.map(row => row.id));
        const analytes = plan.rows.BatchAnalyte.filter(row => row.batchId === batchId);
        if (analytes.length !== 1) throw Error('Use an actual pre-migration database for a multi-analyte legacy fixture.');
        // Physical membership precedes the immutable legacy analyte freeze;
        // observations follow it. No guard is dropped, skipped or weakened.
        planned = { rows: plan.rows, ids };
    } finally { db.close(); }
    const order = ['BatchPosition', 'BatchPositionWorkItem', 'BatchAnalyte', 'BatchPositionReference', 'QcMeasurement', 'QcEvaluation', 'BatchDisposition', 'BatchEvent'];
    await client.$transaction(async tx => {
        for (const table of order) for (const row of planned.rows[table].filter(row => row.batchId === batchId || planned.ids.has(row.positionId))) {
            const keys = Object.keys(row);
            await tx.$executeRawUnsafe(`INSERT INTO "${table}" (${keys.map(key => `"${key}"`).join(',')}) VALUES (${keys.map(() => '?').join(',')})`, ...keys.map(key => row[key]));
        }
    });
    installCalculationReleasePrerequisites(file);
}
module.exports = { normalizeLegacyQcFixture };
