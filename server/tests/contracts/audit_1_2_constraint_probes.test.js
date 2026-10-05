const fs = require('node:fs');
const { randomUUID } = require('node:crypto');
const { PrismaClient } = require('../../prisma_client');
const { PrismaBetterSqlite3 } = require('@prisma/adapter-better-sqlite3');
const { beforeGuards } = require('../helpers/legacyWorkflowDatabase');
const { rejectedGuardWrite } = require('../helpers/rejectedGuardWrite');
const { createSampleFixture, createWorkItemFixture } = require('../helpers/workflowFixtures');

describe('Audit 1.2: exact SQLite constraint refusals preserve workflow evidence', () => {
    let file, client, sample, item;
    beforeEach(async () => {
        ({ file } = beforeGuards({ actor: 'system:fixture' }));
        client = new PrismaClient({ adapter: new PrismaBetterSqlite3({ url: `file:${file}` }) });
        const id = randomUUID();
        sample = await createSampleFixture(client, { data: { id, originalId: id, status: 'PROCESSING' } });
        item = await createWorkItemFixture(client, { data: {
            id: randomUUID(), sampleId: id, analysis: 'PH', status: 'ACCEPTED', result: '6.7'
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
});
