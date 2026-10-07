const fs = require('node:fs');
const path = require('node:path');
const { randomUUID } = require('node:crypto');
const Database = require('better-sqlite3');
const { PrismaClient } = require('../../prisma_client');
const { PrismaBetterSqlite3 } = require('@prisma/adapter-better-sqlite3');
const { beforeGuards } = require('./legacyWorkflowDatabase');
const { createSampleFixture, createWorkItemFixture } = require('./workflowFixtures');

async function qcGateFixture({ count = 1, criteria = {}, status = 'IN_PROGRESS', sharedSample = false, resolvedRules = true } = {}) {
    const labId = randomUUID(), analysisCode = `QC-GATE-${randomUUID()}`, username = 'system:fixture';
    const historical = beforeGuards({ actor: username, schemaVariant: 'PRE_1_3_SAMPLE_CODES', relatedRows: {
        Lab: [{ id: labId, code: labId, name: 'QC gate fixture', country: 'TEST', updatedAt: Date.now() }],
        User: [{ id: username, username, email: 'qc-gate@example.test', password: 'fixture', role: 'SUPER_ADMIN', updatedAt: Date.now() }]
    } });
    const { file } = historical;
    historical.applyPendingMigration({ migration: 'SAMPLE_CODES' });
    const connection = new Database(file, { fileMustExist: true });
    try { connection.exec('CREATE TABLE "_schema_migrations" ("id" TEXT PRIMARY KEY NOT NULL,"appliedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,"details" TEXT)'); }
    finally { connection.close(); }
    for (const [script, method] of [['install_result_attempt_links', 'installResultAttemptLinks'], ['install_sample_holds', 'installSampleHolds'],
        ['install_reference_materials', 'installReferenceMaterials'], ['install_qc_rules', 'installQcRules'], ['install_qc_runs', 'installQcRuns'],
        ['install_qc_gate_scope', 'installQcGateScope']]) require(`../../scripts/${script}`)[method]({ dbPath: file, apply: true });
    const db = new PrismaClient({ adapter: new PrismaBetterSqlite3({ url: `file:${file}` }) });
    const actor = { username, role: 'SUPER_ADMIN', labId };
    await db.unit.create({ data: { code: 'fixture-unit', display: 'Fixture unit', quantityKind: 'MASS_FRACTION', factorToBase: 1 } });
    const instrument = await db.equipmentAsset.create({ data: { id: randomUUID(), labId, name: 'Fixture instrument', assetType: 'OTHER',
        status: 'IN_SERVICE', criticality: 'NON_CRITICAL' } });
    const items = [], methods = [];
    let sample;
    for (let i = 0; i < count; i++) {
        const code = sharedSample ? `${analysisCode}-${i}` : analysisCode;
        let method = methods.find(row => row.analysisCode === code);
        if (!method) {
            await db.analysis.create({ data: { code, name: 'QC gate analyte', unitCode: 'fixture-unit' } });
            method = await db.methodology.create({ data: { analysisCode: code, name: 'QC gate method', loq: 0.1 } });
            if (resolvedRules) await require('../../services/qcRuleService').change(actor, { labId, analysisCode: code, methodologyId: method.id,
                criteria: { crmEveryNBatches: 0, ...criteria }, expectedVersion: 0, reason: 'Reviewed fixture criteria' }, { db });
            methods.push(method);
        }
        if (!sample || !sharedSample) sample = await createSampleFixture(db, { data: { id: randomUUID(), originalId: randomUUID(),
            assignedLab: labId, status: 'PROCESSING', receptionDate: new Date(), dryingStatus: 'DONE', preparationStatus: 'DONE' } });
        items.push(await createWorkItemFixture(db, { data: { id: randomUUID(), sampleId: sample.id, labId, analysis: code,
            methodologyId: method.id, status, result: '7', history: '[]' } }));
    }
    const f = { file, db, actor, labId, analysisCode: items[0].analysis, method: methods[0], methods, instrument, items,
        workItemIds: items.map(item => item.id), input: { instrumentId: instrument.id, workItemIds: items.map(item => item.id), seed: 'gate-fixture' } };
    f.setPolicy = changes => require('../../services/policyService').change(actor, labId, { reason: 'Reviewed test policy', changes }, { db });
    f.result = item => require('../../services/resultWriteService').createResultFixture(db, { data: { id: randomUUID(), sampleId: item.sampleId,
        param: item.analysis, methodologyId: item.methodologyId, batchId: item.batchId, value: '7.123456789', numericValue: 7.123456789,
        isCurrent: true, isValid: true, flags: '[]', unit: 'fixture-unit' } });
    f.snapshot = async () => JSON.parse(JSON.stringify(await Promise.all([
        db.workItem.findMany({ orderBy: { id: 'asc' } }), db.result.findMany({ orderBy: { id: 'asc' } }),
        db.sample.findMany({ orderBy: { id: 'asc' } }), db.submission.findMany({ orderBy: { id: 'asc' } }),
        db.reviewDecision.findMany({ orderBy: { id: 'asc' } }), db.auditLog.findMany({ orderBy: { id: 'asc' } }),
        db.report.findMany({ orderBy: { id: 'asc' } }), db.batchDisposition.findMany({ orderBy: { id: 'asc' } }),
        db.batchEvent.findMany({ orderBy: { id: 'asc' } })])));
    f.close = async () => {
        await db.$disconnect();
        if (path.dirname(file) !== path.resolve(__dirname, '../.tmp') || !path.basename(file).startsWith('audit_legacy_')) throw Error('Fixture cleanup requires its owned path.');
        for (const suffix of ['', '-wal', '-shm']) if (fs.existsSync(file + suffix)) fs.unlinkSync(file + suffix);
    };
    return f;
}
module.exports = { qcGateFixture };
