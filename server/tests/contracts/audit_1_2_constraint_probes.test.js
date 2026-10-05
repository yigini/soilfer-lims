const fs = require('node:fs');
const { randomUUID } = require('node:crypto');
const Database = require('better-sqlite3');
const { PrismaClient } = require('../../prisma_client');
const { PrismaBetterSqlite3 } = require('@prisma/adapter-better-sqlite3');
const { beforeGuards } = require('../helpers/legacyWorkflowDatabase');
const { rejectedGuardWrite } = require('../helpers/rejectedGuardWrite');
const { createSampleFixture, createWorkItemFixture } = require('../helpers/workflowFixtures');

describe('Audit 1.2: exact SQLite constraint refusals preserve workflow evidence', () => {
    let file, client, sample, item, duplicate;
    beforeEach(async () => {
        ({ file } = beforeGuards({ actor: 'system:fixture' }));
        client = new PrismaClient({ adapter: new PrismaBetterSqlite3({ url: `file:${file}` }) });
        const id = randomUUID();
        sample = await createSampleFixture(client, { data: { id, originalId: id, status: 'PROCESSING' } });
        item = await createWorkItemFixture(client, { data: {
            id: randomUUID(), sampleId: id, analysis: 'PH', status: 'ACCEPTED', result: '6.7'
        } });
        duplicate = await createWorkItemFixture(client, { data: {
            id: randomUUID(), sampleId: id, analysis: 'PH', status: 'COMPLETED', result: '6.5', duplicateOf: item.id
        } });
    });
    afterEach(async () => {
        await client?.$disconnect();
        if (file) for (const suffix of ['', '-wal', '-shm']) fs.rmSync(`${file}${suffix}`, { force: true });
    });
    const snapshot = async () => ({
        samples: await client.sample.findMany({ orderBy: { id: 'asc' } }),
        work: await client.workItem.findMany({ orderBy: { id: 'asc' } }),
        audits: await client.auditLog.findMany({ orderBy: { id: 'asc' } })
    });
    const probe = overrides => ({ actor: 'system:fixture', file,
        statement: 'INSERT INTO WorkItem (id,sampleId,analysis,status,updatedAt) VALUES (?,?,?,?,?)',
        parameters: [randomUUID(), sample.id, 'PH', 'NOT_ASSIGNED', Date.now()],
        expectedGuardCode: 'SQLITE_CONSTRAINT_UNIQUE', expectedConstraint: 'WorkItem_one_active_per_analysis', ...overrides });
    const restrictProbe = overrides => probe({ statement: 'DELETE FROM WorkItem WHERE id = ?', parameters: [item.id],
        expectedGuardCode: 'SQLITE_CONSTRAINT_TRIGGER', expectedConstraint: 'WorkItem_duplicateOf_restrict', ...overrides });

    test('the named active-item index rejects a new duplicate without changing any scientific or audit evidence', async () => {
        const before = await snapshot();
        rejectedGuardWrite(probe());
        expect(await snapshot()).toEqual(before);
        expect((await client.workItem.findUnique({ where: { id: item.id } })).result).toBe('6.7');
    });
    test('a missing parent fails the exact foreign key constraint with foreign keys ON and no writes', async () => {
        const before = await snapshot();
        rejectedGuardWrite(probe({ expectedGuardCode: 'SQLITE_CONSTRAINT_FOREIGNKEY', expectedConstraint: undefined,
            parameters: [randomUUID(), randomUUID(), 'PH', 'NOT_ASSIGNED', Date.now()] }));
        expect(await snapshot()).toEqual(before);
    });
    test('a different refusal code fails the helper instead of passing as an arbitrary database error', async () => {
        const before = await snapshot();
        expect(() => rejectedGuardWrite(probe({ expectedGuardCode: 'SQLITE_CONSTRAINT_FOREIGNKEY' })))
            .toThrow('SQLite refused with a different constraint code.');
        expect(await snapshot()).toEqual(before);
    });
    test('a successful write fails the helper and rolls back rather than becoming a reusable raw writer', async () => {
        const before = await snapshot();
        expect(() => rejectedGuardWrite(probe({ parameters: [randomUUID(), sample.id, 'SOC', 'NOT_ASSIGNED', Date.now()] })))
            .toThrow('A refused guard probe changed database rows.');
        expect(await snapshot()).toEqual(before);
    });
    test('an unpinned constraint name is refused before any raw write', async () => {
        const before = await snapshot();
        expect(() => rejectedGuardWrite(probe({ expectedConstraint: 'Any_unique_error' }))).toThrow('exact expected release guard code');
        expect(await snapshot()).toEqual(before);
    });
    test('the exact duplicateOf RESTRICT deletion preserves the kept row, measurement and all audits', async () => {
        const before = await snapshot();
        rejectedGuardWrite(restrictProbe());
        expect(await snapshot()).toEqual(before);
    });
    test('a workflow-trigger refusal cannot pass under the native RESTRICT identity', async () => {
        const db = new Database(file);
        try { db.exec("CREATE TRIGGER probe_workflow_delete BEFORE DELETE ON WorkItem BEGIN SELECT RAISE(ABORT, 'INVALID_WORKITEM_STATUS'); END"); }
        finally { db.close(); }
        const before = await snapshot();
        expect(() => rejectedGuardWrite(restrictProbe())).toThrow('SQLite refused with a different constraint identity.');
        expect(await snapshot()).toEqual(before);
    });
    test('a trigger raising the native message is rejected before it can impersonate a foreign-key refusal', async () => {
        const db = new Database(file);
        try { db.exec("CREATE TRIGGER probe_impersonated_delete BEFORE DELETE ON WorkItem BEGIN SELECT RAISE(ABORT, 'FOREIGN KEY constraint failed'); END"); }
        finally { db.close(); }
        const before = await snapshot();
        expect(() => rejectedGuardWrite(restrictProbe())).toThrow('impersonate the native foreign-key refusal');
        expect(await snapshot()).toEqual(before);
    });
    test('an unknown identity cannot authorize SQLITE_CONSTRAINT_TRIGGER', async () => {
        const before = await snapshot();
        expect(() => rejectedGuardWrite(restrictProbe({ expectedConstraint: 'ARBITRARY_TRIGGER' }))).toThrow('exact expected release guard code');
        expect(await snapshot()).toEqual(before);
    });
    test('an unreferenced deletion that would succeed is refused before running', async () => {
        const before = await snapshot();
        expect(() => rejectedGuardWrite(restrictProbe({ parameters: [duplicate.id] }))).toThrow('must have a referencing duplicate');
        expect(await snapshot()).toEqual(before);
    });
    test('a different successful write cannot use the pinned deletion identity', async () => {
        const before = await snapshot();
        expect(() => rejectedGuardWrite(restrictProbe({ statement: 'UPDATE WorkItem SET status = ? WHERE id = ?', parameters: ['NOT_ASSIGNED', duplicate.id] })))
            .toThrow('single bound WorkItem id deletion');
        expect(await snapshot()).toEqual(before);
    });
});
