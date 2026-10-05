const crypto = require('crypto');
const { normalizeAnalysisCodes } = require('./analysisCodesService');
const { resolveDefaultSelections } = require('./methodResolution');
const { IntakeError } = require('./intakeErrors');
const workflow = require('../workflowContract');
const rules = require('./workflowStateRules');
const { createWorkItem } = require('./workItemStateService');

async function prepare(db, sample) {
    const raw = typeof sample.requiredAnalyses === 'string' ? JSON.parse(sample.requiredAnalyses) : sample.requiredAnalyses || [];
    const codes = normalizeAnalysisCodes(raw);
    const existing = await db.workItem.findMany({ where: { sampleId: String(sample.id), duplicateOf: null } });
    const existingCodes = new Set(existing.map(item => item.analysis));
    const selections = await resolveDefaultSelections(codes.filter(code => !existingCodes.has(code)), sample.assignedLab, db);
    const methods = new Map(existing.map(item => [item.analysis, item.methodologyId]));
    for (const [code, selection] of selections) {
        if (selection.error) throw new IntakeError(422, { code: 'INTAKE_METHOD_DEFAULT_INVALID', message: selection.error, analysis: code });
        methods.set(code, selection.method?.id || null);
    }
    const catalogue = await db.analysis.findMany({ where: { code: { in: codes } }, include: { category: true } });
    const metadata = new Map(catalogue.map(analysis => [analysis.code, analysis]));
    codes.sort((a, b) => (metadata.get(a)?.executionOrder ?? 100) - (metadata.get(b)?.executionOrder ?? 100));
    return { codes, methods, existingCodes, metadata };
}
async function generate(tx, sample, plan, actor = 'system:intake-work-generation') {
    if (!tx || typeof tx.$transaction === 'function') throw new IntakeError(409, { code: 'INTAKE_TRANSACTION_REQUIRED', message: 'Work generation requires an intake transaction.' });
    sample = await tx.sample.findUnique({ where: { id: String(sample.id) } });
    if (!sample) throw new rules.TransitionError('Sample not found.', 404, 'SAMPLE_NOT_FOUND');
    rules.assertScope(actor, sample);
    require('./resultEvidenceService').assertAmendable(sample);
    plan ||= await prepare(tx, sample);
    const generated = [];
    const gates = ['DRYING', 'PREPARATION'];
    for (const code of [...new Set([...gates, ...plan.codes])]) {
        if (plan.existingCodes.has(code)) continue;
        const metadata = plan.metadata.get(code);
        const item = await createWorkItem({
            id: crypto.randomUUID(), sampleId: String(sample.id), labId: sample.assignedLab || null, assignedLab: sample.assignedLab,
            analysis: code, category: gates.includes(code) ? 'Operational Gates' : metadata?.category?.name || metadata?.category?.id || null,
            status: workflow.WORK_ITEM_STATES.NOT_ASSIGNED, assignedTo: null, priority: 'NORMAL', methodologyId: plan.methods.get(code) || null,
            history: JSON.stringify([{ status: workflow.WORK_ITEM_STATES.NOT_ASSIGNED, timestamp: new Date().toISOString(), note: 'Work Item Generated' }])
        }, actor, { tx, audit: { entity: 'SAMPLE', entityId: String(sample.id), action: 'WORKITEM_GENERATED',
            details: `Generated ${gates.includes(code) ? 'gate' : 'analysis'}: ${metadata?.name || code}` } });
        generated.push(item);
    }
    const existingRevision = await tx.sampleOrderRevision.findFirst({ where: { sampleId: String(sample.id) } });
    if (!existingRevision) {
        const revision = await tx.sampleOrderRevision.create({ data: { sampleId: String(sample.id), version: 1, status: 'ACTIVE',
            reason: 'Initial order generated at intake', requestedBy: sample.receivedBy || rules.actorName(actor),
            authorizedBy: rules.actorName(actor), authorizedAt: new Date() } });
        for (const code of plan.codes) await tx.orderLine.create({ data: { revisionId: revision.id, analysis: code, methodologyId: plan.methods.get(code) || null, isRequired: true, status: 'ACTIVE' } });
    }
    return generated;
}
module.exports = { normalizeAnalysisCodes, prepare, generate };
