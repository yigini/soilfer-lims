const fs = require('node:fs');
const path = require('node:path');
const { randomUUID } = require('node:crypto');
const { PrismaClient } = require('../../prisma_client');
const { PrismaBetterSqlite3 } = require('@prisma/adapter-better-sqlite3');
const { createSampleFixture, createWorkItemFixture } = require('./workflowFixtures');
const { beforeGuards } = require('./legacyWorkflowDatabase');

// A new owned database from the current public schema, never a retained payload.
// It has no application migrations to compare: this fixture exercises reads only.
async function issue204QueueFixture(count, onDatabase) {
    const directory = path.resolve(__dirname, '../.tmp');
    fs.mkdirSync(directory, { recursive: true });
    const file = path.join(directory, `issue204_queue_${randomUUID()}.db`);
    const previousPath = process.env.DATABASE_PATH;
    // The existing bootstrap refuses the configured path, so give it a new,
    // unused test-context path while it creates a separate new owned file.
    process.env.DATABASE_PATH = path.join(directory, `issue204_context_${randomUUID()}.db`);
    let db;
    try {
        beforeGuards({ actor: 'system:fixture', file, qcBootstrap: 'CREATE_PRISMA' });
        let queries = 0;
        db = new PrismaClient({ adapter: new PrismaBetterSqlite3({ url: `file:${file}` }),
            log: [{ emit: 'event', level: 'query' }] });
        db.$on('query', () => { queries++; });
        onDatabase(db);
        const { createExecutionResultFixture } = require('./workAttemptFixtures');
        process.env.DATABASE_PATH = file;
        const labId = 'ISSUE204-LAB', username = 'system:fixture';
        const actor = { id: username, username, role: 'LAB_MANAGER', labId, isActive: true };
        await db.lab.create({ data: { id: labId, code: labId, name: 'Queue read fixture', country: 'TEST' } });
        await db.user.create({ data: { ...actor, password: 'fixture', email: 'issue204@example.test' } });
        await db.analysisCategory.create({ data: { id: 'issue204-category', name: 'Chemistry' } });
        const codes = ['ISSUE204_NUMERIC', 'PH_H2O', 'SOIL_TEXTURE', 'SPEC_MIR', 'DRYING'];
        for (const code of codes) {
            await db.analysis.create({ data: { code, name: `Queue ${code}`, units: 'fixture-unit',
                categoryId: 'issue204-category', status: 'active', prerequisites: '[]' } });
            await db.methodology.create({ data: { id: `method-${code}`, analysisCode: code,
                name: `Method ${code}`, standard: 'Synthetic queue contract', loq: code === 'PH_H2O' ? 0.2 : 0.1 } });
        }
        const singleMethod = 'method-ISSUE204_SINGLE';
        await db.methodology.create({ data: { id: singleMethod, analysisCode: codes[0], name: 'Single-reading method', loq: 0.3 } });
        await db.labPolicy.create({ data: { id: 'issue204-policy', labId, version: 1, updatedBy: username } });
        for (const [key, value] of [['results.replicatesRequired', 2], ['equipment.requireEquipment', 'NOT_REQUIRED']]) {
            await db.labPolicyOverride.create({ data: { id: `override-${key}`, labId, key, value: JSON.stringify(value),
                reason: 'Synthetic queue read fixture', setBy: username } });
        }
        await db.labPolicyOverride.create({ data: { id: 'single-reading-override', labId, key: 'results.replicatesRequired',
            analysisCode: codes[0], methodologyId: singleMethod, value: '1', reason: 'Single-reading fixture scope', setBy: username } });
        for (const suffix of ['item', 'run']) {
            await db.equipmentAsset.create({ data: { id: `equipment-${suffix}`, labId, name: `Fixture ${suffix}`,
                assetType: 'OTHER', status: 'IN_SERVICE', criticality: 'NON_CRITICAL' } });
            await db.equipmentQualification.create({ data: { id: `qualification-${suffix}`, equipmentId: `equipment-${suffix}`,
                labId, calibrationStatus: 'OK', verificationStatus: 'OK',
                nextCalibrationDueDate: new Date('2035-01-01'), nextVerificationDueDate: new Date('2035-01-01') } });
        }
        const frozen = { methodRevision: 'fixture-revision', methodContext: { methodologyId: 'method-ISSUE204_NUMERIC',
            loq: 0.1, loqSource: 'METHODOLOGY' }, numberFormat: { decimal: '.', thousands: ',' },
        policySnapshot: { values: { 'results.replicatesRequired': 2, 'qc.duplicateNearLoqMultiplier': 5 } },
        qcRule: { resolved: { duplicateMode: { value: 'RPD' }, duplicateRpdMax: { value: 10 },
            duplicateAbsMax: { value: null }, duplicateAbsMaxBelow5LOQ: { value: null } } } };
        await db.batch.create({ data: { id: 'issue204-run', labId, analysis: codes[0], createdBy: username,
            instrumentId: 'equipment-run', startedAt: new Date('2026-10-01'), status: 'RUNNING' } });
        await db.batchAnalyte.create({ data: { id: 'issue204-analyte', batchId: 'issue204-run', labId,
            analysisCode: codes[0], methodologyId: `method-${codes[0]}`, provenance: 'NATIVE', status: 'PENDING',
            criteriaSnapshot: JSON.stringify(frozen) } });
        const items = [];
        for (let index = 0; index < count; index++) {
            const kind = index % 10;
            const code = kind === 2 ? 'SOIL_TEXTURE' : kind === 3 ? 'SPEC_MIR' : kind === 4 ? 'DRYING'
                : kind === 9 ? 'PH_H2O' : codes[0];
            const status = kind === 5 || kind === 6 ? 'COMPLETED' : kind === 7 ? 'SUBMITTED'
                : kind === 8 ? 'ACCEPTED' : kind === 9 ? 'REPEAT_REQUIRED' : kind === 1 ? 'IN_PROGRESS' : 'ASSIGNED';
            const sample = await createSampleFixture(db, { data: { id: `sample-${index}`, originalId: `${index % 5 === 0 ? 'needle' : 'queue'}-${index}`,
                assignedLab: labId, status: 'PROCESSING', dryingStatus: 'DONE', preparationStatus: 'DONE', country: 'TEST' } });
            const item = await createWorkItemFixture(db, { data: { id: `item-${index}`, sampleId: sample.id, assignedLab: labId,
                labId, analysis: code, methodologyId: kind === 6 ? singleMethod : `method-${code}`, assignedTo: username, status,
                equipmentId: 'equipment-item', batchId: kind === 0 ? 'issue204-run' : null,
                rackPosition: index % 3 ? null : index, priority: index % 2 ? 'HIGH' : 'NORMAL',
                createdAt: new Date(Date.UTC(2026, 9, 1, 0, index)) } });
            items.push(item);
            if ([5, 6, 7, 8].includes(kind)) {
                const attemptStatus = kind === 7 ? 'SUBMITTED' : kind === 8 ? 'ACCEPTED' : 'RECORDED';
                await db.$transaction(tx => require('../../services/orderService').createInitialOrder(tx, sample, [code], actor));
                await createExecutionResultFixture(db, { attemptStatus, data: { id: `result-${index}-1`, sampleId: sample.id,
                    param: code, value: '10', numericValue: 10, methodologyId: item.methodologyId, replicateNo: 1,
                    isCurrent: true, isValid: true, flags: kind === 5 ? '["ABOVE_RANGE"]' : '[]',
                    equipmentId: 'equipment-item', unit: 'fixture-unit' } });
            }
            if (kind === 3) await db.spectralData.create({ data: { id: `spectrum-${index}`, sampleId: sample.id,
                workItemId: item.id, labId, modality: 'MIR', filename: 'synthetic.csv', status: 'APPROVED', qcStatus: 'PASS' } });
            if ([1, 2, 4].includes(kind)) await db.workItemDraft.create({ data: { id: `draft-${index}`, workItemId: item.id,
                sampleId: sample.id, userId: username, labId, analysis: code, value: kind === 1 ? '9.1' : null,
                values: kind === 2 ? '["40","40","20"]' : null, checks: kind === 4 ? '[true,false]' : null } });
        }
        return { db, file, actor, items, resetQueries: () => { queries = 0; }, queryCount: () => queries,
            // Retain the new owned fixture; never inspect or clean previous fixtures.
            close: () => db.$disconnect() };
    } catch (error) {
        if (db) await db.$disconnect();
        throw error;
    } finally {
        if (previousPath === undefined) delete process.env.DATABASE_PATH;
        else process.env.DATABASE_PATH = previousPath;
    }
}

module.exports = { issue204QueueFixture };
