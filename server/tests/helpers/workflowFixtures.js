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

module.exports = { createSampleFixture, createWorkItemFixture, createSamplesFixture, createWorkItemsFixture };
