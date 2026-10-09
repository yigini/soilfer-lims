const { randomUUID } = require('node:crypto');
const rules = require('./workflowStateRules');
const { hasPermission } = require('../config/roles');
const { loadSelectionContext, loadSelectionEvidence } = require('./reportedValueSelectionContext');
const { selectionOutputs, automaticReportedChoice, explicitReportedChoice } = require('./reportedValueChoiceContract');
const { assertReportedSelectionGroup, assertSelectionGroupStructure } = require('./reportedValueGroupContract');

function choiceFor(item, context, explicit) {
    if (explicit != null) return explicitReportedChoice(item, context.lineage, explicit, context.limits);
    const automatic = automaticReportedChoice(item, context.lineage, context.policy.value, context.limits);
    if (!automatic.choice) throw new rules.TransitionError('Choose the reported value for this test before accepting it.', 409,
        'REPORTED_VALUE_SELECTION_REQUIRED', { workItemId: item.id, reasons: automatic.reasons,
            eligibleAttempts: context.lineage.eligible.map(row => ({ attemptId: row.attempt.id, attemptNo: row.attempt.attemptNo,
                status: row.attempt.status, finalResultIds: row.results.map(result => result.id), limit: context.limits[row.attempt.id] })) });
    return automatic.choice;
}
async function currentRows(tx, workItemId) {
    const history = await tx.reportedValueSelection.findMany({ where: { workItemId } });
    const replaced = new Set(history.map(row => row.supersedesId).filter(Boolean));
    return history.filter(row => !replaced.has(row.id));
}
async function preflightReportedSelection(tx, item, explicit) {
    const context = await loadSelectionContext(tx, item);
    return { context, choice: choiceFor(item, context, explicit) };
}
async function appendReportedSelection(tx, item, actor, explicit, options = {}) {
    rules.requireTransaction(tx);
    if (!hasPermission(actor, 'APPROVE_RESULTS')) throw new rules.TransitionError('Review is not authorized.', 403, 'REVIEW_FORBIDDEN');
    const freshItem = await tx.workItem.findUnique({ where: { id: item.id } });
    if (!freshItem || freshItem.status !== 'ACCEPTED') throw new rules.TransitionError('Accept the work item in the selection transaction.', 409, 'ITEM_NOT_SUBMITTED');
    const scopedSample = await tx.sample.findUnique({ where: { id: freshItem.sampleId } });
    if (!scopedSample) throw new rules.TransitionError('Sample not found.', 404, 'SAMPLE_NOT_FOUND');
    rules.assertScope(actor, scopedSample);
    const { context, choice } = await preflightReportedSelection(tx, freshItem, explicit);
    const previous = await currentRows(tx, item.id), params = selectionOutputs(freshItem);
    if (previous.length) assertSelectionGroupStructure(previous, params);
    const previousGroup = previous[0]?.selectionGroupId || null;
    if (Object.hasOwn(options, 'expectedGroupId') && options.expectedGroupId !== previousGroup) {
        throw new rules.TransitionError('The selection changed. Reload before choosing again.', 409, 'REPORTED_VALUE_SELECTION_CONFLICT');
    }
    const selectedBy = rules.actorName(actor), selectedAt = new Date(), selectionGroupId = randomUUID();
    const selected = context.lineage.eligible.filter(row => choice.attemptIds.includes(row.attempt.id));
    const evidence = { version: 1, workItemId: item.id, analysis: freshItem.analysis,
        attempts: selected.map(row => ({ id: row.attempt.id, status: row.attempt.status, evidenceHash: row.attempt.evidenceHash })),
        results: selected.flatMap(row => row.results).map(row => ({ id: row.id, attemptId: row.attemptId, param: row.param,
            value: row.value, numericValue: row.numericValue ?? null, unit: row.unit ?? null, censoring: row.censoring ?? 'NONE',
            methodologyId: row.methodologyId ?? null, replicateNo: row.replicateNo, flags: row.flags ?? null,
            provenance: row.provenance, basis: row.basis ?? null })),
        outputs: choice.outputs, policy: { key: 'results.reportedValueRule', ...context.policy },
        rule: choice.rule, selectedBy, selectedAt: selectedAt.toISOString(), backfill: options.backfill === true };
    const common = { workItemId: item.id, selectionGroupId, mode: choice.mode, attemptIds: JSON.stringify(choice.attemptIds),
        rule: choice.rule, policyKey: 'results.reportedValueRule', policyVersion: context.policy.version,
        policyRule: context.policy.value, qcRuleSnapshot: JSON.stringify(selected.map(row => context.limits[row.attempt.id])),
        evidenceSnapshot: JSON.stringify(evidence), lineageSnapshot: JSON.stringify(context.lineage.snapshot),
        outputParams: JSON.stringify(params), reason: choice.reason, selectedBy, selectedAt, backfill: options.backfill === true };
    try {
        const rows = [];
        for (const output of choice.outputs) {
            rows.push(await tx.reportedValueSelection.create({ data: { ...common, ...output, id: randomUUID(),
                resultIds: JSON.stringify([...output.resultIds].sort()), supersedesId: previous.find(row => row.analysisCode === output.analysisCode)?.id || null } }));
        }
        await tx.auditLog.create({ data: { id: randomUUID(), entity: 'REPORTED_VALUE_SELECTION', entityId: selectionGroupId,
            action: options.backfill ? 'REPORTED_VALUE_BACKFILLED' : 'REPORTED_VALUE_SELECTED', performedBy: selectedBy,
            timestamp: selectedAt, sampleId: freshItem.sampleId, labId: context.sample.assignedLab || context.sample.labId,
            analysisCode: freshItem.analysis, details: JSON.stringify({ workItemId: item.id, selectionIds: rows.map(row => row.id),
                supersedesGroupId: previousGroup, rule: choice.rule, reason: choice.reason }) } });
        return rows;
    } catch (error) {
        if (['P2002','P2034','P1008'].includes(error.code) || /SQLITE_BUSY|database is locked/.test(error.message || '')) {
            throw new rules.TransitionError('The selection changed. Reload before choosing again.', 409, 'REPORTED_VALUE_SELECTION_CONFLICT');
        }
        throw error;
    }
}
async function readReportedSelection(tx, item) {
    const context = await loadSelectionEvidence(tx, item), rows = await currentRows(tx, item.id);
    assertReportedSelectionGroup(rows, selectionOutputs(item), context.attempts, context.results);
    return { rows, context };
}
async function reviewItem(tx, workItemId, actor) {
    if (!hasPermission(actor, 'APPROVE_RESULTS')) throw new rules.TransitionError('Review is not authorized.', 403, 'REVIEW_FORBIDDEN');
    const item = await tx.workItem.findUnique({ where: { id: workItemId } });
    if (!item) throw new rules.TransitionError('Work item not found.', 404, 'WORK_ITEM_NOT_FOUND');
    const sample = await tx.sample.findUnique({ where: { id: item.sampleId } });
    if (!sample) throw new rules.TransitionError('Sample not found.', 404, 'SAMPLE_NOT_FOUND');
    rules.assertScope(actor, sample);
    return { item, sample };
}

function previewChoice(item, context, choice) {
    try { return { allowed: true, choice: explicitReportedChoice(item, context.lineage, choice, context.limits) }; }
    catch (error) {
        if (!error.code?.startsWith('REPORTED_VALUE_')) throw error;
        return { allowed: false, code: error.code, error: error.message };
    }
}

// Preview uses the same complete-attempt authority as acceptance. It never
// writes a selection, review decision, QC evaluation, or attempt event.
async function reviewReportedSelection(db, workItemId, actor, explicit) {
    return rules.inTransaction(db, async tx => {
        const { item } = await reviewItem(tx, workItemId, actor);
        if (require('./workItemKinds').isNonMeasurement(item)) return { workItemId: item.id, notRequired: true };
        const context = await loadSelectionContext(tx, item);
        if (explicit !== undefined) return previewChoice(item, context, explicit);
        const rows = await currentRows(tx, item.id);
        let currentCode = null;
        try { assertReportedSelectionGroup(rows, selectionOutputs(item), context.attempts, context.results); }
        catch (error) {
            if (!['REPORTED_VALUE_SELECTION_REQUIRED','REPORTED_VALUE_SELECTION_STALE'].includes(error.code)) throw error;
            currentCode = error.code;
        }
        const attempts = [];
        for (const attempt of [...context.attempts].sort((a,b) => a.attemptNo-b.attemptNo || a.id.localeCompare(b.id))) {
            const candidate = context.lineage.eligible.find(row => row.attempt.id === attempt.id);
            const results = candidate?.results || [];
            const attemptItem = { ...item, batchId: attempt.qcBatchId || attempt.batchId };
            const gates = await Promise.all(results.map(result => require('./qcGateService').forResult(result, {
                db: tx, sample: context.sample, workItems: [attemptItem] })));
            attempts.push({ id: attempt.id, attemptNo: attempt.attemptNo, status: attempt.status,
                batchId: attempt.qcBatchId || attempt.batchId, qcGates: gates,
                analyst: attempt.authorName || attempt.author, recordedAt: context.limits[attempt.id]?.recordedAt || null,
                reason: attempt.reason, note: attempt.note, eligible: Boolean(candidate), limit: context.limits[attempt.id] || null,
                results: results.map(row => ({ id: row.id, param: row.param, replicateNo: row.replicateNo,
                    valueText: row.value, unit: row.unit, censoring: row.censoring ?? 'NONE' })),
                option: candidate ? previewChoice(item, context, { mode: 'ATTEMPT', attemptIds: [attempt.id] }) : null });
        }
        return { workItemId: item.id, analysisCode: item.analysis, status: item.status, policy: context.policy,
            automatic: automaticReportedChoice(item, context.lineage, context.policy.value, context.limits), attempts,
            mean: previewChoice(item, context, { mode: 'MEAN', attemptIds: context.lineage.eligible.map(row => row.attempt.id) }),
            current: { groupId: rows[0]?.selectionGroupId || null, code: currentCode, rows } };
    });
}

async function replaceReportedSelection(db, workItemId, actor, request) {
    if (!request || !Object.hasOwn(request, 'expectedGroupId') ||
        request.expectedGroupId !== null && typeof request.expectedGroupId !== 'string' ||
        Object.keys(request).some(key => !['expectedGroupId','selection'].includes(key)) || !request.selection) {
        throw new rules.TransitionError('Reload the current selection before choosing again.', 409, 'REPORTED_VALUE_SELECTION_CONFLICT');
    }
    return rules.inTransaction(db, async tx => {
        const { item, sample } = await reviewItem(tx, workItemId, actor);
        if (require('./workItemKinds').isNonMeasurement(item)) throw new rules.TransitionError('This work item has no reported analytical value.', 409, 'REPORTED_VALUE_SELECTION_INVALID');
        require('./resultEvidenceService').assertAmendable(sample);
        return appendReportedSelection(tx, item, actor, request.selection, { expectedGroupId: request.expectedGroupId });
    });
}

module.exports = { preflightReportedSelection, appendReportedSelection, readReportedSelection,
    reviewReportedSelection, replaceReportedSelection };
