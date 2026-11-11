const { loadBatchedAmendmentMigrationSource } = require('./batchedAmendmentMigrationSource');
const MARKER = '413_batched_amendment_membership';
const PREDECESSOR_MARKER = '412_closed_qc_repeat_membership';
const AUTHORIZATION_MARKER = '210_sample_amendment_authorisation';
const GUARD = 'WorkItem_batch_membership_guard';
const fail = differences => Object.assign(new Error('Batched amendment installation differs from the release.'),
    { code: 'BATCHED_AMENDMENT_SCHEMA_MISMATCH', differences, totalChanges: 0 });

function batchedAmendmentSources(db) {
    const { fingerprint, normalize } = require('./workRepeatInstallationEvidence');
    const prior = db.prepare('SELECT details FROM "_schema_migrations" WHERE id=?').get(PREDECESSOR_MARKER);
    const authorization = db.prepare('SELECT details FROM "_schema_migrations" WHERE id=?').get(AUTHORIZATION_MARKER);
    const source = require('./sampleAmendmentMigrationSource').loadSampleAmendmentMigrationSource();
    let receipt;
    try { receipt = authorization && JSON.parse(authorization.details); } catch (_) { /* Refuse below. */ }
    const { receiptSha256, ...content } = receipt || {};
    const expected = { migrationSha256: source.sha256, oracleSha256: source.oracleSha256, contractVersion: '210-v1' };
    if (!prior || !receipt || receiptSha256 !== fingerprint(content) ||
        JSON.stringify(receipt.sources) !== JSON.stringify(expected)) throw fail(['Prior installation receipts differ']);
    const guards = [...source.guardsSql.matchAll(/^CREATE TRIGGER "([^"]+)"[\s\S]*?^END;/gm)];
    if (guards.length !== 14 || guards.some(([, name], index) => {
        const actual = db.prepare('SELECT type,sql FROM sqlite_master WHERE name=?').get(name);
        return actual?.type !== 'trigger' || normalize(actual.sql) !== normalize(guards[index][0]);
    })) throw fail(['Amendment authorization guards differ']);
    return { migrationSha256: loadBatchedAmendmentMigrationSource().sha256,
        predecessor: { marker: PREDECESSOR_MARKER, receiptSha256: fingerprint(prior.details) },
        authorization: { marker: AUTHORIZATION_MARKER, ...expected, receiptSha256: fingerprint(authorization.details) } };
}

// Raw receipt reads avoid recursion through the predecessor guard verifier.
function assertBatchedAmendmentInstallationEvidence(db) {
    const { fingerprint, normalize } = require('./workRepeatInstallationEvidence');
    const source = loadBatchedAmendmentMigrationSource();
    const actual = db.prepare('SELECT type,sql FROM sqlite_master WHERE name=?').get(GUARD);
    const row = db.prepare('SELECT details FROM "_schema_migrations" WHERE id=?').get(MARKER);
    let receipt;
    try { receipt = row && JSON.parse(row.details); } catch (_) { /* Refuse below. */ }
    const { receiptSha256, ...content } = receipt || {};
    if (actual?.type !== 'trigger' || normalize(actual.sql) !== normalize(source.guardSql)) throw fail(['Membership guard differs']);
    if (!receipt || receiptSha256 !== fingerprint(content) ||
        JSON.stringify(receipt.sources) !== JSON.stringify(batchedAmendmentSources(db))) throw fail(['Installation receipt differs']);
    return receipt;
}
function isVerifiedBatchedAmendmentSuccessor(db, actual) {
    const { normalize } = require('./workRepeatInstallationEvidence');
    const source = loadBatchedAmendmentMigrationSource();
    if (actual?.type !== 'trigger' || normalize(actual.sql) !== normalize(source.guardSql)) return false;
    assertBatchedAmendmentInstallationEvidence(db);
    return true;
}
module.exports = { MARKER, GUARD, batchedAmendmentSources, assertBatchedAmendmentInstallationEvidence,
    isVerifiedBatchedAmendmentSuccessor };
