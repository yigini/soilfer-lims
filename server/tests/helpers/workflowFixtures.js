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

module.exports = { createSampleFixture, createWorkItemFixture, createSamplesFixture, createWorkItemsFixture, createAuthTokenFixture };
