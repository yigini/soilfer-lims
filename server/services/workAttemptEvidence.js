// Historical evidence comes only from the retained Result snapshot (#190 pin
// 6053016928). This helper has no database, policy or equipment read path.
function historicalAttemptEvidence(results) {
    const absent = reason => ({ outcome: 'NOT_RECORDED', reason, evidenceData: null, instrumentId: null });
    if (!results.length || results.some(row => row.equipmentReadiness == null)) return absent('SNAPSHOT_NOT_RECORDED');
    const first = results[0].equipmentReadiness;
    if (results.some(row => row.equipmentReadiness !== first)) return absent('SNAPSHOTS_DIFFER');
    let snapshot;
    try { snapshot = JSON.parse(first); } catch (_) { return absent('SNAPSHOT_INVALID'); }
    if (!snapshot || Array.isArray(snapshot) || typeof snapshot !== 'object' ||
        typeof snapshot.equipmentId !== 'string' || !snapshot.equipmentId) return absent('SNAPSHOT_INVALID');
    return { outcome: 'COPIED', reason: null, evidenceData: JSON.stringify({ equipmentReadiness: snapshot }),
        instrumentId: snapshot.equipmentId };
}

module.exports = { historicalAttemptEvidence };
