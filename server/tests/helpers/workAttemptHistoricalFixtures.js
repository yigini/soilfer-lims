const fs = require('node:fs');
const path = require('node:path');
const { createHash } = require('node:crypto');
const Database = require('better-sqlite3');
const { assertOwnedTestDatabase } = require('./testOwnedDatabase');

// #190 pin6057064901. Prisma emitted this literal SQLite DDL from the schema
// at merged pre-190 main283a8bb54b66a2167d34d80ad724bdd6460850b1 (Prisma7.10).
const DDL_SHA256 = 'e2496a65a9c607e80a82924ff7ed6a4033d1da05fedb907c83dd0918f022923b';
const CALLERS = Object.freeze({
    'tests/contracts/audit_3_1_attempt_backfill_plan.test.js': 'Literal historical matching and refusal.',
    'tests/contracts/audit_3_1_attempt_install.test.js': 'Atomic migration and original-row preservation.',
    'tests/contracts/audit_3_1_attempt_sql_guards.test.js': 'Legacy seeding before actual guarded probes.',
    'tests/contracts/audit_1_2_spectral_state.test.js': 'Only the named measured-orphan installer-refusal rehearsal.'
});
const ORPHAN_TEST = 'a literal pre-190 measured orphan refuses the installer and COMPLETE startup without writes';
const COLUMNS = Object.freeze({
    Sample: ['id','originalId','status','assignedLab','requiredAnalyses','createdAt','updatedAt'],
    Batch: ['id','analysis','status','createdBy','labId','createdAt'],
    WorkItem: ['id','sampleId','analysis','status','result','duplicateOf','createdAt','updatedAt'],
    WorkAttempt: ['id','workItemId','orderLineId','attemptNo','executedMethodRevision','author','authorName',
        'materialAliquot','instrumentId','qcBatchId','version','status','evidenceHash','evidenceData','createdAt','updatedAt'],
    Result: ['id','sampleId','param','value','numericValue','rawInput','unit','flags','isValid','censoring','basis',
        'provenance','methodologyId','replicateNo','isCurrent','supersededBy','enteredBy','analysedAt',
        'equipmentId','equipmentReadiness','batchId','attemptId','createdAt','updatedAt'],
    ReviewDecision: ['id','sampleId','workItemId','submissionItemId','attemptId','decision','reason','evidenceVersion',
        'evidenceHash','reviewerId','reviewerName','authorization','policyVersion','createdAt'],
    AuditLog: ['id','entity','entityId','action','details','performedBy','timestamp']
});

function createPre190AttemptFixture(options = {}) {
    if (Object.keys(options).some(key => !['actor','file','rows'].includes(key))) throw Error('Unknown historical fixture option.');
    let { actor, file, rows } = options;
    file = assertOwnedTestDatabase(file, actor);
    const testState = globalThis.expect?.getState?.();
    const caller = path.relative(path.resolve(__dirname, '../..'), testState?.testPath || '').replace(/\\/g,'/');
    if (!Object.hasOwn(CALLERS, caller) ||
        caller === 'tests/contracts/audit_1_2_spectral_state.test.js' && testState.currentTestName !== ORPHAN_TEST) {
        throw Error('Pre-190 attempt fixture refuses a caller outside its closed test allowlist.');
    }
    if (fs.existsSync(file)) throw Error('Pre-190 attempt fixture refuses an existing target.');
    if (!rows || Object.getPrototypeOf(rows) !== Object.prototype ||
        Object.keys(rows).some(table => !Object.hasOwn(COLUMNS, table)) ||
        Object.values(Object.getOwnPropertyDescriptors(rows)).some(descriptor => !Object.hasOwn(descriptor,'value'))) throw Error('Unknown historical fixture table.');
    for (const [table, entries] of Object.entries(rows)) {
        if (!Array.isArray(entries)) throw Error('Historical fixture input requires row arrays.');
        for (const row of entries) {
            if (!row || Object.getPrototypeOf(row) !== Object.prototype || !Object.hasOwn(row, 'id') ||
                Object.keys(row).some(column => !COLUMNS[table].includes(column)) ||
                Object.values(Object.getOwnPropertyDescriptors(row)).some(descriptor => !Object.hasOwn(descriptor,'value')) ||
                Object.values(row).some(value => value !== null && !(value instanceof Date) &&
                    !['string','number','bigint'].includes(typeof value))) throw Error('Unknown historical fixture column or value.');
            if (table === 'Result' && !Object.hasOwn(row,'provenance')) {
                throw Error('Historical Result provenance must be explicitly supplied.');
            }
        }
    }
    const bytes = fs.readFileSync(path.join(__dirname, 'fixtures/pre190_full_application_schema.sql'));
    if (createHash('sha256').update(bytes).digest('hex') !== DDL_SHA256) throw Error('Pinned pre-190 DDL digest differs.');
    // Inspect the pinned DDL before creating the owned file, then check the
    // actual file again before any caller row is written. No guard is removed.
    const oracle = new Database(':memory:');
    try {
        oracle.pragma('foreign_keys=ON'); oracle.exec(bytes.toString('utf8'));
        if (oracle.prepare('PRAGMA table_info("WorkAttempt")').all().some(column =>
            ['batchId','reason','requestedBy','requestedAt','rawData','calcVersion','dilutionFactor','aliquotId','legacyAttemptNoConflict'].includes(column.name)) ||
            oracle.prepare('PRAGMA table_info("ReviewDecision")').all().some(column => column.name === 'reasonCode') ||
            oracle.prepare(`SELECT name FROM sqlite_master WHERE name IN ('WorkAttempt_workItemId_attemptNo_idx',
                'WorkAttempt_batchId_idx','WorkAttempt_workItemId_attemptNo_unique','result_one_current',
                'ReviewDecision_attempt_insert_guard','ReviewDecision_attempt_immutable','Result_attempt_required_insert',
                'Result_attempt_link_immutable','WorkAttempt_reason_insert','WorkAttempt_reason_update',
                'WorkAttempt_status_insert','WorkAttempt_status_update','WorkAttempt_conflict_flag_insert',
                'WorkAttempt_conflict_flag_update','WorkAttempt_evidence_update','WorkAttempt_identity_update',
                'WorkAttempt_batchId_update','WorkAttempt_number_insert','WorkAttempt_delete')`).get()) {
            throw Error('Historical DDL already contains a #190 schema object.');
        }
    } finally { oracle.close(); }
    fs.closeSync(fs.openSync(file, 'wx'));
    const db = new Database(file, { fileMustExist: true });
    try {
        db.pragma('foreign_keys=ON'); db.exec(bytes.toString('utf8'));
        // The literal receipt table is the additive #179 installer definition.
        db.exec('CREATE TABLE "_schema_migrations" ("id" TEXT PRIMARY KEY NOT NULL, "appliedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, "details" TEXT)');
        if (db.prepare("SELECT id FROM _schema_migrations WHERE id='190_work_attempt_contract'").get()) {
            throw Error('Historical fixture already has the #190 receipt.');
        }
        if (db.pragma('foreign_keys', { simple: true }) !== 1) throw Error('Historical fixtures require foreign keys ON.');
        db.exec('BEGIN IMMEDIATE');
        for (const table of Object.keys(COLUMNS)) for (const row of rows[table] || []) {
            const fields = Object.keys(row), values = fields.map(column => row[column] instanceof Date ? row[column].getTime() : row[column]);
            db.prepare(`INSERT INTO "${table}" (${fields.map(column => `"${column}"`).join(',')}) VALUES (${fields.map(() => '?').join(',')})`).run(...values);
        }
        if (db.pragma('foreign_key_check').length) throw Error('Historical fixture contains broken foreign keys.');
        db.exec('COMMIT');
        return { file, ddlSha256: DDL_SHA256 };
    } finally {
        if (db.inTransaction) db.exec('ROLLBACK');
        db.close();
    }
}

module.exports = { createPre190AttemptFixture };
