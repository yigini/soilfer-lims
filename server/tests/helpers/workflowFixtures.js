const { inTransaction } = require('../../services/workflowStateRules');
const { createSample } = require('../../services/sampleStateService');
const { createWorkItem } = require('../../services/workItemStateService');

// Positive fixtures use the same creation authorities and audits as runtime.
// Invalid/legacy states belong to the separately pinned pre-guard fixture.
async function createSampleFixture(db, { data, include, select }) {
    return inTransaction(db, async tx => {
        const row = await createSample(data, 'system:fixture', { context: 'fixture', tx });
        return include || select ? tx.sample.findUnique({ where: { id: row.id }, ...(include && { include }), ...(select && { select }) }) : row;
    });
}

async function createWorkItemFixture(db, { data, include, select }) {
    return inTransaction(db, async tx => {
        const row = await createWorkItem(data, 'system:fixture', { context: 'fixture', tx });
        return include || select ? tx.workItem.findUnique({ where: { id: row.id }, ...(include && { include }), ...(select && { select }) }) : row;
    });
}

async function createSamplesFixture(db, { data }) {
    return inTransaction(db, async tx => {
        for (const row of data) await createSampleFixture(tx, { data: row });
        return { count: data.length };
    });
}

async function createWorkItemsFixture(db, { data }) {
    return inTransaction(db, async tx => {
        for (const row of data) await createWorkItemFixture(tx, { data: row });
        return { count: data.length };
    });
}

// Isolated route rehearsals use actual users and normal JWT/session validation.
async function createAuthTokenFixture(db, role = 'SUPER_ADMIN', labId = 'LAB-GTM', countries = ['GTM'], projects = ['SOILFER-US']) {
    if (process.env.NODE_ENV !== 'test') throw new Error('Authentication fixtures are test-only.');
    const username = `test_${role.toLowerCase()}_${(labId || 'global').toLowerCase().replace(/[^a-z0-9]/g, '')}`;
    const user = await db.user.upsert({ where: { username }, update: {}, create: { id: username, username,
        email: `${username}@example.test`, password: await require('bcryptjs').hash('password', 4),
        role, labId: role === 'SUPER_ADMIN' ? null : labId, isActive: true,
        countries: JSON.stringify(role === 'SUPER_ADMIN' ? [] : countries),
        projects: JSON.stringify(role === 'SUPER_ADMIN' ? [] : projects) } });
    return require('../setup').generateToken({ ...user,
        countries: JSON.parse(user.countries || '[]'), projects: JSON.parse(user.projects || '[]') });
}

// #179 pin 5994345837: explicit-id cleanup only on a resolved test-owned file.
// This function is scanned and is not a negative-write helper exception.
async function cleanupWorkflowFixtures(db, entity, ids, { single = false } = {}) {
    const fs = require('node:fs'), path = require('node:path');
    require('../../services/workflowStateRules').assertFixtureContext();
    if (process.env.NODE_ENV !== 'test' || !['sample', 'workItem'].includes(entity) || !Array.isArray(ids) ||
        ids.some(id => typeof id !== 'string' || !id)) throw new Error('Cleanup requires test-owned explicit workflow ids.');
    const databases = await db.$queryRawUnsafe('PRAGMA database_list');
    const file = databases.find(row => row.name === 'main')?.file;
    if (!file || !fs.existsSync(file)) throw new Error('Cleanup requires a test-owned database file.');
    const resolved = fs.realpathSync(file), serverRoot = path.resolve(__dirname, '../..');
    const relative = path.relative(serverRoot, resolved).replace(/\\/g, '/');
    const owned = /^tests\/\.tmp\/[^/]+\.db$/.test(relative) || /^\.tmp_journey_runner_[^/]+\/[^/]+\.db$/.test(relative);
    const protectedPaths = [path.resolve(serverRoot, 'prisma/dev.db'), process.env.PRODUCTION_DATABASE_PATH].filter(Boolean)
        .map(candidate => (fs.existsSync(candidate) ? fs.realpathSync(candidate) : path.resolve(candidate)).toLowerCase());
    if (!owned || protectedPaths.includes(resolved.toLowerCase())) throw new Error('Cleanup refuses a non-test-owned database.');
    const explicitIds = [...new Set(ids)];
    if (single && explicitIds.length > 1) throw new Error('Single-row cleanup requires at most one id.');
    // Normalized QC membership retains its sample and work item evidence. Keep
    // those fixture rows until the disposable database itself is torn down.
    const tables = new Set((await db.$queryRawUnsafe("SELECT name FROM sqlite_master WHERE type='table' AND name IN ('BatchPosition','BatchPositionWorkItem')"))
        .map(row => row.name));
    const retainedIds = new Set();
    if (explicitIds.length) {
        const placeholders = explicitIds.map(() => '?').join(',');
        if (entity === 'sample' && tables.has('BatchPosition')) {
            const rows = await db.$queryRawUnsafe(`SELECT DISTINCT sampleId AS id FROM "BatchPosition" WHERE sampleId IN (${placeholders})`, ...explicitIds);
            for (const row of rows) retainedIds.add(row.id);
        }
        if (tables.has('BatchPositionWorkItem')) {
            const sql = entity === 'sample'
                ? `SELECT DISTINCT w.sampleId AS id FROM "BatchPositionWorkItem" p JOIN "WorkItem" w ON w.id=p.workItemId WHERE w.sampleId IN (${placeholders})`
                : `SELECT DISTINCT workItemId AS id FROM "BatchPositionWorkItem" WHERE workItemId IN (${placeholders})`;
            for (const row of await db.$queryRawUnsafe(sql, ...explicitIds)) retainedIds.add(row.id);
        }
    }
    const removableIds = explicitIds.filter(id => !retainedIds.has(id));
    if (retainedIds.size && !removableIds.length) return { count: 0, retainedIds: [...retainedIds] };
    if (entity === 'sample') {
        return single && removableIds.length ? db.sample.delete({ where: { id: removableIds[0] } })
            : db.sample.deleteMany({ where: { id: { in: removableIds } } });
    }
    return single && removableIds.length ? db.workItem.delete({ where: { id: removableIds[0] } })
        : db.workItem.deleteMany({ where: { id: { in: removableIds } } });
}

module.exports = { createSampleFixture, createWorkItemFixture, createSamplesFixture, createWorkItemsFixture, createAuthTokenFixture, cleanupWorkflowFixtures };
