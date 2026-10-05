const workflow = require('../workflowContract');
const { TransitionError } = require('./workflowStateRules');
const GATE_FIELDS = Object.freeze({ DRYING: 'dryingStatus', PREPARATION: 'preparationStatus' });
const COMPLETE = Object.freeze(['COMPLETED', 'ACCEPTED', 'WAIVED']);

/** Read-only gate evaluation; present WorkItems always take precedence. */
function evaluateGateEvidence(sample, workItems, required = Object.keys(GATE_FIELDS)) {
    const gates = required.map(analysis => {
        const flag = sample[GATE_FIELDS[analysis]] ?? null;
        const items = workItems.filter(item => item.analysis === analysis);
        if (!items.length) return { analysis, flag, items: [], satisfied: flag === 'DONE', mismatch: false,
            source: flag === 'DONE' ? 'LEGACY_SAMPLE_FLAG' : 'MISSING_GATE_EVIDENCE' };
        const complete = items.every(item => COMPLETE.includes(workflow.normalizeWorkItemState(item.status)));
        return { analysis, flag, items: items.map(item => ({ workItemId: item.id, status: item.status })),
            satisfied: complete && flag === 'DONE', mismatch: complete !== (flag === 'DONE'), source: 'WORK_ITEM' };
    });
    const blocked = gates.filter(gate => !gate.satisfied);
    return { satisfied: blocked.length === 0, gates, blocked,
        legacyGates: gates.filter(gate => gate.source === 'LEGACY_SAMPLE_FLAG').map(gate => gate.analysis) };
}

async function loadGateEvidence(db, sample, required = Object.keys(GATE_FIELDS)) {
    const items = await db.workItem.findMany({ where: { sampleId: sample.id, analysis: { in: required } },
        select: { id: true, analysis: true, status: true } });
    return evaluateGateEvidence(sample, items, required);
}

function assertEvidence(report, codes = {}) {
    if (report.satisfied) return report;
    const mismatch = report.blocked.find(gate => gate.mismatch);
    const gate = mismatch || report.blocked[0];
    throw new TransitionError(mismatch ? 'Operational WorkItem and sample gate flag disagree.'
        : `${gate.analysis} must be completed before continuing.`, 409,
    mismatch ? 'GATE_STATE_MISMATCH' : codes[gate.analysis] || `${gate.analysis}_PREREQUISITE_BLOCKED`, { gates: report.blocked });
}

async function assertGateEvidence(db, sample, required, codes) {
    return assertEvidence(await loadGateEvidence(db, sample, required), codes);
}

function auditEvidence(report) {
    return report.legacyGates.length ? { gateEvidence: 'LEGACY_SAMPLE_FLAG', legacyGates: report.legacyGates } : { gateEvidence: 'WORK_ITEM' };
}

module.exports = { GATE_FIELDS, evaluateGateEvidence, loadGateEvidence, assertEvidence, assertGateEvidence, auditEvidence };
