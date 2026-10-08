const { createHash } = require('node:crypto');
const { loadWorkRepeatMigrationSource } = require('./workRepeatMigrationSource');
const { loadWorkAttemptMigrationSource } = require('./workAttemptMigrationSource');
const MARKER = '191_repeat_correction_contract';
const PREDECESSOR_MARKER = '190_work_attempt_contract';
const SUCCESSORS = Object.freeze(['WorkAttempt_evidence_update', 'WorkAttempt_identity_update']);
const MEMBERSHIP_SUCCESSOR = 'WorkItem_batch_membership_guard';
const COLUMN_NAMES = Object.freeze(['id','workItemId','orderLineId','attemptNo','executedMethodRevision','author','authorName',
    'materialAliquot','instrumentId','qcBatchId','batchId','reason','requestedBy','requestedAt','parentAttemptId','note',
    'rawData','calcVersion','dilutionFactor','aliquotId','legacyAttemptNoConflict','version','status','evidenceHash','evidenceData','createdAt','updatedAt']);
const fingerprint = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const normalize = sql => (sql.match(/'(?:''|[^'])*'|"(?:""|[^"])*"|\s+|[^\s'"]+/g) || [])
    .filter(token => !/^\s+$/.test(token)).join('').replace(/;$/, '');
const fail = differences => Object.assign(new Error('Repeat installation evidence differs from the release.'),
    { code: 'WORK_REPEAT_SCHEMA_MISMATCH', differences, totalChanges: 0 });
function repeatReleaseObjects() {
    const source = loadWorkRepeatMigrationSource();
    const objects = [...source.guardsSql.matchAll(/^CREATE TRIGGER "([^"]+)"[\s\S]*?^END;/gm)]
        .map(match => ({ name: match[1], type: 'trigger', sql: match[0] }));
    if (objects.length !== 12) throw Object.assign(new Error('Repeat release requires twelve exact guards.'), { code: 'WORK_REPEAT_SOURCE_MISMATCH' });
    return objects;
}
function predecessorReceipt(db) {
    const source = loadWorkAttemptMigrationSource();
    const row = db.prepare('SELECT details FROM "_schema_migrations" WHERE id=?').get(PREDECESSOR_MARKER);
    let receipt;
    try { receipt = row && JSON.parse(row.details); } catch (_) { /* Fail closed below. */ }
    const { receiptSha256, ...content } = receipt || {};
    if (!receipt || receiptSha256 !== fingerprint(content) ||
        JSON.stringify(receipt.sources) !== JSON.stringify({ migrationSha256: source.sha256, contractVersion: '190-v1' })) {
        throw fail(['The original #190 receipt is absent or altered']);
    }
    return receipt;
}
function repeatSources(db) {
    const source = loadWorkRepeatMigrationSource(), predecessor = predecessorReceipt(db);
    return { migrationSha256: source.sha256, contractVersion: '191-v1', predecessor: {
        marker: PREDECESSOR_MARKER, ...predecessor.sources, receiptSha256: predecessor.receiptSha256
    }, qcPredecessors: qcPredecessorReceipts(db) };
}
function qcPredecessorReceipts(db) {
    const runSource=require('./qcRunMigrationSource').loadQcRunMigrationSource();
    const scopeSource=require('./qcDispositionScopeMigrationSource').loadScopeMigrationSource();
    const membership=require('./qcBracketMembershipMigrationSource').loadBracketMembershipSource();
    const entries=[['186_normalized_qc_runs',receipt=>receipt.migrationSha256===runSource.sha256 && receipt.oracleSha256===runSource.oracleSha256],
        ['187_qc_gate_scope',receipt=>receipt.migrationSha256===scopeSource.sha256 && receipt.membershipMigrationSha256===membership.sha256 &&
            receipt.membershipGuardSha256===membership.guardSha256 && receipt.supersededMembershipGuardSha256===membership.supersededGuardSha256]];
    return Object.fromEntries(entries.map(([marker,valid])=>{
        const row=db.prepare('SELECT details FROM "_schema_migrations" WHERE id=?').get(marker);
        let receipt;try{receipt=row && JSON.parse(row.details);}catch(_){/* Refuse below. */}
        if(!receipt || !valid(receipt))throw fail([`QC predecessor receipt ${marker} is absent or altered`]);
        // Bind the entire original receipt, including its backfill proof.
        return [marker,{receiptSha256:fingerprint(row.details)}];
    }));
}
function inspectRepeatColumns(db) {
    const columns = db.prepare('PRAGMA table_xinfo("WorkAttempt")').all(), differences = [];
    const added = ['parentAttemptId', 'note'].map(name => {
        const row = columns.find(column => column.name === name);
        if (row && (row.type !== 'TEXT' || row.notnull || row.dflt_value !== null || row.pk || row.hidden)) differences.push(`WorkAttempt.${name} differs`);
        return Boolean(row);
    });
    if (columns.some(row => !COLUMN_NAMES.includes(row.name)) || COLUMN_NAMES.filter(name => !['parentAttemptId', 'note'].includes(name))
        .some(name => !columns.some(row => row.name === name))) differences.push('WorkAttempt closed column contract differs');
    const version = columns.find(row => row.name === 'version');
    if (!version || version.type !== 'INTEGER' || version.notnull !== 1 || version.dflt_value !== '1') differences.push('WorkAttempt.version must retain NOT NULL DEFAULT 1');
    return { added, differences };
}
// This verifier deliberately does not call the #190 classifier. It is safe
// for that classifier to use when checking its two authorized successors.
function assertRepeatInstallationEvidence(db) {
    const { added, differences } = inspectRepeatColumns(db);
    if (!added.every(Boolean)) differences.push('Repeat columns are incomplete');
    for (const expected of repeatReleaseObjects()) {
        const actual = db.prepare('SELECT type,sql FROM sqlite_master WHERE name=?').get(expected.name);
        if (!actual || actual.type !== expected.type || normalize(actual.sql) !== normalize(expected.sql)) differences.push(`${expected.name} differs`);
    }
    const sources = repeatSources(db);
    const row = db.prepare('SELECT details FROM "_schema_migrations" WHERE id=?').get(MARKER);
    let receipt;
    try { receipt = row && JSON.parse(row.details); } catch (_) { /* Fail closed below. */ }
    const { receiptSha256, ...content } = receipt || {};
    if (!receipt || JSON.stringify(receipt.sources) !== JSON.stringify(sources) || receiptSha256 !== fingerprint(content)) differences.push('Repeat receipt is absent or altered');
    if (differences.length) throw fail(differences);
    return { sources, receipt };
}
function isVerifiedRepeatSuccessor(db, expectedName, actual) {
    if (!SUCCESSORS.includes(expectedName)) return false;
    const successor = repeatReleaseObjects().find(row => row.name === expectedName);
    if (actual.type !== successor.type || normalize(actual.sql) !== normalize(successor.sql)) return false;
    assertRepeatInstallationEvidence(db);
    return true;
}
function isVerifiedRepeatMembershipSuccessor(db,actual) {
    const successor=repeatReleaseObjects().find(row=>row.name===MEMBERSHIP_SUCCESSOR);
    if(!actual || actual.type!==successor.type || normalize(actual.sql)!==normalize(successor.sql))return false;
    assertRepeatInstallationEvidence(db);
    return true;
}
module.exports = { MARKER, PREDECESSOR_MARKER, SUCCESSORS, MEMBERSHIP_SUCCESSOR, COLUMN_NAMES, fingerprint, normalize,
    repeatReleaseObjects, repeatSources, inspectRepeatColumns, assertRepeatInstallationEvidence, isVerifiedRepeatSuccessor,
    isVerifiedRepeatMembershipSuccessor };
