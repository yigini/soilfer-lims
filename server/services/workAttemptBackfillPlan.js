const { createHash } = require('node:crypto');
const { HISTORICAL_ATTEMPT_STATUS } = require('./workAttemptContract');

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
                if (existing.length > 1) {
                    blockers.push({ code: 'WORK_ATTEMPT_LINK_AMBIGUOUS', resultId: result.id,
                        workItemId: item.id, attemptIds: existing.map(row => row.id) });
                    continue;
                }
                if (existing.length === 1) destination = existing[0].id;
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
                    ...(existing.length ? { attemptId: destination } : { newAttemptForWorkItemId: item.id }) });
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
        const output = { status: blockers.length ? 'REFUSED' : 'READY',
            existingAttemptCount: attempts.length, resultCount: results.length,
            alreadyLinkedResultCount: results.filter(row => row.attemptId != null).length,
            newAttempts: [...newAttempts.values()], links, blockers, duplicateAttemptNumberGroups, currentResultConflicts,
            originalAttemptSha256: fingerprint(attempts), originalResultSha256: fingerprint(results),
            matchedWorkItemSourceSha256: fingerprint(items), totalChanges: 0 };
        return { ...output, planSha256: fingerprint(output) };
    })();
}

module.exports = { planHistoricalAttempts };
