const { loadClosedQcRepeatMigrationSource } = require('./closedQcRepeatMigrationSource');
const MARKER = '412_closed_qc_repeat_membership';
const PREDECESSOR_MARKER = '191_repeat_correction_contract';
const GUARD = 'WorkItem_batch_membership_guard';
const fail = differences => Object.assign(new Error('Closed-run repeat installation differs from the release.'),
    { code: 'CLOSED_QC_REPEAT_SCHEMA_MISMATCH', differences, totalChanges: 0 });

function closedQcRepeatSources(db) {
    const { fingerprint } = require('./workRepeatInstallationEvidence');
    const row = db.prepare('SELECT details FROM "_schema_migrations" WHERE id=?').get(PREDECESSOR_MARKER);
    if (!row) throw fail(['The prior repeat receipt is missing']);
    return { migrationSha256: loadClosedQcRepeatMigrationSource().sha256,
        predecessor: { marker: PREDECESSOR_MARKER, receiptSha256: fingerprint(row.details) } };
}

// Raw receipt reads keep this verifier safe for predecessor classifiers.
function assertClosedQcRepeatInstallationEvidence(db) {
    const { fingerprint, normalize } = require('./workRepeatInstallationEvidence');
    const source = loadClosedQcRepeatMigrationSource();
    const actual = db.prepare('SELECT type,sql FROM sqlite_master WHERE name=?').get(GUARD);
    const row = db.prepare('SELECT details FROM "_schema_migrations" WHERE id=?').get(MARKER);
    let receipt;
    try { receipt = row && JSON.parse(row.details); } catch (_) { /* Refuse below. */ }
    const { receiptSha256, ...content } = receipt || {};
    if (actual?.type !== 'trigger' || normalize(actual.sql) !== normalize(source.guardSql)) {
        if (!require('./batchedAmendmentInstallationEvidence').isVerifiedBatchedAmendmentSuccessor(db, actual)) {
            throw fail(['Membership guard differs']);
        }
    }
    if (!receipt || receiptSha256 !== fingerprint(content) ||
        JSON.stringify(receipt.sources) !== JSON.stringify(closedQcRepeatSources(db))) throw fail(['Installation receipt differs']);
    return receipt;
}

function isVerifiedClosedQcRepeatSuccessor(db, actual) {
    const { normalize } = require('./workRepeatInstallationEvidence');
    const source = loadClosedQcRepeatMigrationSource();
    if (actual?.type !== 'trigger' || normalize(actual.sql) !== normalize(source.guardSql)) {
        if (!require('./batchedAmendmentInstallationEvidence').isVerifiedBatchedAmendmentSuccessor(db, actual)) return false;
    }
    assertClosedQcRepeatInstallationEvidence(db);
    return true;
}
module.exports = { MARKER, GUARD, closedQcRepeatSources, assertClosedQcRepeatInstallationEvidence,
    isVerifiedClosedQcRepeatSuccessor };
