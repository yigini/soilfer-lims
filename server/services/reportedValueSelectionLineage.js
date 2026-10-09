const { TransitionError } = require('./workflowStateRules');
const ELIGIBLE = new Set(['ACCEPTED', 'SUBMITTED', 'QUESTIONED']);
const invalid = () => new TransitionError('The retained attempt lineage is incomplete.', 409, 'REPORTED_VALUE_LINEAGE_INVALID');
const compareId = (a, b) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0;

// #192 pin6072757161: currentness is global; a retained parent keeps its own
// final execution even after a repeat replaces it. Only same-attempt
// corrections remove a Result from that attempt's final set.
function buildSelectionLineage(attempts, results) {
    const owners = new Map(attempts.map(row => [row.id, row]));
    const rows = new Map(results.map(row => [row.id, row]));
    if (owners.size !== attempts.length || rows.size !== results.length ||
        attempts.some(row => !row.id || !row.status) || results.some(row => !row.id || !owners.has(row.attemptId))) throw invalid();
    for (const row of results) {
        const visited = new Set(); let current = row;
        while (current.supersededBy) {
            if (visited.has(current.id) || !rows.has(current.supersededBy)) throw invalid();
            visited.add(current.id); current = rows.get(current.supersededBy);
        }
    }
    const ordered = [...attempts].sort(compareId);
    const eligible = ordered.filter(row => ELIGIBLE.has(row.status) &&
        (row.status !== 'QUESTIONED' || row.evidenceHash != null)).map(attempt => ({
        attempt,
        results: results.filter(row => row.attemptId === attempt.id &&
            (!row.supersededBy || rows.get(row.supersededBy).attemptId !== attempt.id))
            .sort(compareId)
    }));
    const snapshot = { version: 1, attempts: ordered.map(row => ({ id: row.id, status: row.status })),
        eligible: eligible.map(({ attempt, results: final }) => ({ id: attempt.id,
            evidenceHash: attempt.evidenceHash ?? null, resultIds: final.map(row => row.id) })) };
    return { snapshot, eligible };
}

function assertSelectionFresh(snapshot, attempts, results) {
    let stored;
    try { stored = typeof snapshot === 'string' ? JSON.parse(snapshot) : snapshot; }
    catch { throw new TransitionError('The reported-value selection is stale.', 409, 'REPORTED_VALUE_STALE'); }
    const current = buildSelectionLineage(attempts, results);
    if (JSON.stringify(stored) !== JSON.stringify(current.snapshot)) {
        throw new TransitionError('The reported-value selection is stale.', 409, 'REPORTED_VALUE_STALE');
    }
    return current;
}

module.exports = { buildSelectionLineage, assertSelectionFresh };
