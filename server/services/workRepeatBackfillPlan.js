// Pin6055538092: interim attempt 2+ rows are reported, never repaired or
// assigned a reason inferred from a work item's free-text history.
function planInterimRepeatReasons(db) {
    const columns = new Set(db.prepare('PRAGMA table_xinfo("WorkAttempt")').all().map(row => row.name));
    if (!['id', 'workItemId', 'attemptNo', 'reason', 'status'].every(name => columns.has(name))) {
        throw Object.assign(new Error('Install the reviewed #190 attempt contract before planning #191.'),
            { code: 'WORK_REPEAT_PREREQUISITE_NOT_INSTALLED', statusCode: 409 });
    }
    const rows = db.prepare('SELECT id, workItemId, attemptNo, status FROM "WorkAttempt" WHERE attemptNo > 1 AND reason IS NULL ORDER BY workItemId, attemptNo, id')
        .all().map(row => ({ ...row, reason: null, description: 'reason not recorded' }));
    return { reasonNotRecordedCount: rows.length, reasonNotRecorded: rows,
        backfilledCount: 0, originalReasonFieldsPreserved: true };
}

// Read-only release inventory. Historical review state is never inferred or
// repaired: an operator must resolve these owners before releasing #191.
function inventorySubmittedRecordedOwners(db) {
    const rows = db.prepare(`SELECT item.id workItemId, item.status workItemStatus,
        attempt.id attemptId, result.id resultId
        FROM WorkItem item JOIN WorkAttempt attempt ON attempt.workItemId=item.id
        JOIN Result result ON result.attemptId=attempt.id AND result.isCurrent=1
        WHERE item.status IN ('SUBMITTED','ACCEPTED') AND attempt.status='RECORDED'
        ORDER BY item.id,attempt.id,result.id`).all();
    const items = new Map();
    for (const row of rows) {
        if (!items.has(row.workItemId)) items.set(row.workItemId,
            { workItemId: row.workItemId, status: row.workItemStatus, owners: [] });
        const owners = items.get(row.workItemId).owners;
        let owner = owners.find(entry => entry.attemptId === row.attemptId);
        if (!owner) { owner = { attemptId: row.attemptId, resultIds: [] }; owners.push(owner); }
        owner.resultIds.push(row.resultId);
    }
    return { blockedWorkItemCount: items.size, blockedWorkItems: [...items.values()], totalChanges: 0 };
}
module.exports = { planInterimRepeatReasons, inventorySubmittedRecordedOwners };
