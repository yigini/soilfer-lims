const { displayResult } = require('./reportContentDisplay');
const fail = (code, details) => Object.assign(new Error('Retained report comparison evidence is unavailable.'),
    { statusCode: 409, code, details });
const order = (a, b) => a < b ? -1 : a > b ? 1 : 0;
const usableIdentity = value => typeof value === 'string' && value.length > 0;
const sortedIdentities = value => Array.isArray(value) ? [...new Set(value)].sort(order) : [];

// Pins6097307274/6097341122: compare only frozen identities, displayed values
// and bases. No catalogue, live Result, current policy or database is resolved.
function frozenItems(content, reportId) {
    if (!content || typeof content !== 'object' || !Array.isArray(content.resultGroups))
        throw fail('REPORT_AMENDMENT_EVIDENCE_INVALID', { reportId, itemPosition: null });
    const locale = ['en', 'es', 'es-419', 'fr', 'pt'].includes(content.meta?.locale) ? content.meta.locale : 'en';
    const labels = require('../locales/' + locale + '.json').resultReports;
    return content.resultGroups.flatMap((group, groupIndex) => {
        if (!Array.isArray(group?.items)) throw fail('REPORT_AMENDMENT_EVIDENCE_INVALID', { reportId, itemPosition: { groupIndex } });
        return group.items.map((item, itemIndex) => {
            const analysisId = usableIdentity(item?.analysisId) ? item.analysisId : item?.param;
            if (!usableIdentity(analysisId) || item.basis != null && typeof item.basis !== 'string' ||
                item.unit != null && typeof item.unit !== 'string')
                throw fail('REPORT_AMENDMENT_EVIDENCE_INVALID', { reportId, itemPosition: { groupIndex, itemIndex } });
            return { analysisId, basis: item.basis ?? null, displayText: displayResult(item, labels), unit: item.unit ?? null,
                qualifier: item.qualifier ?? null, censoring: item.censoring ?? null,
                sourceResultIds: sortedIdentities(item.sourceResultIds), attemptIds: sortedIdentities(item.attemptIds) };
        });
    });
}

function compareReportAmendment(predecessorContent, newContent, { predecessorReportId = 'predecessor', newReportId = 'proposed' } = {}) {
    const oldItems = frozenItems(predecessorContent, predecessorReportId), newItems = frozenItems(newContent, newReportId);
    const analysisIds = [...new Set([...oldItems, ...newItems].map(item => item.analysisId))].sort(order), changes = [];
    for (const analysisId of analysisIds) {
        const old = oldItems.filter(item => item.analysisId === analysisId), current = newItems.filter(item => item.analysisId === analysisId);
        const ambiguous = () => fail('REPORT_AMENDMENT_EVIDENCE_AMBIGUOUS', { analysisId,
            oldBases: old.map(item => item.basis).sort((a, b) => order(JSON.stringify(a), JSON.stringify(b))),
            newBases: current.map(item => item.basis).sort((a, b) => order(JSON.stringify(a), JSON.stringify(b))) });
        for (const rows of [old, current]) if (new Set(rows.map(item => JSON.stringify(item.basis))).size !== rows.length) throw ambiguous();
        const oldRemaining = [], newRemaining = new Set(current);
        for (const before of old) {
            const after = current.find(item => item.basis === before.basis);
            if (!after) { oldRemaining.push(before); continue; }
            newRemaining.delete(after);
            const kind = before.displayText === after.displayText && before.unit === after.unit && before.basis === after.basis ? 'UNCHANGED' : 'CHANGED';
            changes.push({ analysisId, kind, old: before, new: after });
        }
        const remaining = [...newRemaining];
        if (oldRemaining.length && remaining.length) {
            if (oldRemaining.length !== 1 || remaining.length !== 1) throw ambiguous();
            changes.push({ analysisId, kind: 'CHANGED', old: oldRemaining[0], new: remaining[0] });
        } else {
            changes.push(...oldRemaining.map(before => ({ analysisId, kind: 'REMOVED', old: before, new: null })),
                ...remaining.map(after => ({ analysisId, kind: 'ADDED', old: null, new: after })));
        }
    }
    changes.sort((a, b) => order(JSON.stringify([a.analysisId, a.old?.basis ?? null, a.new?.basis ?? null, a.kind]),
        JSON.stringify([b.analysisId, b.old?.basis ?? null, b.new?.basis ?? null, b.kind])));
    return { contract: '211-v1', changes };
}

module.exports = { compareReportAmendment };
