const fs = require('node:fs');
const path = require('node:path');
const { createHash } = require('node:crypto');
const { issue204QueueFixture } = require('../helpers/issue204QueueFixture');

// A single injected handle follows the active owned DB even when an authority
// module retains its imported singleton between the 20- and 100-item fixtures.
// The real singleton module is never loaded and cannot open a working DB.
let mockDatabase;
jest.mock('../../prisma', () => new Proxy({}, {
    get(_target, key) {
        if (!mockDatabase) throw new Error('Queue contracts require their new owned DB.');
        const value = mockDatabase[key];
        return typeof value === 'function' ? value.bind(mockDatabase) : value;
    }
}));

const source = fs.readFileSync(path.resolve(__dirname, '../fixtures/issue204/getQueue-main-c91f2f5c.source.txt'), 'utf8').replace(/\r\n/g, '\n');
expect(createHash('sha256').update(source).digest('hex')).toBe('5533b453277670cd3ddb8e9b882241221ec4d132608b4336b61046fa9181a857');
const owned = new Map();
const measurements = new Map();
jest.setTimeout(120000);
beforeAll(() => {
    jest.useFakeTimers({ now: new Date('2026-10-18T09:00:00Z'), doNotFake: ['setTimeout', 'clearTimeout',
        'setInterval', 'clearInterval', 'setImmediate', 'clearImmediate', 'nextTick', 'queueMicrotask', 'hrtime', 'performance'] });
});
afterAll(async () => {
    for (const fixture of owned.values()) await (await fixture).close();
    jest.useRealTimers();
});
function fixture(count) {
    if (!owned.has(count)) owned.set(count, issue204QueueFixture(count, db => { mockDatabase = db; }));
    return owned.get(count);
}

async function withReaders(f, exercise) {
    mockDatabase = f.db;
    await jest.isolateModulesAsync(async () => {
        const candidate = require('../../controllers/workbenchController').getQueue;
        const main = {};
        const controllerDirectory = path.resolve(__dirname, '../../controllers');
        const controllerRequire = name => name === '../prisma' ? f.db
            : require(name.startsWith('.') ? path.resolve(controllerDirectory, name) : name);
        // Literal main imports + GET handler only; no alternate result writer.
        new Function('require', 'exports', source)(controllerRequire, main);
        const read = async (handler, query = {}, actor = f.actor) => {
            let status = 200, body;
            const response = { status(code) { status = code; return this; },
                json(value) { body = JSON.parse(JSON.stringify(value)); return this; } };
            f.resetQueries();
            await handler({ user: actor, query }, response);
            return { status, body, queries: f.queryCount() };
        };
        await exercise({ main: main.getQueue, candidate, read });
    });
}

test('mixed queues preserve the main response for every view, search and deep links', async () => {
    const f = await fixture(20);
    const retained = async () => Promise.all(['sample', 'workItem', 'workAttempt', 'result', 'batch', 'batchAnalyte',
        'auditLog', 'labPolicy', 'labPolicyOverride', 'workItemDraft'].map(model => f.db[model].findMany({ orderBy: { id: 'asc' } })));
    const before = await retained();
    await withReaders(f, async ({ main, candidate, read }) => {
        for (const query of [{ view: 'my_work' }, { view: 'ready_to_submit' }, { view: 'submitted' },
            { view: 'completed' }, { search: 'needle' }, { workItemId: 'item-6' }, { sampleId: 'sample-0' }]) {
            const expected = await read(main, query), actual = await read(candidate, query);
            expect(expected.status).toBe(200);
            expect({ status: actual.status, body: actual.body }).toStrictEqual({ status: expected.status, body: expected.body });
            if (query.view === 'my_work') {
                const rows = actual.body.groups.flatMap(group => group.items);
                expect(new Set(rows.map(row => row.editorKind))).toEqual(new Set(['NUMERIC', 'TEXTURE', 'SPECTRAL', 'OPERATIONAL']));
                expect(rows.find(row => row.workItemId === 'item-0')).toMatchObject({ instrumentSource: 'RUN', equipmentId: 'equipment-run' });
                expect(rows.find(row => row.workItemId === 'item-1')).toMatchObject({ instrumentSource: 'WORK_ITEM', equipmentId: 'equipment-item' });
                expect(rows.find(row => row.workItemId === 'item-5')).toMatchObject({ status: 'COMPLETED', sampleReplicates: { canAppend: true } });
                expect(rows.some(row => row.workItemId === 'item-6')).toBe(false);
            }
            if (query.view === 'completed') {
                const rows = actual.body.groups.flatMap(group => group.items);
                expect(rows.find(row => row.workItemId === 'item-5').sampleReplicates.requiredCount).toBe(2);
                expect(rows.find(row => row.workItemId === 'item-6')).toMatchObject({
                    valueRules: { loq: 0.3 }, sampleReplicates: { requiredCount: 1, canAppend: false } });
            }
        }
    });
    expect(await retained()).toStrictEqual(before);
});

test('scope denials and different laboratory queues retain the main response', async () => {
    const f = await fixture(20);
    await withReaders(f, async ({ main, candidate, read }) => {
        const actor = { ...f.actor, labId: 'OTHER-LAB', role: 'LAB_TECHNICIAN' };
        for (const query of [{}, { workItemId: 'item-0' }, { sampleId: 'sample-0' }]) {
            const expected = await read(main, query, actor), actual = await read(candidate, query, actor);
            expect({ status: actual.status, body: actual.body }).toStrictEqual({ status: expected.status, body: expected.body });
            expect(actual.status).toBe(query.workItemId || query.sampleId ? 403 : 200);
            if (actual.status === 200) expect(actual.body.groups).toEqual([]);
        }
    });
});

test('a subsequent request observes changed policy instead of reusing an earlier request', async () => {
    const f = await fixture(20);
    await withReaders(f, async ({ main, candidate, read }) => {
        await read(candidate, { view: 'completed' });
        try {
            await f.db.labPolicyOverride.update({ where: { id: 'override-results.replicatesRequired' }, data: { value: '1' } });
            const expected = await read(main, { view: 'completed' }), actual = await read(candidate, { view: 'completed' });
            expect({ status: actual.status, body: actual.body }).toStrictEqual({ status: expected.status, body: expected.body });
            expect(actual.body.groups.flatMap(group => group.items).find(row => row.workItemId === 'item-5')
                .sampleReplicates.requiredCount).toBe(1);
        } finally {
            await f.db.labPolicyOverride.update({ where: { id: 'override-results.replicatesRequired' }, data: { value: '2' } });
        }
    });
});

test.each([20, 100])('main reference counts real Prisma queries for %i mixed assigned items', async count => {
    const f = await fixture(count);
    await withReaders(f, async ({ main, read }) => {
        const result = await read(main, { view: 'my_work' });
        expect(result.status).toBe(200);
        expect(result.queries).toBeGreaterThan(count);
        measurements.set(count, { main: result.queries });
        console.info(JSON.stringify({ issue204: 'main-reference', assignedItems: count, prismaQueries: result.queries }));
    });
});

test('optimized queries have substantially lower per-item growth at 20 and 100 items', async () => {
    for (const count of [20, 100]) {
        const f = await fixture(count);
        await withReaders(f, async ({ main, candidate, read }) => {
            const expected = await read(main, { view: 'my_work' });
            const actual = await read(candidate, { view: 'my_work' });
            expect({ status: actual.status, body: actual.body }).toStrictEqual({ status: expected.status, body: expected.body });
            expect(actual.queries).toBeLessThan(expected.queries * 0.6);
            measurements.set(count, { main: expected.queries, optimized: actual.queries });
        });
    }
    const small = measurements.get(20), large = measurements.get(100);
    expect(large.optimized - small.optimized).toBeLessThan((large.main - small.main) * 0.6);
    console.info(JSON.stringify({ issue204: 'query-comparison', items20: small, items100: large }));
});
