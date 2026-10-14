const { randomUUID } = require('node:crypto');
const workflow = require('../workflowContract');
const { hasPermission } = require('../config/roles');
const rules = require('./workflowStateRules');
const { TransitionError } = rules;
const GATE_FIELDS = Object.freeze({ DRYING: 'dryingStatus', PREPARATION: 'preparationStatus' });

function assertGate(gate) {
    if (!GATE_FIELDS[gate]) throw new TransitionError('Unknown preparation gate.', 400, 'INVALID_PREPARATION_GATE');
}

function assertAmendable(sample) {
    if (['APPROVED', 'ARCHIVED', 'DISPOSED'].includes(workflow.normalizeSampleState(sample.status))) {
        throw new TransitionError('A manager amendment is required for an approved sample.', 409, 'AMENDMENT_WORKFLOW_REQUIRED');
    }
}

function unclearedEvents(events) {
    const latest = new Map();
    for (const event of events) {
        const key = `${event.resultId}:${event.gate}`;
        const time = new Date(event.createdAt).getTime();
        const previous = latest.get(key);
        if (!previous || time > previous.time) latest.set(key, { time, events: [event] });
        else if (time === previous.time) previous.events.push(event);
    }
    // An ambiguous equal-time clear cannot conceal a recorded revert.
    return [...latest.values()].flatMap(group => group.events.filter(event => event.eventType === 'PREP_REVERTED'));
}

async function currentEvents(tx, sampleId) {
    return tx.resultEvidenceEvent.findMany({ where: { sampleId: String(sampleId), result: { isCurrent: true } } });
}

async function assertNoPreparationRevert(tx, sampleId, resultIds = null) {
    const events = resultIds === null ? await currentEvents(tx, sampleId) : await tx.resultEvidenceEvent.findMany({
        where: { sampleId: String(sampleId), resultId: { in: resultIds } }
    });
    const blocked = unclearedEvents(events);
    if (blocked.length) throw new TransitionError('Preparation was reverted for current results. Re-enter them or obtain a manager clearance.',
        409, 'PREP_REVERTED_RESULTS', { resultIds: [...new Set(blocked.map(event => event.resultId))] });
}

async function appendEvent(tx, result, gate, eventType, reason, actor) {
    const previous = await tx.resultEvidenceEvent.findFirst({
        where: { resultId: result.id, gate }, orderBy: { createdAt: 'desc' }
    });
    const createdAt = new Date(Math.max(Date.now(), previous ? new Date(previous.createdAt).getTime() + 1 : 0));
    return tx.resultEvidenceEvent.create({ data: {
        id: randomUUID(), resultId: result.id, sampleId: result.sampleId, gate, eventType,
        reason: rules.requireReason(reason), actor: rules.actorName(actor), createdAt
    } });
}

/** Called inside the gate-revert transaction before the DONE flag changes. */
async function recordPreparationRevert(tx, sample, gate, reason, actor) {
    if (!tx || typeof tx.$transaction === 'function') {
        throw new TransitionError('Preparation evidence requires the gate-revert transaction.', 409, 'EVIDENCE_TRANSACTION_REQUIRED');
    }
    assertGate(gate);
    assertAmendable(sample);
    rules.assertScope(actor, sample);
    rules.requireReason(reason);
    if (sample[GATE_FIELDS[gate]] !== 'DONE') {
        throw new TransitionError('Only a completed gate can be reverted.', 409, 'GATE_NOT_DONE');
    }
    const results = await tx.result.findMany({ where: { sampleId: sample.id, isCurrent: true } });
    for (const result of results) await appendEvent(tx, result, gate, 'PREP_REVERTED', reason, actor);
    return results.length;
}

async function clearPreparationRevert(sampleId, resultId, gate, reason, actor, tx = null) {
    assertGate(gate);
    rules.requireReason(reason);
    if (!hasPermission(actor, 'APPROVE_RESULTS')) {
        throw new TransitionError('A manager must clear preparation evidence.', 403, 'PREPARATION_CLEARANCE_FORBIDDEN');
    }
    return rules.inTransaction(tx, async client => {
        const sample = await client.sample.findUnique({ where: { id: String(sampleId) } });
        if (!sample) throw new TransitionError('Sample not found.', 404, 'SAMPLE_NOT_FOUND');
        rules.assertScope(actor, sample);
        if (sample[GATE_FIELDS[gate]] !== 'DONE') throw new TransitionError('The gate must be completed again before clearance.', 409, 'GATE_NOT_DONE');
        const result = await client.result.findFirst({ where: { id: String(resultId), sampleId: sample.id, isCurrent: true } });
        if (!result) throw new TransitionError('A current result on this sample is required.', 409, 'CURRENT_RESULT_REQUIRED');
        const blocked = unclearedEvents(await client.resultEvidenceEvent.findMany({ where: { resultId: result.id, gate } }));
        if (!blocked.length) return { cleared: false, event: null };
        const event = await appendEvent(client, result, gate, 'PREP_REVERT_CLEARED', reason, actor);
        await client.auditLog.create({ data: {
            id: randomUUID(), entity: 'RESULT', entityId: result.id, action: 'PREP_REVERT_CLEARED',
            performedBy: rules.actorName(actor), details: JSON.stringify({ gate, reason: reason.trim(), eventId: event.id }),
            sampleId: sample.id, labId: sample.assignedLab || null, timestamp: event.createdAt
        } });
        return { cleared: true, event };
    });
}

module.exports = { GATE_FIELDS, assertAmendable, unclearedEvents, assertNoPreparationRevert,
    recordPreparationRevert, clearPreparationRevert };
