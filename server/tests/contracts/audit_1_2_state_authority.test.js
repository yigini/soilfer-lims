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
const operations = require('../../services/operationalConfirmationService');
const gates = require('../../services/operationalGateStateService');
const policyService = require('../../services/policyService');
const { registry } = require('../../config/policyRegistry');
const manager = { username: 'audit-state-manager', role: 'LAB_MANAGER', labId: 'AUDIT-STATE' };
const technician = { username: 'audit-state-tech', role: 'LAB_TECHNICIAN', labId: manager.labId };
const id = () => randomUUID();
let client, databasePath;
const ddl = ['20261005000000_workflow_state_evidence', '20261005000100_workflow_state_guards']
    .map(name => fs.readFileSync(path.resolve(__dirname, '../../prisma/migrations', name, 'migration.sql'), 'utf8')).join('\n');

// Build a schema-only, disposable pre-migration database. No template data is
// copied and no production constraints are dropped or disabled. This exercises
// the exact additive release SQL, including legacy rows present before release.
beforeAll(async () => {
    databasePath = path.resolve(__dirname, '../.tmp', `audit_1_2_${id()}.db`);
    const source = new Database(process.env.DATABASE_PATH, { readonly: true, fileMustExist: true });
    const definitions = source.prepare("SELECT name, sql FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_prisma_%'").all();
    const indexes = source.prepare("SELECT sql FROM sqlite_master WHERE type='index' AND sql IS NOT NULL AND tbl_name != 'ResultEvidenceEvent'").all();
    source.close();
    const db = new Database(databasePath);
    try {
        db.pragma('foreign_keys = ON');
        for (const table of definitions.filter(row => row.name !== 'ResultEvidenceEvent')) {
            const sql = ['Sample', 'WorkItem'].includes(table.name)
                ? table.sql.replace(/,\s*"(?:holdPriorStatus|legacyStatus)"\s+TEXT(?=\s*[,)])/g, '') : table.sql;
            db.exec(sql);
        }
        for (const index of indexes) db.exec(index.sql);
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
    await client.lab.create({ data: { id: manager.labId, code: manager.labId, name: 'Isolated workflow laboratory', country: 'TEST' } });
    for (const user of [manager, technician]) await client.user.create({ data: { id: user.username, username: user.username,
        email: `${user.username}@example.test`, password: 'isolated-fixture', role: user.role, labId: user.labId } });
    for (const code of ['DRYING', 'PREPARATION', 'PH_H2O']) await client.analysis.create({ data: { code, name: code } });
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
    await expect(rules.inTransaction(client, tx => tx.sample.update({ where: { id: 'legacy-unmapped' }, data: { status: 'COLLECTED' } })))
        .rejects.toMatchObject({ statusCode: 409, code: 'INVALID_SAMPLE_STATUS' });
    expect((await client.sample.update({ where: { id: 'legacy-unmapped' }, data: { clientName: 'Metadata update' } })).status).toBe('VALIDATED');
});

test('migration fingerprint and row CAS refuse a modified plan or changed row', async () => {
    const row = await client.sample.findUnique({ where: { id: 'legacy-released' } });
    const plan = { direction: 'apply', rows: [{ entity: 'Sample', id: row.id, from: row.status, to: 'APPROVED', legacyStatus: null, updatedAt: row.updatedAt }] };
    expect(() => migration.reviewPlan({ ...plan, rows: [{ ...plan.rows[0], to: 'PROCESSING' }] }, migration.planFingerprint(plan)))
        .toThrow('fingerprint does not match');
    const reviewed = migration.reviewPlan(plan, migration.planFingerprint(plan));
    await client.sample.update({ where: { id: row.id }, data: { clientName: 'Concurrent edit', updatedAt: new Date(row.updatedAt.getTime() + 1000) } });
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
    await expect(rules.inTransaction(client, tx => tx.resultEvidenceEvent.update({ where: { id: event.id }, data: { reason: 'Overwritten' } })))
        .rejects.toMatchObject({ statusCode: 409, code: 'RESULT_EVIDENCE_IMMUTABLE' });
    await expect(rules.inTransaction(client, tx => tx.resultEvidenceEvent.delete({ where: { id: event.id } })))
        .rejects.toMatchObject({ statusCode: 409, code: 'RESULT_EVIDENCE_IMMUTABLE' });
});

test('superseding a reverted result clears only the current-result block, retaining all old evidence', async () => {
    const { sample } = await fixture();
    const old = await client.result.create({ data: { id: id(), sampleId: sample.id, param: 'PH_H2O', value: '6.2' } });
    await client.$transaction(tx => evidence.recordPreparationRevert(tx, sample, 'DRYING', 'Drying repeated', manager));
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

test('default policy completes both gates atomically and advances ACCEPTED to PROCESSING', async () => {
    expect(Object.values(registry['gate.verificationRequired'].presets)).toEqual([false, false, false]);
    const { sample, item } = await fixture('ACCEPTED', 'DRYING', 'NOT_ASSIGNED');
    await client.sample.update({ where: { id: sample.id }, data: { dryingStatus: 'PENDING', preparationStatus: 'PENDING' } });
    const prep = await work.createWorkItem({ id: id(), sampleId: sample.id, analysis: 'PREPARATION', assignedLab: manager.labId }, manager, { tx: client });
    const dryOutcome = await operations.confirmOperation({ actor: technician, workItemId: item.id, checklist: [true, true, true], db: client });
    expect(dryOutcome.sample).toMatchObject({ status: 'ACCEPTED', dryingStatus: 'DONE', preparationStatus: 'PENDING' });
    const prepOutcome = await operations.confirmOperation({ actor: technician, workItemId: prep.id, checklist: [true, true, true], db: client });
    expect(prepOutcome.sample).toMatchObject({ status: 'PROCESSING', dryingStatus: 'DONE', preparationStatus: 'DONE' });
    expect(await client.submission.count({ where: { sampleId: sample.id } })).toBe(0);
    expect(await client.auditLog.count({ where: { entityId: prep.id, action: 'OPERATION_CONFIRMED' } })).toBe(1);
});

test('analysis policy cannot be bypassed by false input; rejected verification stays pending without revert evidence', async () => {
    await client.$transaction(tx => policyService.mutateInTransaction(manager, manager.labId, {
        changes: [{ key: 'gate.verificationRequired', analysisCode: 'PREPARATION', value: true }], reason: 'Preparation SOP requires verification'
    }, tx));
    const { sample, item } = await fixture('ACCEPTED', 'PREPARATION', 'NOT_ASSIGNED');
    await client.sample.update({ where: { id: sample.id }, data: { preparationStatus: 'PENDING' } });
    const outcome = await operations.confirmOperation({ actor: technician, workItemId: item.id, checklist: [true, true, true], verificationRequired: false, db: client });
    expect(outcome.workItem.status).toBe('AWAITING_VERIFICATION');
    expect(outcome.sample.preparationStatus).toBe('PENDING');
    expect(JSON.parse(outcome.workItem.history).at(-1)).toMatchObject({ policyVersion: 1, verificationPolicy: true, verificationRequired: true });
    expect(JSON.parse((await client.auditLog.findFirst({ where: { entityId: item.id, action: 'OPERATION_CONFIRMED' } })).details).verificationPolicy).toBe(true);
    expect((await operations.verifyOperation({ actor: manager, workItemId: item.id, decision: 'REJECT', note: 'Repeat preparation', db: client })).status).toBe('REPEAT_REQUIRED');
    expect((await client.sample.findUnique({ where: { id: sample.id } })).preparationStatus).toBe('PENDING');
    expect(await client.resultEvidenceEvent.count({ where: { sampleId: sample.id } })).toBe(0);
    await operations.confirmOperation({ actor: technician, workItemId: item.id, checklist: [true, true, true], db: client });
    const accepted = await operations.verifyOperation({ actor: manager, workItemId: item.id, decision: 'ACCEPT', note: 'Preparation verified', db: client });
    expect(accepted.sample).toMatchObject({ status: 'PROCESSING', dryingStatus: 'DONE', preparationStatus: 'DONE' });
    expect((await client.reviewDecision.findMany({ where: { workItemId: item.id } })).map(row => row.decision).sort()).toEqual(['ACCEPT', 'RETURN']);
    const before = await snapshot(sample.id);
    await expect(operations.verifyOperation({ actor: manager, workItemId: item.id, decision: 'ACCEPT', db: client })).rejects.toMatchObject({ code: 'WORKITEM_NOT_AWAITING_VERIFICATION' });
    expect(await snapshot(sample.id)).toEqual(before);
});

test('a request may demand stricter drying verification; acceptance of the last gate advances the sample', async () => {
    const { sample, item } = await fixture('ACCEPTED', 'DRYING', 'NOT_ASSIGNED');
    await client.sample.update({ where: { id: sample.id }, data: { dryingStatus: 'PENDING' } });
    const outcome = await operations.confirmOperation({ actor: technician, workItemId: item.id, checklist: [true, true, true], verificationRequired: true, db: client });
    expect(outcome.workItem.status).toBe('AWAITING_VERIFICATION');
    expect(JSON.parse(outcome.workItem.history).at(-1)).toMatchObject({ verificationPolicy: false, verificationRequested: true });
    const accepted = await operations.verifyOperation({ actor: manager, workItemId: item.id, decision: 'ACCEPT', db: client });
    expect(accepted.sample.status).toBe('PROCESSING');
});

test('gate verification policy refuses unrelated analyses and method-specific overrides with no policy writes', async () => {
    const before = await client.labPolicy.findUnique({ where: { labId: manager.labId } });
    for (const change of [{ analysisCode: 'PH_H2O' }, { analysisCode: 'DRYING', methodologyId: 'unrelated-method' }]) {
        await expect(client.$transaction(tx => policyService.mutateInTransaction(manager, manager.labId, {
            changes: [{ key: 'gate.verificationRequired', value: true, ...change }], reason: 'Invalid gate scope'
        }, tx))).rejects.toMatchObject({ statusCode: 422, code: 'POLICY_SCOPE_INVALID' });
    }
    expect(await client.labPolicy.findUnique({ where: { labId: manager.labId } })).toEqual(before);
});

test.each(['APPROVED', 'ARCHIVED', 'DISPOSED', 'PROCESSING'])('undo approval is an amendment-only zero-write refusal for %s', async status => {
    const { sample } = await fixture(status);
    const before = await snapshot(sample.id);
    const response = { status: jest.fn().mockReturnThis(), json: jest.fn() };
    await require('../../controllers/sampleController').undoApproval({ params: { id: sample.id }, user: manager, body: { reason: 'Requested reopening' } }, response);
    expect(response.status).toHaveBeenCalledWith(409);
    expect(response.json).toHaveBeenCalledWith(expect.objectContaining({ code: 'AMENDMENT_WORKFLOW_REQUIRED' }));
    expect(await snapshot(sample.id)).toEqual(before);
});

test('concurrent operational verification commits one decision and refuses the stale decision without side effects', async () => {
    const { sample, item } = await fixture('ACCEPTED', 'DRYING', 'NOT_ASSIGNED');
    await client.sample.update({ where: { id: sample.id }, data: { dryingStatus: 'PENDING' } });
    await operations.confirmOperation({ actor: technician, workItemId: item.id, checklist: [true, true, true], verificationRequired: true, db: client });
    const outcomes = await Promise.allSettled([1, 2].map(() => operations.verifyOperation({ actor: manager, workItemId: item.id, decision: 'ACCEPT', db: client })));
    expect(outcomes.filter(row => row.status === 'fulfilled')).toHaveLength(1);
    expect(outcomes.find(row => row.status === 'rejected').reason).toMatchObject({ code: 'WORKITEM_NOT_AWAITING_VERIFICATION' });
    expect(await client.reviewDecision.count({ where: { workItemId: item.id } })).toBe(1);
    expect(await client.auditLog.count({ where: { entityId: item.id, action: 'OPERATION_VERIFIED' } })).toBe(1);
});

test('failed decision insertion rolls back operational state, gate flags and both audits', async () => {
    const { sample, item } = await fixture('ACCEPTED', 'DRYING', 'NOT_ASSIGNED');
    await client.sample.update({ where: { id: sample.id }, data: { dryingStatus: 'PENDING' } });
    await operations.confirmOperation({ actor: technician, workItemId: item.id, checklist: [true, true, true], verificationRequired: true, db: client });
    const before = await snapshot(sample.id), transaction = client.$transaction.bind(client);
    const injected = jest.spyOn(client, '$transaction').mockImplementation(callback => transaction(tx => callback(new Proxy(tx, {
        get(target, key) {
            if (key === 'reviewDecision') return new Proxy(target.reviewDecision, { get(delegate, method) {
                if (method === 'create') return () => { throw new Error('Injected decision insertion failure'); };
                return delegate[method];
            } });
            return target[key];
        }
    }))));
    try {
        await expect(operations.verifyOperation({ actor: manager, workItemId: item.id, decision: 'ACCEPT', db: client })).rejects.toThrow('Injected decision insertion failure');
    } finally { injected.mockRestore(); }
    expect(await snapshot(sample.id)).toEqual(before);
    expect(await client.reviewDecision.count({ where: { workItemId: item.id } })).toBe(0);
});

test('Batch and ReviewDecision backstops reject off-contract and mutable decisions with stable conflicts', async () => {
    const { sample, item } = await fixture();
    const batch = await client.batch.create({ data: { id: id(), analysis: 'PH_H2O', labId: manager.labId, status: 'OPEN', createdBy: manager.username } });
    await expect(rules.inTransaction(client, tx => tx.batch.update({ where: { id: batch.id }, data: { status: 'QC_PASS_WITH_WARNING' } })))
        .rejects.toMatchObject({ statusCode: 409, code: 'INVALID_BATCH_STATUS' });
    expect((await client.batch.findUnique({ where: { id: batch.id } })).status).toBe('OPEN');
    const decision = await client.reviewDecision.create({ data: { id: id(), sampleId: sample.id, workItemId: item.id, decision: 'ACCEPT',
        reason: 'Reviewed', reviewerId: manager.username, reviewerName: manager.username, authorization: manager.role, policyVersion: 'audit-fixture' } });
    await expect(rules.inTransaction(client, tx => tx.reviewDecision.update({ where: { id: decision.id }, data: { decision: 'ACCEPT' } })))
        .rejects.toMatchObject({ statusCode: 409, code: 'REVIEW_DECISION_IMMUTABLE' });
    expect(await client.reviewDecision.findUnique({ where: { id: decision.id } })).toEqual(decision);
});

test('reasoned gate revert records each current result once and preserves all analytical values', async () => {
    const { sample, item } = await fixture('PROCESSING', 'PREPARATION', 'COMPLETED');
    const results = [];
    for (const [param, isCurrent] of [['PH_H2O', true], ['EC', true], ['PH_H2O', false]]) {
        results.push(await client.result.create({ data: { id: id(), sampleId: sample.id, param, value: '6.2', numericValue: 6.2, isCurrent, flags: '["QC_WARN"]' } }));
    }
    const before = await snapshot(sample.id);
    await expect(gates.changeGate({ sampleId: sample.id, gate: 'PREPARATION', status: 'PENDING', reason: ' ', actor: manager, db: client }))
        .rejects.toMatchObject({ code: 'TRANSITION_REASON_REQUIRED' });
    expect(await snapshot(sample.id)).toEqual(before);
    const outcome = await gates.changeGate({ sampleId: sample.id, gate: 'PREPARATION', status: 'PENDING', reason: 'Repeat preparation with retained material', actor: manager, db: client });
    expect(outcome.resultEvidenceCount).toBe(2);
    expect(outcome.sample.preparationStatus).toBe('PENDING');
    expect(outcome.workItem.status).toBe('NOT_ASSIGNED');
    expect(await client.result.findMany({ where: { sampleId: sample.id }, orderBy: { id: 'asc' } })).toEqual(before.results);
    expect(await client.resultEvidenceEvent.count({ where: { resultId: results[2].id } })).toBe(0);
    expect(await client.auditLog.count({ where: { entityId: item.id, action: 'GATE_REVERTED' } })).toBe(1);
    await expect(evidence.assertNoPreparationRevert(client, sample.id)).rejects.toMatchObject({ code: 'PREP_REVERTED_RESULTS' });
});

test('gate failure holds both entities and release restores their individual prior states', async () => {
    const { sample, item } = await fixture('ACCEPTED', 'DRYING', 'ASSIGNED');
    await client.sample.update({ where: { id: sample.id }, data: { dryingStatus: 'PENDING', preparationStatus: 'PENDING' } });
    const held = await gates.changeGate({ sampleId: sample.id, gate: 'DRYING', status: 'FAILED', reason: 'Drying endpoint failed', actor: manager, db: client });
    expect(held.sample).toMatchObject({ status: 'ON_HOLD', holdPriorStatus: 'ACCEPTED', dryingStatus: 'FAILED' });
    expect(held.workItem).toMatchObject({ status: 'ON_HOLD', holdPriorStatus: 'ASSIGNED' });
    const before = await snapshot(sample.id);
    await expect(gates.changeGate({ sampleId: sample.id, gate: 'DRYING', status: 'PENDING', actor: manager, db: client }))
        .rejects.toMatchObject({ code: 'TRANSITION_REASON_REQUIRED' });
    expect(await snapshot(sample.id)).toEqual(before);
    const released = await gates.changeGate({ sampleId: sample.id, gate: 'DRYING', status: 'PENDING', reason: 'Failure reviewed; resume assigned task', actor: manager, db: client });
    expect(released.sample).toMatchObject({ status: 'ACCEPTED', holdPriorStatus: null });
    expect(released.workItem).toMatchObject({ status: 'ASSIGNED', holdPriorStatus: null });
    expect((await client.workItem.findUnique({ where: { id: item.id } })).result).toContain('Gate Failed');
});

test.each(['APPROVED', 'ARCHIVED', 'DISPOSED'])('gate reversion of %s sample refuses all writes', async status => {
    const { sample } = await fixture(status, 'DRYING', 'COMPLETED');
    const before = await snapshot(sample.id);
    await expect(gates.changeGate({ sampleId: sample.id, gate: 'DRYING', status: 'PENDING', reason: 'Requested revert', actor: manager, db: client }))
        .rejects.toMatchObject({ code: 'AMENDMENT_WORKFLOW_REQUIRED' });
    expect(await snapshot(sample.id)).toEqual(before);
});

test('an accepted marked gate duplicate prevents revert of the canonical gate with no writes', async () => {
    const { sample, item } = await fixture('PROCESSING', 'DRYING', 'COMPLETED');
    await work.createWorkItem({ id: id(), sampleId: sample.id, analysis: 'DRYING', status: 'ACCEPTED', duplicateOf: item.id },
        'system:fixture', { context: 'fixture', tx: client });
    const before = await snapshot(sample.id);
    await expect(gates.changeGate({ sampleId: sample.id, gate: 'DRYING', status: 'PENDING', reason: 'Revert request', actor: manager, db: client }))
        .rejects.toMatchObject({ code: 'AMENDMENT_WORKFLOW_REQUIRED' });
    expect(await snapshot(sample.id)).toEqual(before);
});
