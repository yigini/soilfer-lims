const { normalizeAnalysisCodes } = require('./analysisCodesService');
const rules = require('./workflowStateRules');

function chooseOrderLine(item, revisions) {
    if (revisions.length > 1) return { cause: 'MULTIPLE_ACTIVE_REVISIONS' };
    if (revisions.length !== 1) return { cause: 'NO_LINE' };
    const codes = normalizeAnalysisCodes([item.analysis]);
    if (codes.length !== 1) return { cause: 'AMBIGUOUS_LINE' };
    const lines = revisions[0].lines.filter(line => line.status === 'ACTIVE');
    const linked = lines.filter(line => line.workItemId === item.id);
    const matches = linked.length ? linked : lines.filter(line => {
        const normalized = normalizeAnalysisCodes([line.analysis]);
        return line.workItemId == null && normalized.length === 1 && normalized[0] === codes[0];
    });
    if (matches.length !== 1) return { cause: matches.length ? 'AMBIGUOUS_LINE' : 'NO_LINE' };
    if (!normalizeAnalysisCodes([matches[0].analysis]).includes(codes[0])) return { cause: 'NO_LINE' };
    return { orderLineId: matches[0].id, revisionId: revisions[0].id,
        resolution: linked.length ? 'LINKED' : 'LEGACY_SINGLE_MATCH' };
}

async function inspectOrderLine(db, item) {
    const revisions = await db.sampleOrderRevision.findMany({ where: { sampleId: item.sampleId, status: 'ACTIVE' },
        include: { lines: true }, orderBy: { id: 'asc' } });
    return chooseOrderLine(item, revisions);
}

async function resolveOrderLine(tx, item) {
    rules.requireTransaction(tx);
    const outcome = await inspectOrderLine(tx, item);
    if (outcome.cause) throw new rules.TransitionError('A reasoned order revision with the complete analysis set is required before starting this execution.',
        409, 'ORDER_LINE_REQUIRED', { cause: outcome.cause, workItemId: item.id });
    return outcome.orderLineId;
}

module.exports = { chooseOrderLine, inspectOrderLine, resolveOrderLine };
