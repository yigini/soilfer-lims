const { runAnalyteCode } = require('./analysisCodesService');
const { QC_RUN_INCLUDE } = require('./qcRunViewService');

// The current pointer may move after repeat/reject disposition. The old join,
// observations and verdicts remain the old run's immutable membership history.
async function repeatSource(db, item, targetBatchId) {
    if (!item.batchId || item.batchId === targetBatchId) return null;
    const old = await db.batch.findUnique({ where: { id: item.batchId }, include: QC_RUN_INCLUDE });
    const member = old?.positions.some(position => position.workItems.some(link => link.workItemId === item.id));
    const analyte = old?.analytes.find(row => row.analysisCode === runAnalyteCode(old, item.analysis));
    if (!member || !['REPEAT_ORDERED', 'REJECTED'].includes(analyte?.status) ||
        ['SUBMITTED', 'ACCEPTED', 'WAIVED', 'CANCELLED'].includes(item.status)) {
        throw Object.assign(new Error('A work item already belongs to another run.'),
            { statusCode: 409, code: 'QC_WORK_ITEM_ALREADY_BATCHED', details: { workItemId: item.id } });
    }
    return item.batchId;
}

module.exports = { repeatSource };
