const fs = require('node:fs'), path = require('node:path');
const { randomUUID, createHash } = require('node:crypto');
const Database = require('better-sqlite3');
const { assertOwnedTestDatabase } = require('./testOwnedDatabase');
const { UNITS } = require('../../seeds/units');
const catalogue = require('../../seeds/data/catalogue.json');

// #199 pin6088661994. Unmodified fresh Prisma7.10 DDL from schema at
// 200ca0bdaf6a4cf6c445fa39f58c96a80bb7714f; cwd server; exact command:
// prisma migrate diff --from-empty --to-schema <exact schema blob> --script
// 65670 bytes, SHA25633f558c18a0b47c806989e6b83eca2ce15923df9c27caf5036cbe11c4420b114.
// The SQL has no added header. Provenance belongs here, outside its exact bytes.
const DDL_SHA256 = '33f558c18a0b47c806989e6b83eca2ce15923df9c27caf5036cbe11c4420b114';
const CALLER = 'tests/contracts/audit_4_6_calculation_install.test.js';

function createPre199CalculationFixture() {
    if (arguments.length) throw Error('The calculation baseline factory accepts no arguments.');
    const testPath = globalThis.expect?.getState?.().testPath;
    if (path.relative(path.resolve(__dirname, '../..'), testPath || '').replace(/\\/g, '/') !== CALLER)
        throw Error('The calculation baseline factory refuses an unlisted caller.');
    const bytes = fs.readFileSync(path.join(__dirname, 'fixtures/pre199_full_application_schema.sql'));
    if (bytes.length !== 65670 || createHash('sha256').update(bytes).digest('hex') !== DDL_SHA256)
        throw Error('The pre-199 baseline DDL differs.');
    const directory = path.resolve(__dirname, '../.tmp'); fs.mkdirSync(directory, { recursive: true });
    const file = assertOwnedTestDatabase(path.join(directory, `audit_legacy_calc_baseline_${randomUUID()}.db`), 'system:fixture');
    fs.closeSync(fs.openSync(file, 'wx'));
    const db = new Database(file, { fileMustExist: true });
    try {
        db.pragma('foreign_keys=ON');
        db.transaction(() => {
            db.exec(bytes.toString('utf8'));
            for (const unit of UNITS.filter(row => row.code !== 'pct_mass')) db.prepare('INSERT INTO Unit(code,display,quantityKind,factorToBase,synonyms,createdAt,updatedAt) VALUES(?,?,?,?,?,?,?)')
                .run(unit.code, unit.display, unit.quantityKind, unit.factorToBase, unit.synonyms, '2026-09-01T00:00:00.123Z', '2026-09-02T00:00:00.456Z');
            const codes = ['MOISTURE', 'SOC', 'P_OLSEN', 'P_BRAY1', 'EXCH_CA', 'EXCH_MG', 'EXCH_K', 'EXCH_NA', 'CEC', 'TN'];
            for (const row of catalogue.analyses.filter(value => codes.includes(value.code))) db.prepare('INSERT INTO Analysis(code,name,unitCode,units,description,version,decimalPlaces,validation,createdAt,updatedAt) VALUES(?,?,?,?,?,?,?,?,?,?)')
                .run(row.code, `Retained local ${row.name}`, row.unitCode, row.units, 'Historical catalogue metadata', 17, 5,
                    '{"local":"unchanged"}', '2026-09-01T00:00:00.123Z', '2026-09-02T00:00:00.456Z');
            db.prepare('INSERT INTO Lab(id,code,name,country,settings,updatedAt) VALUES(?,?,?,?,?,?)')
                .run('calc-history-lab', 'CALC_HISTORY', 'Owned historical calculation lab', 'ZZ', '{"retained":true}', '2026-09-01T00:00:00.123Z');
            db.prepare('INSERT INTO User(id,username,email,password,role,labId,updatedAt) VALUES(?,?,?,?,?,?,?)')
                .run('calc-history-user', 'calc-history-analyst', 'calc-history@example.invalid', 'synthetic-unusable', 'LAB_MANAGER', 'calc-history-lab', '2026-09-01T00:00:00.123Z');
            db.prepare('INSERT INTO Methodology(id,analysisCode,name,version,updatedAt) VALUES(?,?,?,?,?)')
                .run('calc-history-method', 'SOC', 'Historical local WB', 3, '2026-09-01T00:00:00.123Z');
            db.prepare('INSERT INTO Sample(id,originalId,status,assignedLab,metadata,history,createdAt,updatedAt) VALUES(?,?,?,?,?,?,?,?)')
                .run('calc-history-sample', 'CALC-HISTORICAL-ORIGINAL', 'PROCESSING', 'CALC_HISTORY', '{"retained":"é精确"}', '[{"old":"unchanged"}]',
                    '2026-09-01T10:00:00.123Z', '2026-09-02T11:00:00.456Z');
            db.prepare('INSERT INTO Batch(id,labId,analysis,status,createdBy,notes,createdAt) VALUES(?,?,?,?,?,?,?)')
                .run('calc-history-batch', 'calc-history-lab', 'SOC', 'CLOSED', 'calc-history-analyst', 'Retain legacy run metadata', '2026-09-01T10:00:00.123Z');
            db.prepare('INSERT INTO WorkItem(id,sampleId,labId,analysis,status,assignedTo,methodologyId,batchId,result,createdAt,updatedAt) VALUES(?,?,?,?,?,?,?,?,?,?,?)')
                .run('calc-history-work', 'calc-history-sample', 'calc-history-lab', 'SOC', 'COMPLETED', 'calc-history-analyst', 'calc-history-method',
                    'calc-history-batch', '42.125', '2026-09-01T10:00:00.123Z', '2026-09-02T11:00:00.456Z');
            db.prepare('INSERT INTO WorkAttempt(id,workItemId,attemptNo,status,author,batchId,executedMethodRevision,evidenceData,createdAt,updatedAt) VALUES(?,?,?,?,?,?,?,?,?,?)')
                .run('calc-history-attempt', 'calc-history-work', 1, 'RECORDED', 'calc-history-analyst', 'calc-history-batch',
                    '{"id":"calc-history-method","version":3}', '{"retained":"historical evidence"}', '2026-09-01T10:00:00.123Z', '2026-09-02T11:00:00.456Z');
            // Every one of the 24 original Result columns is non-default in at
            // least the first row; both retained readings have real attempt links.
            const insert = db.prepare(`INSERT INTO Result(id,sampleId,param,value,numericValue,rawInput,unit,flags,isValid,censoring,basis,provenance,
                methodologyId,replicateNo,isCurrent,supersededBy,enteredBy,analysedAt,equipmentId,equipmentReadiness,batchId,attemptId,createdAt,updatedAt)
                VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`);
            insert.run('calc-history-retained', 'calc-history-sample', 'SOC', ' 42,1250 ', 42.125, ' 42,1250 ', 'g/kg', '["HISTORICAL_QC_FLAG"]', 0,
                'BELOW_LOQ', 'OVEN_DRY', 'IMPORTED', 'calc-history-method', 2, 0, 'calc-history-current', 'calc-history-analyst',
                '2026-09-01T09:00:00.111Z', 'retained-equipment-id', '{"retained":"equipment evidence"}', 'calc-history-batch', 'calc-history-attempt',
                '2026-09-01T10:00:00.123Z', '2026-09-02T11:00:00.456Z');
            insert.run('calc-history-current', 'calc-history-sample', 'SOC', '43.25', 43.25, '43.25', 'g/kg', '["RETAINED_FLAG"]', 1,
                'NONE', 'AIR_DRY', 'MEASURED', 'calc-history-method', 1, 1, null, 'calc-history-analyst', '2026-09-02T09:00:00.789Z',
                null, null, 'calc-history-batch', 'calc-history-attempt', '2026-09-02T10:00:00.123Z', '2026-09-02T11:00:00.456Z');
            db.prepare('INSERT INTO AuditLog(id,entity,entityId,action,details,performedBy,timestamp) VALUES(?,?,?,?,?,?,?)')
                .run('calc-retained-audit', 'Result', 'calc-history-retained', 'IMPORTED', '{"retained":"original audit"}', 'calc-history-analyst', '2026-09-01T10:00:00.123Z');
        })();
        if (db.pragma('integrity_check', { simple: true }) !== 'ok' || db.pragma('foreign_key_check').length) throw Error('Pre-199 fixture integrity failed.');
    } catch (error) {
        db.close(); fs.rmSync(file, { force: true }); throw error;
    } finally { if (db.open) db.close(); }
    // Both prior receipts come only from their actual already-merged modules.
    require('../../scripts/install_workflow_state_guards').installWorkflowStateGuards({ dbPath: file, apply: true });
    require('../../scripts/install_result_attempt_links').installResultAttemptLinks({ dbPath: file, apply: true });
    return { file };
}
module.exports = { createPre199CalculationFixture };
