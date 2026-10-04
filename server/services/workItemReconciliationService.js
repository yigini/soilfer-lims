const crypto = require('node:crypto');
const workflow = require('../workflowContract');
const { normalizeAnalysisCodes } = require('./analysisCodesService');
const { getAnalysisName, getAnalysisCategory } = require('./analysisService');
const rules = require('./workflowStateRules');
const evidence = require('./resultEvidenceService');
const workItemState = require('./workItemStateService');

async function preflightDefaults(codes, sample, existingCodes = [], db) {
    const resolved = new Map();
    const selections = await require('../services/methodResolution').resolveDefaultSelections(codes.filter(c => !existingCodes.includes(c)), sample.assignedLab || sample.labId, db);
    for (const [analysisCode, selection] of selections) {
        if (selection.error) throw new Error(selection.error);
        resolved.set(analysisCode, selection.method?.id || null);
    }
    return resolved;
}

/**
 * SD-03: Reconcile Work Items when sample analysis list changes
 * Three-way reconcile:
 * 1. NOT_ASSIGNED, no result -> Delete row, audit deletion
 * 2. Assigned or in progress, no result -> Require reason; set WAIVED with reason and actor; audit
 * 3. Any result recorded (current or superseded) -> Refuse with 409 naming analysis and result
 */
async function reconcileWorkItems(tx, sample, targetAnalyses, user, reason) {
    sample = await tx.sample.findUnique({ where: { id: String(sample.id) } });
    if (!sample) throw new rules.TransitionError('Sample not found.', 404, 'SAMPLE_NOT_FOUND');
    rules.assertScope(user, sample);
    evidence.assertAmendable(sample);
    const performedBy = rules.actorName(user);
    const { id } = sample;
    const labId = sample.assignedLab || null;
    const targetList = Array.isArray(targetAnalyses) ? targetAnalyses : [];

    const uniqueTarget = normalizeAnalysisCodes(targetList);
    const targetSet = new Set(uniqueTarget);

    const operationalGates = ['DRYING', 'PREPARATION', ...workflow.CLOSURE_TASK_ANALYSES];
    const existingItems = await tx.workItem.findMany({
        where: {
            sampleId: String(id),
            analysis: { notIn: operationalGates }
        }
    });

    const itemsToRemove = existingItems.filter(item => !targetSet.has(item.analysis) && item.status !== 'WAIVED');

    // Refuse before any mutation: a canonical item may still be referenced by
    // a marked duplicate, including a waived duplicate outside the removal set.
    const canonicalRemovalIds = itemsToRemove.filter(item => item.duplicateOf == null).map(item => item.id);
    const duplicateReferences = canonicalRemovalIds.length ? await tx.workItem.findMany({
        where: { duplicateOf: { in: canonicalRemovalIds } },
        select: { id: true, analysis: true }
    }) : [];
    if (duplicateReferences.length) {
        return {
            conflict: true,
            status: 409,
            code: 'WORKITEM_DUPLICATES_PRESENT',
            error: 'Cannot remove an analysis while marked duplicate work items refer to its canonical item.',
            refused: duplicateReferences
        };
    }


    // 1. Check for recorded results on any items to be removed
    const conflicts = [];
    for (const item of itemsToRemove) {
        let recordedResult = null;
        if (item.result && String(item.result).trim() !== '') {
            recordedResult = item.result;
        } else {
            const dbResult = await tx.result.findFirst({
                where: {
                    sampleId: String(id),
                    param: item.analysis
                }
            });
            if (dbResult) {
                recordedResult = dbResult.value || (dbResult.numericValue != null ? String(dbResult.numericValue) : 'Recorded');
            }
        }

        if (recordedResult) {
            conflicts.push({
                analysis: item.analysis,
                workItemId: item.id,
                result: recordedResult
            });
        }
    }

    if (conflicts.length > 0) {
        return {
            conflict: true,
            status: 409,
            error: `Cannot remove analysis '${conflicts[0].analysis}': a result is already recorded (${conflicts[0].result})`,
            conflicts,
            refused: conflicts
        };
    }

    const resolutionPaths = {
        COMPLETED: 'REOPEN_TO_IN_PROGRESS',
        ON_HOLD: 'RELEASE_HOLD_TO_PRIOR_STATUS',
        AWAITING_VERIFICATION: 'COMPLETE_OPERATIONAL_VERIFICATION'
    };
    const blocked = itemsToRemove.filter(item => resolutionPaths[item.status]).map(item => ({
        workItemId: item.id, analysis: item.analysis, status: item.status, resolution: resolutionPaths[item.status]
    }));
    if (blocked.length) return { conflict: true, status: 409, code: 'WORKITEM_REMOVAL_STATE_CONFLICT',
        error: 'Resolve the work item state through its existing workflow before removing the analysis.',
        conflicts: blocked, refused: blocked };

    // 2. Check for reason if any assigned / in-progress item is being removed
    const assignedOrInProgress = itemsToRemove.filter(i => i.status !== workflow.WORK_ITEM_STATES.NOT_ASSIGNED);
    if (assignedOrInProgress.length > 0 && (!reason || String(reason).trim() === '')) {
        return {
            conflict: true,
            status: 400,
            error: `A reason is required to remove or waive in-progress analysis '${assignedOrInProgress[0].analysis}'.`
        };
    }

    const existingCodeSet = new Set(existingItems.map(i => i.analysis));
    const codesToAdd = uniqueTarget.filter(code => !existingCodeSet.has(code));
    const defaultMethods = await preflightDefaults(codesToAdd, sample, [], tx);

    const deletedItems = [];
    const waivedItems = [];
    const addedItems = [];

    // 3. Process Removals and Waivers
    for (const item of itemsToRemove) {
        if (item.status === workflow.WORK_ITEM_STATES.NOT_ASSIGNED) {
            await tx.workItem.delete({ where: { id: item.id } });
            await tx.auditLog.create({
                data: {
                    id: crypto.randomUUID(),
                    entity: 'WORKITEM',
                    entityId: item.id,
                    action: 'WORKITEM_DELETED',
                    details: `${performedBy} removed unstarted analysis ${item.analysis}`,
                    performedBy: performedBy,
                    timestamp: new Date(),
                    sampleId: String(id),
                    analysisCode: item.analysis,
                    labId: sample.assignedLab || sample.labId
                }
            });
            deletedItems.push(item.analysis);
        } else {
            const history = typeof item.history === 'string' ? JSON.parse(item.history) : (item.history || []);
            history.push({
                status: workflow.WORK_ITEM_STATES.WAIVED,
                reason: String(reason).trim(),
                waivedBy: performedBy,
                timestamp: new Date().toISOString()
            });

            await workItemState.transitionWorkItem(item.id, workflow.WORK_ITEM_STATES.WAIVED, user, reason,
                { reanalysisReason: String(reason).trim(), history: JSON.stringify(history) }, tx,
                { expected: item, audit: { action: 'WORKITEM_WAIVED',
                    details: `${performedBy} waived ${item.analysis}. Reason: ${String(reason).trim()}` } });
            waivedItems.push({ analysis: item.analysis, reason: String(reason).trim() });
        }
    }

    // 4. Process Additions

    if (codesToAdd.length > 0) {
        const catalogueRecords = await tx.analysis.findMany({
            where: { code: { in: codesToAdd } },
            select: { code: true, executionOrder: true }
        });
        const orderMap = {};
        catalogueRecords.forEach(a => { orderMap[a.code] = a.executionOrder ?? 100; });
        codesToAdd.sort((a, b) => (orderMap[a] ?? 100) - (orderMap[b] ?? 100));

        for (const analysisCode of codesToAdd) {
            const name = await getAnalysisName(analysisCode, tx);
            const category = await getAnalysisCategory(analysisCode, tx);
            const wiId = crypto.randomUUID();
            const history = [{
                status: workflow.WORK_ITEM_STATES.NOT_ASSIGNED,
                timestamp: new Date().toISOString(),
                note: 'Work Item Generated'
            }];

            const defaultMethodId = defaultMethods.get(analysisCode) || null;

            await workItemState.createWorkItem({
                    id: wiId,
                    sampleId: String(id),
                    labId: labId,
                    assignedLab: sample.assignedLab,
                    analysis: analysisCode,
                    category: category,
                    status: workflow.WORK_ITEM_STATES.NOT_ASSIGNED,
                    assignedTo: null,
                    priority: 'NORMAL',
                    methodologyId: defaultMethodId,
                    history: JSON.stringify(history)
            }, user, { tx, audit: { action: 'WORKITEM_GENERATED', details: `Generated analysis: ${name}` } });

            addedItems.push(analysisCode);
        }
    }

    return {
        conflict: false,
        added: addedItems,
        waived: waivedItems,
        removed: deletedItems,
        summary: `${addedItems.length} added, ${waivedItems.length} waived, ${deletedItems.length} removed`
    };
}

async function reconcileWorkItemsForSample(sample, targetAnalyses, user, reason, tx = null) {
    // A parent transaction must see failures and roll back its entire order edit.
    if (tx) return reconcileWorkItems(tx, sample, targetAnalyses, user, reason);
    try {
        return await rules.inTransaction(null, client => reconcileWorkItems(client, sample, targetAnalyses, user, reason));
    } catch (error) {
        if (error.code === 'P2003' || error.code === 'SQLITE_CONSTRAINT_FOREIGNKEY') {
            return { conflict: true, status: 409, code: 'WORKITEM_REFERENCE_CONFLICT',
                error: 'A referenced work item cannot be removed; no reconciliation changes were saved.' };
        }
        throw error;
    }
}

module.exports = { reconcileWorkItemsForSample };
