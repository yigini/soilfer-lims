const fs = require('node:fs');
const path = require('node:path');
const { createHash } = require('node:crypto');
const { spawnSync } = require('node:child_process');
const migrations = require('../../services/statusMigrationService');
const plans = require('../../services/statusMigrationPlan');
const { parseArguments } = require('../../scripts/migrate_legacy_statuses');
const { createLegacyClosureDatabase } = require('../helpers/legacyWorkflowDatabase');
const samples = require('../../services/sampleStateService');
const work = require('../../services/workItemStateService');
const databases = [];
const script = path.resolve(__dirname, '../../scripts/migrate_legacy_statuses.js');
afterAll(async () => { for (const database of databases) await database.close(); });

async function fixture(options = {}) {
    const time = Date.now();
    const database = await createLegacyClosureDatabase({ analysis: 'ARCHIVING', labId: 'STATUS-MIGRATION-TEST',
        ...options, samples: ['COLLECTED', 'REJECTED', 'RELEASED', 'PENDING', 'VALIDATED'].map(status => ({
            id: `migration-s-${status}`, originalId: `migration-s-${status}`, status, assignedLab: 'STATUS-MIGRATION-TEST', createdAt: time,
            updatedAt: status === 'COLLECTED' ? '2026-10-04 14:00:00' : time,
            approvedBy: status === 'RELEASED' ? 'recorded-historical-approver' : null, approvedAt: status === 'RELEASED' ? time : null })),
        workItems: ['PENDING', 'APPROVED', 'QA_PENDING', 'REJECTED', 'REANALYSIS_REQUIRED', 'UNMAPPED_WI'].map(status => ({
            id: `migration-w-${status}`, analysis: `MIGRATION_${status}`, status, assignedLab: 'STATUS-MIGRATION-TEST', result: 'retained scalar',
            history: '[{"note":"Retained original history"}]', version: 7, createdAt: time, updatedAt: time })) });
    databases.push(database);
    return database;
}

async function snapshot(client) {
    return { samples: await client.sample.findMany({ orderBy: { id: 'asc' } }), work: await client.workItem.findMany({ orderBy: { id: 'asc' } }),
        audits: await client.auditLog.findMany({ orderBy: { id: 'asc' } }) };
}

function databaseFile(database) { return database.file; }

test('CLI requires an explicit database and a reviewed fingerprint for every apply', () => {
    expect(() => parseArguments([])).toThrow('explicit --db');
    expect(() => parseArguments(['--db', 'isolated.db', '--apply'])).toThrow('exact --reviewed-sha256');
    expect(() => parseArguments(['--db', 'isolated.db', '--apply', '--dry-run'])).toThrow('mutually exclusive');
    expect(() => parseArguments(['--db', 'isolated.db', '--timeout-ms', '-1'])).toThrow('positive integer');
    expect(parseArguments(['--db', 'isolated.db', '--revert'])).toMatchObject({ apply: false, direction: 'revert' });
    expect(() => parseArguments(['--db', 'one.db', '--db', 'two.db'])).toThrow('Repeated argument');
});

test('dry run works on a pre-migration database without adding schema or creating a writable runtime', async () => {
    const database = await fixture({ preMigrationSnapshot: true }), { path: file, sha256: before } = database.preMigrationSnapshot;
    {
        const output = spawnSync(process.execPath, [script, '--db', file], { encoding: 'utf8' });
        expect(output.status).toBe(0);
        expect(JSON.parse(output.stdout)).toMatchObject({ mode: 'DRY_RUN', schemaReady: false, candidateCount: 9, unmappedCount: 3 });
        expect(createHash('sha256').update(fs.readFileSync(file)).digest('hex')).toBe(before);
        for (const suffix of ['-wal', '-shm', '-journal']) expect(fs.existsSync(`${file}${suffix}`)).toBe(false);
        const report = migrations.inspectDatabase(file), planFile = `${database.file}.pre-schema-plan.json`;
        fs.writeFileSync(planFile, JSON.stringify(report));
        try {
            for (const direction of [[], ['--revert']]) {
                const refused = spawnSync(process.execPath, [script, '--db', file, '--apply', ...direction,
                    '--plan', planFile, '--reviewed-sha256', report.fingerprint], { encoding: 'utf8' });
                expect(refused.status).toBe(1);
                expect(JSON.parse(refused.stderr)).toMatchObject({ error: 'STATUS_MIGRATION_REFUSED',
                    message: 'The complete additive state schema and guards are required before --apply.' });
                expect(createHash('sha256').update(fs.readFileSync(file)).digest('hex')).toBe(before);
                for (const suffix of ['-wal', '-shm', '-journal']) expect(fs.existsSync(`${file}${suffix}`)).toBe(false);
            }
        } finally { fs.rmSync(planFile); }
        const guarded = spawnSync(process.execPath, [script, '--db', database.file], { encoding: 'utf8' });
        expect(guarded.status).toBe(0);
        expect(JSON.parse(guarded.stdout)).toMatchObject({ mode: 'DRY_RUN', schemaReady: true, candidateCount: 9, unmappedCount: 3 });
        const missing = `${file}.missing`;
        expect(spawnSync(process.execPath, [script, '--db', missing], { encoding: 'utf8' }).status).toBe(1);
        expect(fs.existsSync(missing)).toBe(false);
    }
});

test('the explicit CLI apply and revert consume the reviewed plan and report exact counts', async () => {
    const database = await fixture(), file = databaseFile(database), planFile = `${file}.plan.json`;
    const run = args => spawnSync(process.execPath, [script, '--db', file, ...args], { encoding: 'utf8' });
    try {
        const apply = migrations.inspectDatabase(file);
        fs.writeFileSync(planFile, JSON.stringify(apply), 'utf8');
        const before = await snapshot(database.client);
        const refused = run(['--apply', '--plan', planFile, '--reviewed-sha256', '0'.repeat(64)]);
        expect(refused.status).toBe(1);
        expect(JSON.parse(refused.stderr).error).toBe('STATUS_MIGRATION_PLAN_STALE');
        expect(await snapshot(database.client)).toEqual(before);
        const applied = run(['--apply', '--plan', planFile, '--reviewed-sha256', apply.fingerprint, '--timeout-ms', '30000']);
        expect(applied.status).toBe(0);
        expect(JSON.parse(applied.stdout)).toMatchObject({ mode: 'APPLIED', direction: 'apply', changedRows: 9, auditsAdded: 9 });
        const revert = migrations.inspectDatabase(file, 'revert');
        fs.writeFileSync(planFile, JSON.stringify(revert), 'utf8');
        const restored = run(['--apply', '--revert', '--plan', planFile, '--reviewed-sha256', revert.fingerprint]);
        expect(restored.status).toBe(0);
        expect(JSON.parse(restored.stdout)).toMatchObject({ mode: 'APPLIED', direction: 'revert', changedRows: 9, auditsAdded: 9 });
        expect(await database.client.auditLog.count()).toBe(18);
    } finally { fs.rmSync(planFile, { force: true }); }
});

test('default CLI dry run reports every approved mapping and unmapped row without changing the database', async () => {
    const database = await fixture(), file = databaseFile(database), before = await snapshot(database.client);
    const digest = () => createHash('sha256').update(fs.readFileSync(file)).digest('hex');
    const beforeHash = digest();
    const output = spawnSync(process.execPath, [script, '--db', file], { encoding: 'utf8', cwd: path.dirname(file), env: { ...process.env, TZ: 'Europe/Rome' } });
    expect(output.status).toBe(0); expect(output.stderr).toBe('');
    const report = JSON.parse(output.stdout);
    expect(report).toMatchObject({ mode: 'DRY_RUN', schemaReady: true, candidateCount: 9, unmappedCount: 3, blockedCount: 0 });
    expect(report.mappings).toContainEqual({ entity: 'WorkItem', from: 'PENDING', to: 'NOT_ASSIGNED', count: 2 });
    expect(report.unmapped).toEqual(expect.arrayContaining([
        { entity: 'Sample', id: 'migration-s-PENDING', status: 'PENDING' },
        { entity: 'Sample', id: 'migration-s-VALIDATED', status: 'VALIDATED' },
        { entity: 'WorkItem', id: 'migration-w-UNMAPPED_WI', status: 'UNMAPPED_WI' }
    ]));
    expect(report.plan.rows.find(row => row.id === 'migration-s-COLLECTED').updatedAt).toBe('2026-10-04T14:00:00.000Z');
    expect(digest()).toBe(beforeHash);
    expect(await snapshot(database.client)).toEqual(before);
});

test('dry-run gate inventory groups actual legacy reliance by lab without changing data or the reviewed status plan', async () => {
    const database = await fixture(), client = database.client, labId = 'SECOND-GATE-INVENTORY-LAB';
    await client.lab.create({ data: { id: labId, code: labId, name: 'Second inventory laboratory', country: 'TEST' } });
    const create = (id, flags) => samples.createSample({ id, originalId: id, assignedLab: labId, status: 'PROCESSING', ...flags },
        'system:fixture', { context: 'fixture', tx: client });
    await create('inventory-both', { dryingStatus: 'DONE', preparationStatus: 'DONE' });
    await create('inventory-drying', { dryingStatus: 'DONE', preparationStatus: null });
    const gateWI = await create('inventory-present', { dryingStatus: 'DONE', preparationStatus: 'PENDING' });
    await work.createWorkItem({ id: 'inventory-gate', sampleId: gateWI.id, analysis: 'DRYING', status: 'COMPLETED' },
        'system:fixture', { context: 'fixture', tx: client });
    const before = await snapshot(client), file = databaseFile(database);
    const digest = createHash('sha256').update(fs.readFileSync(file)).digest('hex');
    const report = migrations.inspectDatabase(file);
    expect(report.legacyGateInventoryAvailable).toBe(true);
    expect(report.legacyGateEvidence).toContainEqual({ labId, sampleCount: 2, dryingCount: 2, preparationCount: 1 });
    const output = spawnSync(process.execPath, [script, '--db', file], { encoding: 'utf8' });
    expect(output.status).toBe(0);
    expect(JSON.parse(output.stdout).legacyGateEvidence).toEqual(report.legacyGateEvidence);
    expect(JSON.parse(output.stdout).fingerprint).toBe(report.fingerprint);
    expect(createHash('sha256').update(fs.readFileSync(file)).digest('hex')).toBe(digest);
    expect(await snapshot(client)).toEqual(before);
});

test('reviewed apply and revert restore exact original states once and append one audit per row', async () => {
    const database = await fixture(), client = database.client, before = await snapshot(client);
    const report = migrations.inspectDatabase(databaseFile(database));
    const applied = await migrations.applyReviewedPlan(client, report.plan, report.fingerprint);
    expect(applied).toMatchObject({ changedRows: 9, auditsAdded: 9, unmappedCount: 3 });
    const after = await snapshot(client);
    expect(after.samples.find(row => row.id === 'migration-s-RELEASED')).toMatchObject({ status: 'APPROVED', legacyStatus: 'RELEASED',
        approvedBy: 'recorded-historical-approver', approvedAt: before.samples.find(row => row.id === 'migration-s-RELEASED').approvedAt });
    expect(after.work.find(row => row.id === 'migration-w-APPROVED')).toMatchObject({ status: 'ACCEPTED', legacyStatus: 'APPROVED',
        reviewedBy: null, reviewedAt: null, result: 'retained scalar', history: '[{"note":"Retained original history"}]' });
    expect(after.audits).toHaveLength(9);
    expect(after.audits.every(row => row.performedBy === 'system:status-migration')).toBe(true);
    const revert = migrations.inspectDatabase(databaseFile(database), 'revert');
    expect((await migrations.applyReviewedPlan(client, revert.plan, revert.fingerprint)).changedRows).toBe(9);
    const restored = await snapshot(client);
    for (const row of before.samples) expect(restored.samples.find(candidate => candidate.id === row.id)).toMatchObject({
        status: row.status, legacyStatus: null, approvedAt: row.approvedAt, approvedBy: row.approvedBy });
    for (const row of before.work) expect(restored.work.find(candidate => candidate.id === row.id)).toMatchObject({
        status: row.status, legacyStatus: null, result: row.result, history: row.history });
    expect(restored.audits).toHaveLength(18);
    await expect(migrations.applyReviewedPlan(client, revert.plan, revert.fingerprint)).rejects.toMatchObject({ code: 'STATUS_MIGRATION_PLAN_STALE' });
    expect(await snapshot(client)).toEqual(restored);
});

test('a changed complete plan refuses before any row is migrated', async () => {
    const database = await fixture(), client = database.client;
    const report = migrations.inspectDatabase(databaseFile(database));
    await client.workItem.update({ where: { id: 'migration-w-QA_PENDING' }, data: { version: { increment: 1 } } });
    const before = await snapshot(client);
    await expect(migrations.applyReviewedPlan(client, report.plan, report.fingerprint)).rejects.toMatchObject({ code: 'STATUS_MIGRATION_PLAN_STALE' });
    expect(await snapshot(client)).toEqual(before);
    const incomplete = { ...report.plan, rows: report.plan.rows.slice(1) };
    await expect(migrations.applyReviewedPlan(client, incomplete, plans.planFingerprint(incomplete))).rejects.toMatchObject({ code: 'STATUS_MIGRATION_PLAN_STALE' });
    expect(await snapshot(client)).toEqual(before);
});

test('a failed later migration audit rolls back every earlier state and audit', async () => {
    const database = await fixture(), client = database.client, before = await snapshot(client);
    const report = migrations.inspectDatabase(databaseFile(database));
    let audits = 0;
    await expect(migrations.applyReviewedPlan({ $transaction: callback => client.$transaction(tx => callback({ ...tx,
        auditLog: { ...tx.auditLog, create: args => {
            if (++audits === 3) throw new Error('Injected later migration audit failure');
            return tx.auditLog.create(args);
        } } })) }, report.plan, report.fingerprint)).rejects.toThrow('Injected later migration audit failure');
    expect(await snapshot(client)).toEqual(before);
});
