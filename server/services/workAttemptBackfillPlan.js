const { createHash } = require('node:crypto');
const { HISTORICAL_ATTEMPT_STATUS } = require('./workAttemptContract');
const { historicalAttemptEvidence } = require('./workAttemptEvidence');

function fingerprint(value) {
    return createHash('sha256').update(JSON.stringify(value)).digest('hex');
}

// A read-only precursor to the additive #190 installer. No link, status,
// attempt number, evidence field, scientific value or schema is written here.
// The installer must refuse the whole apply when this plan has blockers.
function planHistoricalAttempts(db) {
    return db.transaction(() => {
        const attempts = db.prepare('SELECT * FROM "WorkAttempt" ORDER BY id').all();
        const results = db.prepare('SELECT * FROM "Result" ORDER BY id').all();
        const items = db.prepare('SELECT id,sampleId,analysis,status FROM "WorkItem" ORDER BY id').all();
        const batchIds = db.prepare('SELECT id FROM "Batch" ORDER BY id').all().map(row => row.id);
        const knownBatchIds = new Set(batchIds);
        const attemptsByItem = new Map(), itemsByMeasurement = new Map(), duplicateNumbers = new Map();
        for (const attempt of attempts) {
            const group = attemptsByItem.get(attempt.workItemId) || [];
            group.push(attempt); attemptsByItem.set(attempt.workItemId, group);
            const key = JSON.stringify([attempt.workItemId, attempt.attemptNo]);
            const numbered = duplicateNumbers.get(key) || [];
            numbered.push(attempt.id); duplicateNumbers.set(key, numbered);
        }
        for (const item of items) {
            const key = JSON.stringify([item.sampleId, item.analysis]);
            const group = itemsByMeasurement.get(key) || [];
            group.push(item); itemsByMeasurement.set(key, group);
        }
        // Pin 6054084454 permits only a one-to-one, non-null batch match for
        // several existing attempts. It never uses dates, numbers or values.
        const batchMatches = new Map(), matchingResultIds = new Map();
        for (const result of results.filter(row => row.attemptId == null)) {
            const candidates = itemsByMeasurement.get(JSON.stringify([result.sampleId, result.param])) || [];
            if (candidates.length !== 1) continue;
            const existing = attemptsByItem.get(candidates[0].id) || [];
            if (existing.length < 2 || result.batchId == null) continue;
            const matches = existing.filter(row => row.qcBatchId != null && row.qcBatchId === result.batchId);
            if (matches.length !== 1) continue;
            const selected = matches[0];
            if (result.isCurrent && selected.status === 'SUPERSEDED') continue;
            batchMatches.set(result.id, selected);
            const group = matchingResultIds.get(selected.id) || [];
            group.push(result.id); matchingResultIds.set(selected.id, group);
        }
        const newAttempts = new Map(), links = [], blockers = [], currentKeys = new Map();
        for (const result of results) {
            // A non-null link is retained even when a newer attempt exists.
            let destination = result.attemptId;
            if (destination == null) {
                const candidates = itemsByMeasurement.get(JSON.stringify([result.sampleId, result.param])) || [];
                if (candidates.length !== 1) {
                    blockers.push({ code: candidates.length ? 'WORK_ATTEMPT_WORKITEM_AMBIGUOUS' : 'WORK_ATTEMPT_WORKITEM_UNMATCHED',
                        resultId: result.id, workItemIds: candidates.map(row => row.id) });
                    continue;
                }
                const item = candidates[0], existing = attemptsByItem.get(item.id) || [];
                let batchMatched = null;
                if (existing.length > 1) {
                    batchMatched = batchMatches.get(result.id);
                    if (!batchMatched || matchingResultIds.get(batchMatched.id).length !== 1) {
                        blockers.push({ code: 'WORK_ATTEMPT_LINK_AMBIGUOUS', resultId: result.id,
                            workItemId: item.id, attemptIds: existing.map(row => row.id),
                            rule: 'EXISTING_ATTEMPT_ONE_TO_ONE_BATCH_MATCH' });
                        continue;
                    }
                    destination = batchMatched.id;
                }
                else if (existing.length === 1) destination = existing[0].id;
                else {
                    // Match the literal stored status. Do not apply WorkItem
                    // compatibility normalization before the pinned table.
                    if (!Object.hasOwn(HISTORICAL_ATTEMPT_STATUS, item.status)) {
                        blockers.push({ code: 'WORK_ATTEMPT_STATUS_UNMAPPED', resultId: result.id,
                            workItemId: item.id, sourceStatus: item.status });
                        continue;
                    }
                    destination = 'PLANNED_WORKITEM:' + item.id;
                    const plan = newAttempts.get(item.id) || { workItemId: item.id, attemptNo: 1,
                        sourceStatus: item.status, status: HISTORICAL_ATTEMPT_STATUS[item.status], resultIds: [] };
                    plan.resultIds.push(result.id); newAttempts.set(item.id, plan);
                }
                links.push({ resultId: result.id, workItemId: item.id,
                    ...(existing.length ? { attemptId: destination } : { newAttemptForWorkItemId: item.id }),
                    ...(batchMatched && { rule: 'EXISTING_ATTEMPT_ONE_TO_ONE_BATCH_MATCH',
                        attemptNo: batchMatched.attemptNo, attemptStatus: batchMatched.status,
                        attemptQcBatchId: batchMatched.qcBatchId, resultBatchId: result.batchId, isCurrent: result.isCurrent }) });
            }
            if (result.isCurrent) {
                const key = JSON.stringify([result.sampleId, result.param, result.replicateNo, destination]);
                const group = currentKeys.get(key) || [];
                group.push(result.id); currentKeys.set(key, group);
            }
        }
        const currentResultConflicts = [...currentKeys].filter(([, ids]) => ids.length > 1)
            .map(([key, resultIds]) => ({ key: JSON.parse(key), resultIds }));
        for (const conflict of currentResultConflicts) blockers.push({ code: 'WORK_ATTEMPT_CURRENT_RESULT_CONFLICT', ...conflict });
        const duplicateAttemptNumberGroups = [...duplicateNumbers].filter(([, ids]) => ids.length > 1)
            .map(([key, attemptIds]) => { const [workItemId, attemptNo] = JSON.parse(key); return { workItemId, attemptNo, attemptIds }; });
        const resultsById = new Map(results.map(row => [row.id, row]));
        const historicalEquipmentEvidence = [...newAttempts.values()].map(plan => ({ workItemId: plan.workItemId,
            resultIds: plan.resultIds, ...historicalAttemptEvidence(plan.resultIds.map(id => resultsById.get(id))) }));
        // Pin 6054855429: populate only the new additive FK; qcBatchId and
        // every original field remain untouched. Missing/mixed/dangling batch
        // metadata is reported, rather than invented or treated as a blocker.
        const batchEvidence = values => {
            if (values.some(value => value == null) || !values.length) return { outcome: 'NOT_RECORDED', reason: 'BATCH_NOT_RECORDED', batchId: null };
            const distinct = [...new Set(values)];
            if (distinct.length !== 1) return { outcome: 'NOT_RECORDED', reason: 'BATCHES_DIFFER', batchId: null };
            if (!knownBatchIds.has(distinct[0])) return { outcome: 'NOT_RECORDED', reason: 'BATCH_REFERENCE_MISSING', batchId: null };
            return { outcome: 'COPIED', reason: null, batchId: distinct[0] };
        };
        const historicalBatchEvidence = [
            ...attempts.map(row => ({ attemptId: row.id, workItemId: row.workItemId,
                ...(row.batchId != null ? { outcome: 'RETAINED', reason: null, batchId: row.batchId }
                    : batchEvidence([row.qcBatchId])) })),
            ...[...newAttempts.values()].map(plan => ({ newAttemptForWorkItemId: plan.workItemId, resultIds: plan.resultIds,
                ...batchEvidence(plan.resultIds.map(id => resultsById.get(id).batchId)) }))
        ];
        const output = { status: blockers.length ? 'REFUSED' : 'READY',
            existingAttemptCount: attempts.length, resultCount: results.length,
            alreadyLinkedResultCount: results.filter(row => row.attemptId != null).length,
            newAttempts: [...newAttempts.values()], links, blockers, duplicateAttemptNumberGroups, currentResultConflicts,
            historicalEquipmentEvidence, historicalBatchEvidence,
            originalAttemptSha256: fingerprint(attempts), originalResultSha256: fingerprint(results),
            matchedWorkItemSourceSha256: fingerprint(items), batchReferenceSha256: fingerprint(batchIds), totalChanges: 0 };
        return { ...output, planSha256: fingerprint(output) };
    })();
}

module.exports = { planHistoricalAttempts };
