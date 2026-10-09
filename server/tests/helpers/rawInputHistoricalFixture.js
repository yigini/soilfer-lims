const fs = require('node:fs');
const path = require('node:path');
const { randomUUID, createHash } = require('node:crypto');
const Database = require('better-sqlite3');
const { assertOwnedTestDatabase } = require('./testOwnedDatabase');

// #272 pin6087435363. Full unmodified Prisma7.10 fresh DDL from schema at
// 48d0e526ded03232ac8516dd867f4b14923bdb58; generation command:
// prisma migrate diff --from-empty --to-schema <unchanged baseline schema> --script
// Keep all45026 SQL bytes identical to the generated output; no added header.
const DDL_SHA256 = '6fce034bc43633d55431423ccad8a0e1e81dcdc98ba9b4174c112bef3e672983';
const CALLER = 'tests/contracts/audit_1_5_raw_input_install.test.js';

function createRawInputSupportedBaselineFixture() {
    if (arguments.length) throw Error('The raw input historical fixture accepts no arguments.');
    const testPath = globalThis.expect?.getState?.().testPath;
    if (path.relative(path.resolve(__dirname, '../..'), testPath || '').replace(/\\/g, '/') !== CALLER) {
        throw Error('The raw input historical fixture refuses an unlisted caller.');
    }
    const directory = path.resolve(__dirname, '../.tmp');
    fs.mkdirSync(directory, { recursive: true });
    const file = assertOwnedTestDatabase(path.join(directory, `audit_legacy_raw_input_${randomUUID()}.db`), 'system:fixture');
    const bytes = fs.readFileSync(path.join(__dirname, 'fixtures/raw_input_supported_baseline.sql'));
    if (bytes.length !== 45026 || createHash('sha256').update(bytes).digest('hex') !== DDL_SHA256) throw Error('The supported raw input baseline DDL differs.');
    fs.closeSync(fs.openSync(file, 'wx'));
    const db = new Database(file, { fileMustExist: true });
    try {
        db.pragma('foreign_keys = ON');
        db.transaction(() => {
            db.exec(bytes.toString('utf8'));
            db.prepare('INSERT INTO "Sample" (id,originalId,status,assignedLab,metadata,history,createdAt,updatedAt) VALUES (?,?,?,?,?,?,?,?)')
                .run('raw-input-sample', 'RAW-INPUT-ORIGINAL', 'PROCESSING', 'Historical Lab', '{"preserve":"é精确"}', '[{"prior":"retained"}]', '2026-09-01T10:00:00.123Z', '2026-09-02T11:00:00.456Z');
            const result = db.prepare(`INSERT INTO "Result" (id,sampleId,param,value,numericValue,unit,flags,isValid,censoring,basis,provenance,
                methodologyId,replicateNo,isCurrent,supersededBy,enteredBy,analysedAt,equipmentId,batchId,createdAt,updatedAt)
                VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`);
            result.run('retained-result', 'raw-input-sample', 'SOC', ' 6,7500 ', 6.75, 'g/kg', '["HISTORICAL_QC_FLAG"]', 0,
                'BELOW_LOQ', 'OVEN_DRY', 'IMPORTED', 'historical-method', 2, 0, 'current-result', 'old-analyst', '2026-09-01T09:00:00.111Z',
                'old-equipment', 'old-batch', '2026-09-01T10:00:00.123Z', '2026-09-02T11:00:00.456Z');
            result.run('current-result', 'raw-input-sample', 'SOC', '7.125', 7.125, 'g/kg', '["RETAINED_FLAG"]', 1,
                'NONE', 'AIR_DRY', 'MEASURED', null, 1, 1, null, 'second-analyst', '2026-09-02T09:00:00.789Z',
                null, null, '2026-09-02T10:00:00.123Z', '2026-09-02T11:00:00.456Z');
            result.run('censored-result', 'raw-input-sample', 'P', '< 0.10', null, 'mg/kg', '["QUALIFIED_HISTORY"]', null,
                'BELOW_LOQ', 'OVEN_DRY', 'IMPORTED', 'old-phosphorus-method', 3, 1, null, 'historic-import', null,
                null, null, '2026-09-03T10:00:00.123Z', '2026-09-03T11:00:00.456Z');
            db.exec('CREATE TABLE "_schema_migrations" ("id" TEXT PRIMARY KEY NOT NULL, "appliedAt" DATETIME NOT NULL, "details" TEXT)');
            db.prepare('INSERT INTO "_schema_migrations" (id,appliedAt,details) VALUES (?,?,?)')
                .run('synthetic_prior_receipt', '2026-09-01T00:00:00.000Z', '{"preserve":"exact"}');
            db.prepare('INSERT INTO "AuditLog" (id,entity,entityId,action,details,performedBy,timestamp) VALUES (?,?,?,?,?,?,?)')
                .run('retained-audit', 'Result', 'retained-result', 'IMPORTED', '{"legacy":"unaltered"}', 'historic-import', '2026-09-01T10:00:00.123Z');
        })();
        if (db.pragma('integrity_check', { simple: true }) !== 'ok' || db.pragma('foreign_key_check').length) throw Error('Raw input baseline fixture integrity failed.');
        return { file };
    } catch (error) {
        db.close(); fs.rmSync(file, { force: true }); throw error;
    } finally { if (db.open) db.close(); }
}

module.exports = { createRawInputSupportedBaselineFixture };
