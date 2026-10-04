const fs = require('node:fs');
const path = require('node:path');
const { randomUUID } = require('node:crypto');
const Database = require('better-sqlite3');
const { PrismaClient } = require('../../prisma_client');
const { PrismaBetterSqlite3 } = require('@prisma/adapter-better-sqlite3');
const samples = require('../../services/sampleStateService');
const work = require('../../services/workItemStateService');
const evidence = require('../../services/resultEvidenceService');
const rules = require('../../services/workflowStateRules');
const migration = require('../../services/statusMigrationPlan');
const manager = { username: 'audit-state-manager', role: 'LAB_MANAGER', labId: 'AUDIT-STATE' };
const technician = { username: 'audit-state-tech', role: 'LAB_TECHNICIAN', labId: manager.labId };
const id = () => randomUUID();
let client, databasePath;
const ddl = fs.readFileSync(path.resolve(__dirname, '../../prisma/migrations/20261005000000_workflow_state_evidence/migration.sql'), 'utf8');

// Build a schema-only, disposable pre-migration database. No template data is
// copied and no production constraints are dropped or disabled. This exercises
// the exact additive release SQL, including legacy rows present before release.
beforeAll(async () => {
    databasePath = path.resolve(__dirname, '../.tmp', `audit_1_2_${id()}.db`);
    const source = new Database(process.env.DATABASE_PATH, { readonly: true, fileMustExist: true });
    const definitions = source.prepare("SELECT name, sql FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_prisma_%'").all();
    source.close();
    const db = new Database(databasePath);
    try {
        db.pragma('foreign_keys = ON');
        for (const table of definitions.filter(row => row.name !== 'ResultEvidenceEvent')) {
            const sql = ['Sample', 'WorkItem'].includes(table.name)
                ? table.sql.replace(/^\s*"(?:holdPriorStatus|legacyStatus)"\s+TEXT,?\s*$/gm, '') : table.sql;
            db.exec(sql);
        }
        const now = Date.now();
        for (const [sampleId, status, history] of [
            ['legacy-collected', 'COLLECTED', null], ['legacy-released', 'RELEASED', null],
            ['legacy-unmapped', 'VALIDATED', null], ['hold-history', 'ON_HOLD', '[{"status":"PROCESSING"},{"status":"ON_HOLD"}]'],
            ['hold-unknown', 'ON_HOLD', 'broken history']
        ]) db.prepare('INSERT INTO Sample (id, originalId, status, assignedLab, history, updatedAt, createdAt) VALUES (?,?,?,?,?,?,?)')
            .run(sampleId, sampleId, status, manager.labId, history, now, now);
        db.prepare('INSERT INTO WorkItem (id, sampleId, analysis, status, updatedAt, createdAt) VALUES (?,?,?,?,?,?)')
            .run('legacy-pending', 'legacy-collected', 'PH_H2O', 'PENDING', now, now);
        db.exec(ddl);
    } finally { db.close(); }
    client = new PrismaClient({ adapter: new PrismaBetterSqlite3({ url: `file:${databasePath}` }) });
});

afterAll(async () => {
    await client?.$disconnect();
    const owned = path.resolve(__dirname, '../.tmp');
    if (databasePath && path.dirname(databasePath) === owned && path.basename(databasePath).startsWith('audit_1_2_')) {
        for (const suffix of ['', '-wal', '-shm']) fs.rmSync(`${databasePath}${suffix}`, { force: true });
    }
});

async function fixture(status = 'PROCESSING', analysis = 'PH_H2O', itemStatus = 'IN_PROGRESS') {
    const sample = await samples.createSample({ id: id(), originalId: id(), status, assignedLab: manager.labId,
        dryingStatus: 'DONE', preparationStatus: 'DONE' }, 'system:fixture', { context: 'fixture', tx: client });
    const item = await work.createWorkItem({ id: id(), sampleId: sample.id, analysis, status: itemStatus, assignedLab: manager.labId },
        'system:fixture', { context: 'fixture', tx: client });
    return { sample, item };
}

async function snapshot(sampleId) {
    return {
        sample: await client.sample.findUnique({ where: { id: sampleId } }),
        items: await client.workItem.findMany({ where: { sampleId }, orderBy: { id: 'asc' } }),
        results: await client.result.findMany({ where: { sampleId }, orderBy: { id: 'asc' } }),
        events: await client.resultEvidenceEvent.findMany({ where: { sampleId }, orderBy: { id: 'asc' } }),
        audits: await client.auditLog.findMany({ where: { sampleId }, orderBy: { id: 'asc' } })
    };
}

test('ordinary creation refuses advanced states before any write, and logs canonical creation', async () => {
    const sampleId = id();
    await expect(samples.createSample({ id: sampleId, originalId: sampleId, status: 'APPROVED', assignedLab: manager.labId }, manager, { tx: client }))
        .rejects.toMatchObject({ code: 'INITIAL_STATE_NOT_ALLOWED', statusCode: 409 });
    expect(await client.sample.count({ where: { id: sampleId } })).toBe(0);
    expect(await client.auditLog.count({ where: { entityId: sampleId } })).toBe(0);
    const sample = await samples.createSample({ id: sampleId, originalId: sampleId, assignedLab: manager.labId }, manager, { tx: client });
    expect(sample.status).toBe('EXPECTED');
    await expect(work.createWorkItem({ id: id(), sampleId, analysis: 'PH_H2O', status: 'ASSIGNED' }, manager, { tx: client }))
        .rejects.toMatchObject({ code: 'INITIAL_STATE_NOT_ALLOWED' });
    const item = await work.createWorkItem({ id: id(), sampleId, analysis: 'PH_H2O' }, manager, { tx: client });
    expect(item.status).toBe('NOT_ASSIGNED');
    expect(await client.auditLog.count({ where: { sampleId } })).toBe(2);
});

test('historical creation keeps provenance and importer identity without inventing a reviewer', async () => {
    const sampleId = id();
    const data = { id: sampleId, originalId: sampleId, assignedLab: manager.labId, status: 'APPROVED', receptionData: '{"isLegacy":true}' };
    const sample = await samples.createSample(data, 'system:legacy-import', { context: 'legacy-import', importingUser: manager, tx: client });
    expect(sample).toMatchObject({ status: 'APPROVED', approvedBy: null, approvedAt: null });
    const audit = await client.auditLog.findFirst({ where: { entityId: sampleId } });
    expect(audit.performedBy).toBe('system:legacy-import');
    expect(JSON.parse(audit.details).importingUser).toBe(manager.username);
    await expect(samples.createSample({ ...data, id: id(), originalId: id(), approvedBy: manager.username }, 'system:legacy-import',
        { context: 'legacy-import', importingUser: manager, tx: client })).rejects.toMatchObject({ code: 'LEGACY_IMPORT_APPROVAL_REFUSED' });
    await expect(samples.createSample({ ...data, id: id(), originalId: id() }, 'system:legacy-import',
        { context: 'legacy-import', importingUser: technician, tx: client })).rejects.toMatchObject({ code: 'LEGACY_IMPORT_NOT_AUTHORIZED' });
});

test('fixture guards refuse missing flags, production paths and the working database', () => {
    expect(() => rules.assertFixtureContext({ DATABASE_PATH: '/tmp/isolated.db' })).toThrow('explicitly isolated');
    expect(() => rules.assertFixtureContext({ ALLOW_WORKFLOW_FIXTURES: '1', DATABASE_PATH: '/tmp/isolated.db' })).toThrow('explicitly isolated');
    expect(() => rules.assertFixtureContext({ NODE_ENV: 'test', DATABASE_PATH: '/production/live.db', PRODUCTION_DATABASE_PATH: '/production/live.db' })).toThrow('explicitly isolated');
    expect(() => rules.assertFixtureContext({ NODE_ENV: 'test', DATABASE_PATH: path.resolve(__dirname, '../../prisma/dev.db') })).toThrow('explicitly isolated');
    expect(() => rules.assertFixtureContext({ ALLOW_WORKFLOW_FIXTURES: '1', DATABASE_PATH: '/tmp/isolated.db', PRODUCTION_DATABASE_PATH: '/production/live.db' })).not.toThrow();
});

test.each(['APPROVED', 'ARCHIVED', 'DISPOSED', 'CANCELLED'])('final %s cannot return to processing, with no changes', async status => {
    const { sample } = await fixture(status);
    const before = await snapshot(sample.id);
    await expect(samples.transitionSample(sample.id, 'PROCESSING', manager, 'Attempted reopen', {}, client))
        .rejects.toMatchObject({ code: 'ILLEGAL_STATUS_TRANSITION', statusCode: 409 });
    expect(await snapshot(sample.id)).toEqual(before);
});

test('sample and work-item holds require reasons and can restore only the recorded prior status', async () => {
    const { sample, item } = await fixture();
    const before = await snapshot(sample.id);
    await expect(samples.transitionSample(sample.id, 'ON_HOLD', manager, ' ', {}, client)).rejects.toMatchObject({ code: 'TRANSITION_REASON_REQUIRED' });
    expect(await snapshot(sample.id)).toEqual(before);
    const held = await samples.transitionSample(sample.id, 'ON_HOLD', manager, 'Instrument unavailable', {}, client);
    expect(held.holdPriorStatus).toBe('PROCESSING');
    await expect(samples.transitionSample(sample.id, 'ACCEPTED', manager, 'Restart intake', {}, client)).rejects.toMatchObject({ code: 'HOLD_PRIOR_STATUS_REQUIRED' });
    expect((await samples.transitionSample(sample.id, 'PROCESSING', manager, 'Instrument available', {}, client)).holdPriorStatus).toBeNull();
    expect((await work.transitionWorkItem(item.id, 'ON_HOLD', manager, 'Waiting for reagent', {}, client)).holdPriorStatus).toBe('IN_PROGRESS');
    await expect(work.transitionWorkItem(item.id, 'ASSIGNED', manager, 'Resume', {}, client)).rejects.toMatchObject({ code: 'HOLD_PRIOR_STATUS_REQUIRED' });
    expect((await work.transitionWorkItem(item.id, 'IN_PROGRESS', manager, 'Reagent delivered', {}, client)).holdPriorStatus).toBeNull();
});

test('legacy holds recover from history or a scoped manager choice, never a technician guess', async () => {
    expect((await samples.transitionSample('hold-history', 'PROCESSING', manager, 'History reviewed', {}, client)).holdPriorStatus).toBeNull();
    const before = await snapshot('hold-unknown');
    await expect(samples.transitionSample('hold-unknown', 'PROCESSING', technician, 'Guess', {}, client)).rejects.toMatchObject({ code: 'HOLD_RECOVERY_REQUIRED' });
    expect(await snapshot('hold-unknown')).toEqual(before);
    expect((await samples.transitionSample('hold-unknown', 'ACCEPTED', manager, 'Legacy hold recovery reviewed', {}, client)).status).toBe('ACCEPTED');
});

test('stale work-item version refuses all status, history and audit writes', async () => {
    const { sample, item } = await fixture();
    await client.workItem.update({ where: { id: item.id }, data: { version: { increment: 1 } } });
    const before = await snapshot(sample.id);
    await expect(work.transitionWorkItem(item.id, 'COMPLETED', technician, 'Completed', {}, client, { expected: item }))
        .rejects.toMatchObject({ code: 'WORKITEM_STATE_CHANGED' });
    expect(await snapshot(sample.id)).toEqual(before);
});

test('scope refusal and status/provenance override refusal write nothing', async () => {
    const { sample, item } = await fixture();
    const before = await snapshot(sample.id);
    await expect(samples.transitionSample(sample.id, 'SUBMITTED_FULL', { ...manager, labId: 'OTHER-LAB' }, null, {}, client)).rejects.toMatchObject({ statusCode: 403 });
    await expect(samples.transitionSample(sample.id, 'SUBMITTED_FULL', manager, null, { status: 'ARCHIVED' }, client)).rejects.toMatchObject({ code: 'STATUS_OVERRIDE_REFUSED' });
    await expect(work.transitionWorkItem(item.id, 'COMPLETED', technician, null, { holdPriorStatus: 'ASSIGNED' }, client)).rejects.toMatchObject({ code: 'STATE_METADATA_NOT_ALLOWED' });
    expect(await snapshot(sample.id)).toEqual(before);
});

test('operational verification is action-bound; ordinary status writes cannot bypass it', async () => {
    const { sample, item } = await fixture('ACCEPTED', 'DRYING', 'NOT_ASSIGNED');
    const before = await snapshot(sample.id);
    await expect(work.transitionWorkItem(item.id, 'COMPLETED', technician, 'No checklist', {}, client)).rejects.toMatchObject({ code: 'OPERATIONAL_CONFIRMATION_REQUIRED' });
    await expect(work.transitionWorkItem(item.id, 'AWAITING_VERIFICATION', technician, 'Unconfigured', {}, client)).rejects.toMatchObject({ code: 'OPERATIONAL_VERIFICATION_REQUIRED' });
    expect(await snapshot(sample.id)).toEqual(before);
    await work.transitionWorkItem(item.id, 'AWAITING_VERIFICATION', technician, 'SOP confirmation', {}, client,
        { action: 'OPERATION_CONFIRMED', verificationRequired: true });
    await expect(work.transitionWorkItem(item.id, 'WAIVED', manager, 'Skip', {}, client)).rejects.toMatchObject({ code: 'OPERATIONAL_VERIFICATION_REQUIRED' });
    expect((await work.transitionWorkItem(item.id, 'COMPLETED', manager, 'Verified', {}, client,
        { action: 'OPERATION_VERIFIED', decision: 'ACCEPT' })).status).toBe('COMPLETED');
    await expect(work.transitionWorkItem(item.id, 'COMPLETED', manager, 'Duplicate verification', {}, client,
        { action: 'OPERATION_VERIFIED', decision: 'ACCEPT' })).rejects.toMatchObject({ code: 'WORKITEM_NOT_AWAITING_VERIFICATION' });
});

test('the reviewed legacy plan preserves original values and reverts once; unmapped rows remain unchanged', async () => {
    for (const [entity, entityId, target] of [['Sample', 'legacy-collected', 'EXPECTED'], ['WorkItem', 'legacy-pending', 'NOT_ASSIGNED']]) {
        const model = entity === 'Sample' ? client.sample : client.workItem;
        const transition = entity === 'Sample' ? samples.transitionSample : work.transitionWorkItem;
        const original = await model.findUnique({ where: { id: entityId } });
        const plan = { direction: 'apply', rows: [{ entity, id: entityId, from: original.status, to: target, legacyStatus: null, updatedAt: original.updatedAt, version: original.version }] };
        const reviewed = migration.reviewPlan(plan, migration.planFingerprint(plan));
        await transition(entityId, target, 'system:status-migration', 'Reviewed legacy migration', {}, client, { migrationPlan: reviewed });
        const changed = await model.findUnique({ where: { id: entityId } });
        expect(changed.legacyStatus).toBe(original.status);
        await expect(transition(entityId, original.status, manager, 'Unreviewed revert', {}, client)).rejects.toMatchObject({ code: 'ILLEGAL_LEGACY_STATUS' });
        const revert = { direction: 'revert', rows: [{ entity, id: entityId, from: target, to: original.status, legacyStatus: original.status, updatedAt: changed.updatedAt, version: changed.version }] };
        const reviewedRevert = migration.reviewPlan(revert, migration.planFingerprint(revert));
        await transition(entityId, original.status, 'system:status-migration', 'Reviewed exact restoration', {}, client, { migrationPlan: reviewedRevert });
        expect(await model.findUnique({ where: { id: entityId } })).toMatchObject({ status: original.status, legacyStatus: null });
        await expect(transition(entityId, original.status, 'system:status-migration', 'Second restore', {}, client,
            { migrationPlan: reviewedRevert })).rejects.toMatchObject({ code: 'STATUS_MIGRATION_PLAN_STALE' });
        expect(await client.auditLog.count({ where: { entityId, performedBy: 'system:status-migration' } })).toBe(2);
    }
    expect((await client.sample.findUnique({ where: { id: 'legacy-unmapped' } })).status).toBe('VALIDATED');
    await expect(client.sample.update({ where: { id: 'legacy-unmapped' }, data: { status: 'COLLECTED' } })).rejects.toThrow('INVALID_SAMPLE_STATUS');
    expect((await client.sample.update({ where: { id: 'legacy-unmapped' }, data: { clientName: 'Metadata update' } })).status).toBe('VALIDATED');
});

test('migration fingerprint and row CAS refuse a modified plan or changed row', async () => {
    const row = await client.sample.findUnique({ where: { id: 'legacy-released' } });
    const plan = { direction: 'apply', rows: [{ entity: 'Sample', id: row.id, from: row.status, to: 'APPROVED', legacyStatus: null, updatedAt: row.updatedAt }] };
    expect(() => migration.reviewPlan({ ...plan, rows: [{ ...plan.rows[0], to: 'PROCESSING' }] }, migration.planFingerprint(plan)))
        .toThrow('fingerprint does not match');
    const reviewed = migration.reviewPlan(plan, migration.planFingerprint(plan));
    await client.sample.update({ where: { id: row.id }, data: { clientName: 'Concurrent edit' } });
    const before = await snapshot(row.id);
    await expect(samples.transitionSample(row.id, 'APPROVED', 'system:status-migration', 'Stale review', {}, client, { migrationPlan: reviewed }))
        .rejects.toMatchObject({ code: 'STATUS_MIGRATION_PLAN_STALE' });
    expect(await snapshot(row.id)).toEqual(before);
});

test('preparation reverts preserve scientific values and block review until a valid manager clearance', async () => {
    const { sample, item } = await fixture('PROCESSING', 'PH_H2O', 'COMPLETED');
    const result = await client.result.create({ data: { id: id(), sampleId: sample.id, param: 'PH_H2O', value: '6.42', numericValue: 6.42,
        flags: '["QC_WARN"]', unit: 'pH_units', isCurrent: true } });
    await client.$transaction(async tx => {
        expect(await evidence.recordPreparationRevert(tx, sample, 'PREPARATION', 'Material prepared again', manager)).toBe(1);
        await tx.sample.update({ where: { id: sample.id }, data: { preparationStatus: 'PENDING' } });
    });
    const before = await snapshot(sample.id);
    await expect(work.transitionWorkItem(item.id, 'SUBMITTED', technician, 'Submit', {}, client)).rejects.toMatchObject({ code: 'PREP_REVERTED_RESULTS' });
    await expect(samples.transitionSample(sample.id, 'APPROVED', manager, 'Approve', {}, client)).rejects.toMatchObject({ code: 'PREP_REVERTED_RESULTS' });
    await expect(evidence.clearPreparationRevert(sample.id, result.id, 'PREPARATION', 'Reviewed', manager, client)).rejects.toMatchObject({ code: 'GATE_NOT_DONE' });
    expect(await snapshot(sample.id)).toEqual(before);
    await client.sample.update({ where: { id: sample.id }, data: { preparationStatus: 'DONE' } });
    await expect(evidence.clearPreparationRevert(sample.id, result.id, 'PREPARATION', 'Reviewed', technician, client)).rejects.toMatchObject({ code: 'PREPARATION_CLEARANCE_FORBIDDEN' });
    expect((await evidence.clearPreparationRevert(sample.id, result.id, 'PREPARATION', 'Reprepared material verified', manager, client)).cleared).toBe(true);
    await evidence.assertNoPreparationRevert(client, sample.id);
    expect(await client.result.findUnique({ where: { id: result.id } })).toEqual(result);
    const event = await client.resultEvidenceEvent.findFirst({ where: { resultId: result.id } });
    await expect(client.resultEvidenceEvent.update({ where: { id: event.id }, data: { reason: 'Overwritten' } })).rejects.toThrow('RESULT_EVIDENCE_IMMUTABLE');
    await expect(client.resultEvidenceEvent.delete({ where: { id: event.id } })).rejects.toThrow('RESULT_EVIDENCE_IMMUTABLE');
});

test('superseding a reverted result clears only the current-result block, retaining all old evidence', async () => {
    const { sample } = await fixture();
    const old = await client.result.create({ data: { id: id(), sampleId: sample.id, param: 'PH_H2O', value: '6.2' } });
    await evidence.recordPreparationRevert(client, sample, 'DRYING', 'Drying repeated', manager);
    const replacementId = id();
    await client.$transaction(async tx => {
        await tx.result.update({ where: { id: old.id }, data: { isCurrent: false, supersededBy: replacementId } });
        await tx.result.create({ data: { id: replacementId, sampleId: sample.id, param: 'PH_H2O', value: '6.3' } });
    });
    await evidence.assertNoPreparationRevert(client, sample.id);
    expect(await client.resultEvidenceEvent.count({ where: { resultId: old.id } })).toBe(1);
    expect((await client.result.findUnique({ where: { id: old.id } })).value).toBe('6.2');
});

test('state and audit roll back together when a subsequent transaction operation fails', async () => {
    const { sample } = await fixture();
    const before = await snapshot(sample.id);
    await expect(client.$transaction(async tx => {
        await samples.transitionSample(sample.id, 'ON_HOLD', manager, 'Hold pending review', {}, tx);
        throw new Error('Injected later-operation failure');
    })).rejects.toThrow('Injected later-operation failure');
    expect(await snapshot(sample.id)).toEqual(before);
});
