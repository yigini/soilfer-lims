const { createHash } = require('node:crypto');
const { TransitionError, requireTransaction, actorName } = require('./workflowStateRules');

function refused() {
    return new TransitionError('Reload the recorded partial repeat and its proven execution lineage.', 409, 'PARTIAL_REPEAT_CONTEXT_MISMATCH');
}
function details(event) {
    try {
        const value = JSON.parse(event.details);
        if (!value || typeof value !== 'object' || Array.isArray(value)) throw refused();
        return value;
    } catch { throw refused(); }
}
async function chain(db, item, tip) {
    const attempts = await db.workAttempt.findMany({ where: { workItemId: item.id } });
    const byId = new Map(attempts.map(row => [row.id, row])), rows = [], seen = new Set();
    let row = byId.get(tip.id);
    while (row) {
        if (seen.has(row.id) || row.legacyAttemptNoConflict != null || typeof row.evidenceData !== 'string' || !row.evidenceHash ||
            createHash('sha256').update(row.evidenceData).digest('hex') !== row.evidenceHash) throw refused();
        try {
            const evidence = JSON.parse(row.evidenceData);
            if (!evidence || typeof evidence !== 'object' || Array.isArray(evidence)) throw refused();
        }
        catch { throw refused(); }
        seen.add(row.id); rows.push(row);
        if (!row.parentAttemptId) {
            if (row.attemptNo !== 1) throw refused();
            break;
        }
        const parent = byId.get(row.parentAttemptId);
        if (!parent || parent.attemptNo >= row.attemptNo || !['QUESTIONED', 'INVALIDATED'].includes(parent.status)) throw refused();
        await creation(db, item, row);
        row = parent;
    }
    if (!rows.length || rows[0].id !== tip.id) throw refused();
    return rows;
}
async function creation(db, item, attempt) {
    const events = await db.auditLog.findMany({ where: { entity: 'WORK_ATTEMPT', entityId: attempt.id, action: 'CREATED' } });
    if (events.length !== 1) throw refused();
    const event = events[0], value = details(event);
    const sample = item.sample || await db.sample.findUnique({ where: { id: item.sampleId } });
    if (!sample || event.sampleId !== item.sampleId || event.labId !== (sample.assignedLab || item.labId) ||
        event.analysisCode !== item.analysis || event.performedBy !== attempt.requestedBy ||
        value.from !== null || value.to !== 'OPEN' || value.reason !== attempt.reason || value.note !== attempt.note ||
        !attempt.requestedBy || !attempt.requestedAt) throw refused();
    return value;
}
function numbers(rows) {
    if (rows.some(row => !Number.isInteger(row.replicateNo) || row.replicateNo < 1)) throw refused();
    return [...new Set(rows.map(row => row.replicateNo))].sort((a, b) => a - b);
}
function sameNumbers(a, b) { return JSON.stringify(a) === JSON.stringify(b); }

// #261: only existing immutable parent links and actual Result identities prove
// the lineage. Attempt numbers order those links; they never select an owner.
async function partialReplacementSources(tx, item, parent, actor) {
    requireTransaction(tx);
    if (parent.status !== 'RECORDED' || !parent.parentAttemptId || parent.qcBatchId !== (item.batchId ?? null)) throw refused();
    const lineage = await chain(tx, item, parent), ids = lineage.map(row => row.id);
    const historical = await tx.result.findMany({ where: { sampleId: item.sampleId, param: item.analysis, attemptId: { in: ids } } });
    const current = await tx.result.findMany({ where: { sampleId: item.sampleId, param: item.analysis, isCurrent: true, supersededBy: null } });
    const owned = current.filter(row => row.attemptId === parent.id);
    if (!owned.length || current.some(row => !ids.includes(row.attemptId)) ||
        current.length !== numbers(current).length || !sameNumbers(numbers(current), numbers(historical)) ||
        owned.length >= current.length || owned.some(row => row.batchId !== parent.qcBatchId || row.methodologyId !== item.methodologyId ||
            row.equipmentId !== parent.instrumentId) || !actorName(actor)) throw refused();
    const method = item.methodologyId ? await tx.methodology.findUnique({ where: { id: item.methodologyId } }) : null;
    if (item.methodologyId && !require('./methodResolution').isAvailable(method, item.analysis, item.sample?.assignedLab || item.labId) ||
        parent.executedMethodRevision !== (method?.version == null ? null : String(method.version))) throw refused();
    const run = await require('./resultWriteService').resolveResultRunContext(tx, item, { batchId: item.batchId ?? null });
    if (run.equipmentId !== parent.instrumentId || run.frozenMethodRevision && run.frozenMethodRevision.version !== method?.version) throw refused();
    return current.map(row => row.id).sort();
}

// CREATED.oldResultIds freezes the actual current owners at reservation. It is
// already part of the immutable attempt-event contract; no receipt or schema is
// changed. Ordinary repeat CREATED events have no old Result identities.
async function replacementSources(db, item, attempt) {
    if (!attempt?.parentAttemptId || attempt.reason !== 'INSTRUMENT_FAULT') return null;
    const events = await db.auditLog.findMany({ where: { entity: 'WORK_ATTEMPT', entityId: attempt.id, action: 'CREATED' } });
    if (!events.length) return null;
    if (events.length !== 1) throw refused();
    const value = details(events[0]);
    if (!Array.isArray(value.oldResultIds) || !value.oldResultIds.length) return null;
    if (attempt.workItemId !== item.id || !['OPEN', 'RECORDED'].includes(attempt.status)) throw refused();
    await creation(db, item, attempt);
    if (new Set(value.oldResultIds).size !== value.oldResultIds.length || value.oldResultIds.some(id => typeof id !== 'string')) throw refused();
    const attempts = await db.workAttempt.findMany({ where: { workItemId: item.id } });
    const parent = attempts.find(row => row.id === attempt.parentAttemptId);
    if (!parent || parent.status !== 'INVALIDATED' || parent.attemptNo >= attempt.attemptNo) throw refused();
    const lineage = await chain(db, item, parent), ids = lineage.map(row => row.id);
    const rows = await db.result.findMany({ where: { id: { in: value.oldResultIds } } });
    const historical = await db.result.findMany({ where: { sampleId: item.sampleId, param: item.analysis, attemptId: { in: ids } } });
    if (rows.length !== value.oldResultIds.length || rows.some(row => row.sampleId !== item.sampleId || row.param !== item.analysis || !ids.includes(row.attemptId)) ||
        rows.length !== numbers(rows).length || !sameNumbers(numbers(rows), numbers(historical)) ||
        !rows.some(row => row.attemptId === parent.id) || rows.every(row => row.attemptId === parent.id)) throw refused();
    return rows;
}
async function recordedReplacement(db, item, attempts, current) {
    const candidates = [];
    for (const attempt of attempts.filter(row => row.status === 'RECORDED' && current.some(result => result.attemptId === row.id))) {
        const sources = await replacementSources(db, item, attempt);
        if (sources && current.every(row => row.attemptId === attempt.id || sources.some(source => source.id === row.id))) candidates.push(attempt);
    }
    if (candidates.length > 1) throw refused();
    return candidates[0] || null;
}
async function assertReplacementComplete(tx, item, attempt) {
    const sources = await replacementSources(tx, item, attempt);
    if (!sources) return;
    const current = await tx.result.findMany({ where: { sampleId: item.sampleId, param: item.analysis,
        attemptId: attempt.id, isCurrent: true, supersededBy: null } });
    const actual = new Set(current.map(row => row.replicateNo)), missing = numbers(sources).filter(number => !actual.has(number));
    if (missing.length) throw new TransitionError('Record every replica in the replacement lineage before submitting.', 409,
        'ATTEMPT_REPLICATE_SET_INCOMPLETE', { workItemId: item.id, missingReplicateNumbers: missing });
}
module.exports = { partialReplacementSources, replacementSources, recordedReplacement, assertReplacementComplete };
