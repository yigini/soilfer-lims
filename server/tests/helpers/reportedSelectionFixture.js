const jwt = require('jsonwebtoken');
const rules = require('../../services/workflowStateRules');
const fs = require('node:fs');
const path = require('node:path');

// Reader fixtures append through the actual selection authority. This helper
// cannot create results, accept work, change QC, or bypass source validation.
async function selectReviewedFixtureItem(db, workItemId, actorOrToken, choice) {
    rules.assertFixtureContext();
    const databases = await db.$queryRawUnsafe('PRAGMA database_list');
    const file = databases.find(row => row.name === 'main')?.file;
    if (!file || !fs.existsSync(file) || !/^tests\/\.tmp\/[^/]+\.db$/.test(
        path.relative(path.resolve(__dirname, '../..'), fs.realpathSync(file)).replace(/\\/g, '/'))) {
        throw Error('Reported selection fixture requires an owned test file.');
    }
    const actor = typeof actorOrToken === 'string' ? jwt.decode(actorOrToken) : actorOrToken;
    return rules.inTransaction(db, async tx => {
        const item = await tx.workItem.findUnique({ where: { id: workItemId } });
        if (!item) throw Error('Reported selection fixture requires an existing accepted owner.');
        const retained = await tx.result.findMany({ where: { sampleId: item.sampleId }, orderBy: { id: 'asc' } });
        const rows = await require('../../services/reportedValueSelectionService').appendReportedSelection(tx, item, actor, choice);
        expect(await tx.result.findMany({ where: { sampleId: item.sampleId }, orderBy: { id: 'asc' } })).toEqual(retained);
        return rows;
    });
}
module.exports = { selectReviewedFixtureItem };
