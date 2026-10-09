const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { createHash } = require('node:crypto');
const Database = require('better-sqlite3');
const { TRIGGER_CODES, mapStateError } = require('../../services/workflowStateRules');
const { assertOwnedTestDatabase } = require('./testOwnedDatabase');

const UNIQUE_CONSTRAINTS = Object.freeze({ WorkItem_one_active_per_analysis: 'WorkItem.sampleId, WorkItem.analysis',
    WorkAttempt_workItemId_attemptNo_unique: 'WorkAttempt.workItemId, WorkAttempt.attemptNo',
    result_one_current: 'Result.sampleId, Result.param, Result.replicateNo, Result.attemptId' });
const UNIQUE_TABLES = Object.freeze({ WorkItem_one_active_per_analysis: 'WorkItem',
    WorkAttempt_workItemId_attemptNo_unique: 'WorkAttempt', result_one_current: 'Result' });
const ATTEMPT_GUARD_CODES = Object.freeze(['RESULT_ATTEMPT_REQUIRED','RESULT_ATTEMPT_IMMUTABLE',
    'WORK_ATTEMPT_STATUS_INVALID','WORK_ATTEMPT_REASON_INVALID','WORK_ATTEMPT_NUMBER_INVALID',
    'WORK_ATTEMPT_EVIDENCE_IMMUTABLE','WORK_ATTEMPT_IDENTITY_IMMUTABLE','WORK_ATTEMPT_BATCH_IMMUTABLE',
    'WORK_ATTEMPT_CONFLICT_FLAG_FORBIDDEN','WORK_ATTEMPT_CONFLICT_FLAG_IMMUTABLE','WORK_ATTEMPT_DELETE_REFUSED']);
const REVIEW_ATTEMPT_CODES = Object.freeze(['REVIEW_ATTEMPT_REQUIRED','REVIEW_ATTEMPT_INVALID']);
const SAME_TRANSACTION_CASE = 'WorkAttempt_evidence_immutable_same_transaction';
const EVIDENCE_FIELDS = Object.freeze(['evidenceData','evidenceHash','instrumentId']);

function rejectedGuardWrite(options) {
    // #191 pin6072132694: one closed scratch-only case in the existing
    // inventoried authority. No caller supplies SQL or an expected outcome.
    if (Object.getOwnPropertyDescriptor(options,'case')?.value === 'WorkItem_191_handoff_trigger') {
        const cases = Object.freeze({
            'old-repeat-required':{oldStatus:'REPEAT_REQUIRED'}, 'parent-null-hash':{hash:null},
            'parent-wrong-batch':{parentBatch:'other-batch'}, 'parent-wrong-qc-batch':{parentQcBatch:'other-batch'},
            'wrong-analyte':{analysis:'Q'}, 'mixed-failed-membership':{secondStatus:'QC_FAIL'},
            'mixed-accepted-wrong-membership':{secondStatus:'QC_PASS'}, 'qc-fail':{status:'QC_FAIL'},
            'qc-pending':{status:'QC_PENDING'}, 'open-unstarted':{status:'OPEN',startedAt:null},
            'accepted-pass':{status:'QC_PASS',accept:true}, 'accepted-warn':{status:'QC_WARN',accept:true},
            'accepted-deviation':{status:'ACCEPTED_WITH_DEVIATION',accept:true},
            'accepted-texture-alias':{textureAlias:true,status:'QC_PASS',accept:true}
        });
        const keys = Reflect.ownKeys(options);
        if (Object.getPrototypeOf(options)!==Object.prototype || keys.length!==4 ||
            keys.some(key=>!['actor','file','case','fixtureCase'].includes(key)) ||
            Object.values(Object.getOwnPropertyDescriptors(options)).some(d=>!Object.hasOwn(d,'value')) ||
            !Object.hasOwn(cases,options.fixtureCase)) throw Error('Unknown closed handoff trigger option or case.');
        const caller = path.relative(path.resolve(__dirname,'../..'),globalThis.expect?.getState?.().testPath || '').replace(/\\/g,'/');
        if (caller!=='tests/contracts/audit_3_1_attempt_sql_guards.test.js') throw Error('Closed handoff trigger case refuses this caller.');
        const callerFile = assertOwnedTestDatabase(options.file,options.actor);
        const callerBytes = fs.existsSync(callerFile) ? fs.readFileSync(callerFile) : null;
        const scratch = assertOwnedTestDatabase(path.join(path.dirname(callerFile),
            `audit_191_handoff-${require('node:crypto').randomUUID()}.db`),options.actor);
        if (fs.existsSync(scratch)) throw Error('Closed handoff scratch already exists.');
        const c = cases[options.fixtureCase], timestamp = Date.parse('2026-10-01T12:00:00Z');
        let scratchDb, probeChanges;
        try {
            scratchDb = new Database(scratch);
            scratchDb.pragma('foreign_keys=ON');scratchDb.exec('BEGIN IMMEDIATE');
            const ddl = fs.readFileSync(path.join(__dirname,'fixtures/pre190_full_application_schema.sql'));
            assert.equal(createHash('sha256').update(ddl).digest('hex'),'e2496a65a9c607e80a82924ff7ed6a4033d1da05fedb907c83dd0918f022923b');
            scratchDb.exec(ddl.toString('utf8'));
            const predecessor = require('../../services/workAttemptMigrationSource').loadWorkAttemptMigrationSource();
            const successor = require('../../services/workRepeatMigrationSource').loadWorkRepeatMigrationSource();
            scratchDb.exec(predecessor.schemaSql);scratchDb.exec(successor.schemaSql);
            const analysis = c.textureAlias?'SOIL_PSD_TEXTURE':c.analysis||'P', itemAnalysis = c.textureAlias?'TEXTURE':'P';
            const evidenceData = '{"retained":"original execution"}';
            scratchDb.prepare('INSERT INTO Sample(id,originalId,status,updatedAt) VALUES (?,?,?,?)').run('sample','sample','PROCESSING',timestamp);
            for (const id of ['batch','other-batch']) scratchDb.prepare('INSERT INTO Batch(id,analysis,status,createdBy,startedAt) VALUES (?,?,?,?,?)')
                .run(id,analysis,'OPEN','system:fixture',Object.hasOwn(c,'startedAt')?c.startedAt:timestamp);
            scratchDb.prepare('INSERT INTO WorkItem(id,sampleId,analysis,status,batchId,rackPosition,updatedAt) VALUES (?,?,?,?,?,?,?)')
                .run('item','sample',itemAnalysis,c.oldStatus||'COMPLETED','batch',1,timestamp);
            scratchDb.prepare('INSERT INTO WorkAttempt(id,workItemId,attemptNo,status,evidenceHash,evidenceData,batchId,qcBatchId,updatedAt) VALUES (?,?,?,?,?,?,?,?,?)')
                .run('parent','item',1,'QUESTIONED',Object.hasOwn(c,'hash')?c.hash:createHash('sha256').update(evidenceData).digest('hex'),
                    evidenceData,c.parentBatch||'batch',c.parentQcBatch||'batch',timestamp);
            scratchDb.prepare('INSERT INTO Result(id,sampleId,param,value,rawInput,provenance,attemptId,batchId,updatedAt) VALUES (?,?,?,?,?,?,?,?,?)')
                .run('retained-result','sample',itemAnalysis,'0.123456789','0.123456789','MEASURED','parent','batch',timestamp);
            scratchDb.prepare('INSERT INTO WorkAttempt(id,workItemId,attemptNo,status,parentAttemptId,reason,requestedBy,requestedAt,updatedAt) VALUES (?,?,?,?,?,?,?,?,?)')
                .run('child','item',2,'OPEN','parent','CONFIRMATION','system:fixture',timestamp,timestamp);
            scratchDb.prepare('INSERT INTO AuditLog(id,entity,entityId,action,details,performedBy) VALUES (?,?,?,?,?,?)')
                .run('created','WORK_ATTEMPT','child','CREATED',JSON.stringify({from:null,to:'OPEN',reason:'CONFIRMATION',note:null}),'system:fixture');
            const members = [[analysis,c.status||'QC_PASS'],...(c.secondStatus?[['Q',c.secondStatus]]:[])];
            for (const [index,[code,status]] of members.entries()) {
                scratchDb.prepare('INSERT INTO BatchAnalyte(id,batchId,analysisCode,status,provenance) VALUES (?,?,?,?,?)')
                    .run('analyte-'+index,'batch',code,status,'NATIVE');
                scratchDb.prepare('INSERT INTO BatchPosition(id,batchId,position,kind,sampleId,provenance,legacySource) VALUES (?,?,?,?,?,?,?)')
                    .run('position-'+index,'batch',index+1,'SAMPLE','sample','NATIVE',c.textureAlias?JSON.stringify({textureAlias:1,batchAnalysis:analysis}):null);
                scratchDb.prepare('INSERT INTO BatchPositionWorkItem(id,positionId,workItemId,analysisCode) VALUES (?,?,?,?)')
                    .run('membership-'+index,'position-'+index,'item',c.textureAlias?itemAnalysis:code);
            }
            assert.equal(scratchDb.pragma('foreign_key_check').length,0);
            const membership = require('../../services/qcBracketMembershipMigrationSource').loadBracketMembershipSource();
            function exactTriggers(source) {
                return [...source.matchAll(/^CREATE TRIGGER "([^"]+)"[\s\S]*?^END;/gm)];
            }
            function assertVerbatim(source) {
                for (const match of exactTriggers(source)) assert.equal(
                    scratchDb.prepare('SELECT sql FROM sqlite_master WHERE name=?').get(match[1]).sql+';',match[0]);
            }
            const prior = exactTriggers(membership.sql);
            assert.equal(prior.length,1);assert.equal(prior[0][1],'WorkItem_batch_membership_guard');
            scratchDb.exec(prior[0][0]);assertVerbatim(membership.sql);
            scratchDb.exec(predecessor.guardsSql);assertVerbatim(predecessor.guardsSql);
            scratchDb.exec(successor.guardsSql);assertVerbatim(successor.guardsSql);
            assert.equal(scratchDb.prepare("SELECT name FROM sqlite_master WHERE name='_schema_migrations'").get(),undefined);
            function allRows() {
                return scratchDb.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name").all()
                    .map(({name})=>({name,rows:scratchDb.prepare(`SELECT * FROM "${name}"`).all()}));
            }
            const before = allRows(), beforeChanges = scratchDb.prepare('SELECT total_changes() n').get().n;
            const beforeBytes = fs.readFileSync(scratch);
            const update = scratchDb.prepare("UPDATE WorkItem SET status='REPEAT_REQUIRED',batchId=NULL,rackPosition=NULL WHERE id=?");
            if (c.accept) {
                assert.equal(update.run('item').changes,1);
                const pointer=scratchDb.prepare('SELECT status,batchId,rackPosition FROM WorkItem WHERE id=?').get('item');
                assert.equal(pointer.status,'REPEAT_REQUIRED');assert.equal(pointer.batchId,null);assert.equal(pointer.rackPosition,null);
                // Compare every SQLite value/column, without depending on the
                // native binding's array/object realm under Jest's VM.
                assert.equal(JSON.stringify(allRows().filter(row=>row.name!=='WorkItem')),
                    JSON.stringify(before.filter(row=>row.name!=='WorkItem')));
                assert.equal(JSON.stringify(scratchDb.prepare('SELECT * FROM WorkItem').all()),
                    JSON.stringify(before.find(row=>row.name==='WorkItem').rows.map(row=>({...row,status:'REPEAT_REQUIRED',batchId:null,rackPosition:null}))));
                // Include real retained Result evidence, not an empty-table proof.
                assert.equal(before.find(row=>row.name==='Result').rows.length,1);
            } else {
                assert.throws(()=>update.run('item'),error=>error.message==='BATCH_MEMBERSHIP_FROZEN');
                assert.equal(JSON.stringify(allRows()),JSON.stringify(before));assert.deepEqual(fs.readFileSync(scratch),beforeBytes);
            }
            probeChanges = scratchDb.prepare('SELECT total_changes() n').get().n-beforeChanges;
            assert.equal(probeChanges,c.accept?1:0);
            scratchDb.exec('ROLLBACK');
            assert.equal(scratchDb.prepare("SELECT count(*) n FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'").get().n,0);
        } finally {
            if (scratchDb?.inTransaction) scratchDb.exec('ROLLBACK');
            scratchDb?.close();
            // Only this newly created owned file and its journal companions.
            for (const suffix of ['', '-wal','-shm','-journal']) fs.rmSync(scratch+suffix,{force:true});
        }
        assert.equal(fs.existsSync(scratch),false);
        if (callerBytes) assert.deepEqual(fs.readFileSync(callerFile),callerBytes);
        else assert.equal(fs.existsSync(callerFile),false);
        return {fixtureCase:options.fixtureCase,expected:c.accept?'HANDOFF':'REFUSED',probeChanges,
            committedChanges:0,rolledBack:true,scratchRemoved:true,callerFileUntouched:true,evidencePreserved:true};
    }
    let { actor, file, statement, parameters = [], expectedGuardCode, expectedConstraint } = options;
    const sameTransaction = options.case === SAME_TRANSACTION_CASE;
    if (options.case != null && !sameTransaction) throw Error('Unknown closed guard case.');
    if (sameTransaction) {
        const values = options.values;
        if (Object.keys(options).some(key=>!['actor','file','case','values'].includes(key)) ||
            !values || Object.keys(values).some(key=>!['id','workItemId','evidenceData','evidenceHash','field','replacement'].includes(key)) ||
            !['id','workItemId','evidenceData','evidenceHash'].every(key=>typeof values[key]==='string'&&values[key].length) ||
            !EVIDENCE_FIELDS.includes(values.field) || typeof values.replacement !== 'string' ||
            createHash('sha256').update(values.evidenceData).digest('hex') !== values.evidenceHash) throw Error('Closed evidence case requires only final bound values.');
        JSON.parse(values.evidenceData);
        expectedGuardCode = 'WORK_ATTEMPT_EVIDENCE_IMMUTABLE';
    }
    file = assertOwnedTestDatabase(file, actor);
    const triggerProbe = TRIGGER_CODES.includes(expectedGuardCode);
    const batchForeignKeyProbe = expectedGuardCode === 'SQLITE_CONSTRAINT_FOREIGNKEY' && expectedConstraint === 'WorkAttempt_batchId_foreign_key';
    const attemptProbe = batchForeignKeyProbe || ATTEMPT_GUARD_CODES.includes(expectedGuardCode) ||
        ['RESULT_ATTEMPT_NOT_FOUND', 'RESULT_ATTEMPT_SAMPLE_MISMATCH', 'RESULT_ATTEMPT_REFERENCED'].includes(expectedGuardCode) ||
        expectedGuardCode === 'SQLITE_CONSTRAINT_UNIQUE' && ['WorkAttempt_workItemId_attemptNo_unique','result_one_current'].includes(expectedConstraint);
    const uniqueProbe = expectedGuardCode === 'SQLITE_CONSTRAINT_UNIQUE' && Object.hasOwn(UNIQUE_CONSTRAINTS, expectedConstraint);
    const foreignKeyProbe = expectedGuardCode === 'SQLITE_CONSTRAINT_FOREIGNKEY';
    // #179 pin 5988155355: SQLite implements this one ON DELETE RESTRICT FK
    // with SQLITE_CONSTRAINT_TRIGGER. A workflow trigger cannot impersonate it.
    const restrictTargets = { WorkItem_duplicateOf_restrict: { parent: 'WorkItem', child: 'WorkItem', field: 'duplicateOf' },
        Sample_Result_restrict: { parent: 'Sample', child: 'Result', field: 'sampleId' },
        Batch_WorkAttempt_restrict: { parent: 'Batch', child: 'WorkAttempt', field: 'batchId' } };
    const restrictProbe = expectedGuardCode === 'SQLITE_CONSTRAINT_TRIGGER' && Object.hasOwn(restrictTargets, expectedConstraint);
    if (!sameTransaction && (!(triggerProbe || uniqueProbe || foreignKeyProbe || restrictProbe) || typeof statement !== 'string' || !Array.isArray(parameters))) {
        throw new Error('A statement and exact expected release guard code are required.');
    }
    // One bound DML statement only; the helper cannot execute guard/schema changes.
    const permitted = attemptProbe ? /^(?:UPDATE\s+|INSERT\s+INTO\s+|DELETE\s+FROM\s+)["`\[]?(?:Result|WorkAttempt)["`\]]?\s/i
        : /^(?:UPDATE\s+|INSERT\s+INTO\s+|DELETE\s+FROM\s+)["`\[]?(?:Sample|WorkItem|Batch|ReviewDecision|ResultEvidenceEvent)["`\]]?\s/i;
    if (!sameTransaction && (!permitted.test(statement.trim()) ||
        /;|--|\/\*|\b(?:PRAGMA|TRIGGER|ATTACH|DETACH)\b/i.test(statement))) throw new Error('Only a single workflow guard probe is allowed.');
    const db = new Database(file, { fileMustExist: true });
    try {
        db.pragma('foreign_keys = ON');
        assert.equal(db.pragma('foreign_keys', { simple: true }), 1, 'Constraint probes require foreign keys ON.');
        if (uniqueProbe) {
            const index = db.prepare("SELECT name, tbl_name FROM sqlite_master WHERE type='index' AND name=?").get(expectedConstraint);
            assert.equal(index?.name, expectedConstraint, 'The exact expected unique index must exist.');
            const table = UNIQUE_TABLES[expectedConstraint];
            assert.equal(index.tbl_name, table, 'The expected unique index must constrain its pinned table.');
            assert.equal(db.prepare(`PRAGMA index_list("${table}")`).all().find(row => row.name === expectedConstraint)?.unique, 1);
        }
        if (restrictProbe) {
            const target = restrictTargets[expectedConstraint];
            assert.match(statement.trim(), new RegExp(`^DELETE\\s+FROM\\s+"?${target.parent}"?\\s+WHERE\\s+"?id"?\\s*=\\s*\\?$`, 'i'),
                `The pinned RESTRICT probe requires a single bound ${target.parent} id deletion.`);
            assert.equal(parameters.length, 1, 'The pinned RESTRICT deletion needs one bound id.');
            const keys = db.prepare(`PRAGMA foreign_key_list("${target.child}")`).all().filter(row => row.from === target.field && row.table === target.parent);
            assert.equal(keys.length, 1, 'The exact duplicateOf foreign key must exist once.');
            assert.equal(keys[0].table, target.parent); assert.equal(keys[0].to, 'id'); assert.equal(keys[0].on_delete, 'RESTRICT');
            assert.ok(db.prepare(`SELECT id FROM "${target.parent}" WHERE id = ?`).get(parameters[0]), 'The RESTRICT target must exist.');
            assert.ok(db.prepare(`SELECT id FROM "${target.child}" WHERE "${target.field}" = ? LIMIT 1`).get(parameters[0]),
                'The RESTRICT target must have a referencing duplicate.');
            const impersonating = db.prepare("SELECT name,sql FROM sqlite_master WHERE type='trigger'").all()
                .filter(row => /FOREIGN KEY constraint failed/i.test(row.sql));
            assert.equal(impersonating.length, 0, 'An installed trigger could impersonate the native foreign-key refusal.');
        }
        const guardSql = fs.readFileSync(path.resolve(__dirname, '../../prisma/migrations/20261005000100_workflow_state_guards/migration.sql'), 'utf8');
        const installed = new Set(db.prepare("SELECT name FROM sqlite_master WHERE type='trigger'").all().map(row => row.name));
        for (const match of guardSql.matchAll(/CREATE TRIGGER "([^"]+)"/g)) assert.ok(installed.has(match[1]), `Missing release guard ${match[1]}`);
        if (sameTransaction || batchForeignKeyProbe || ATTEMPT_GUARD_CODES.includes(expectedGuardCode) || REVIEW_ATTEMPT_CODES.includes(expectedGuardCode) ||
            ['WorkAttempt_workItemId_attemptNo_unique','result_one_current','Batch_WorkAttempt_restrict'].includes(expectedConstraint)) {
            const release = require('../../services/workAttemptMigrationSource').loadWorkAttemptMigrationSource();
            const prior = require('../../services/resultAttemptMigrationSource').loadResultAttemptMigrationSource();
            for (const sql of [prior.guardsSql,release.guardsSql]) for (const match of sql.matchAll(/^CREATE (?:TRIGGER "([^"]+)"[\s\S]*?^END;|UNIQUE INDEX "([^"]+)"[^;]*;)/gm)) {
                const name = match[1] || match[2], actual = db.prepare('SELECT type,sql FROM sqlite_master WHERE name=?').get(name);
                const originalMatches = actual?.sql.trim() === match[0].trim().replace(/;$/,'');
                // The only successors accepted by #190 itself require both
                // exact #191 DDL and its complete predecessor-bound receipt.
                const verifiedSuccessor = !originalMatches && actual &&
                    require('../../services/workRepeatInstallationEvidence').isVerifiedRepeatSuccessor(db,name,actual);
                assert.ok(originalMatches || verifiedSuccessor, `Missing or changed actual release guard/index ${name}`);
            }
        }
        if (batchForeignKeyProbe) {
            assert.match(statement.trim(), /^INSERT INTO "?WorkAttempt"?\s*\(id,workItemId,attemptNo,status,batchId,createdAt,updatedAt\) VALUES \(\?,\?,\?,\?,\?,\?,\?\)$/i);
            assert.equal(parameters.length,7);
            assert.ok(db.prepare('SELECT id FROM WorkItem WHERE id=? AND duplicateOf IS NULL').get(parameters[1]), 'Canonical WorkItem must exist.');
            assert.ok(typeof parameters[4]==='string' && parameters[4].length && !db.prepare('SELECT id FROM Batch WHERE id=?').get(parameters[4]), 'Batch target must be non-NULL and absent.');
            const keys = db.prepare('PRAGMA foreign_key_list("WorkAttempt")').all().filter(row=>row.from==='batchId'&&row.table==='Batch');
            assert.equal(keys.length,1);assert.equal(keys[0].to,'id');assert.equal(keys[0].on_delete,'RESTRICT');assert.equal(keys[0].on_update,'CASCADE');
        }
        function snapshot() {
            return db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name").all().map(({ name }) => {
                const rows = db.prepare(`SELECT * FROM "${name.replace(/"/g, '""')}"`).all()
                    .map(row => JSON.stringify(row, (_, value) => typeof value === 'bigint' ? `${value}n` : value)).sort();
                return { table: name, count: rows.length, checksum: createHash('sha256').update(JSON.stringify(rows)).digest('hex') };
            });
        }
        db.exec('BEGIN IMMEDIATE');
        const before = snapshot();
        if (sameTransaction) {
            // #190 pin6057845305: this sole fixed two-step case accepts no SQL.
            const values = options.values;
            assert.ok(db.prepare('SELECT id FROM WorkItem WHERE id=? AND duplicateOf IS NULL').get(values.workItemId));
            assert.equal(db.prepare('SELECT id FROM WorkAttempt WHERE id=?').get(values.id),undefined);
            const maximum = db.prepare('SELECT max(attemptNo) n FROM WorkAttempt WHERE workItemId=?').get(values.workItemId).n || 0;
            const timestamp = Date.now(), evidence = JSON.parse(values.evidenceData);
            db.prepare('INSERT INTO WorkAttempt(id,workItemId,attemptNo,status,evidenceData,evidenceHash,instrumentId,createdAt,updatedAt) VALUES (?,?,?,?,?,?,?,?,?)')
                .run(values.id,values.workItemId,maximum+1,'RECORDED',values.evidenceData,values.evidenceHash,evidence.equipmentReadiness?.equipmentId || null,timestamp,timestamp);
            const inserted = snapshot();let refusal;
            try { db.prepare(`UPDATE WorkAttempt SET "${values.field}"=? WHERE id=?`).run(values.replacement,values.id); } catch(error) { refusal=error; }
            assert.ok(refusal,'The creating-transaction mutation unexpectedly succeeded.');
            assert.equal(refusal.message,expectedGuardCode);assert.equal(mapStateError(refusal).code,expectedGuardCode);assert.equal(mapStateError(refusal).statusCode,409);
            assert.deepEqual(snapshot(),inserted,'A refused creating-transaction update changed rows.');
            db.exec('ROLLBACK');assert.deepEqual(snapshot(),before);assert.equal(db.prepare('SELECT id FROM WorkAttempt WHERE id=?').get(values.id),undefined);
            return;
        }
        let refusal;
        try { db.prepare(statement).run(...parameters); } catch (error) { refusal = error; }
        const after = snapshot();
        db.exec('ROLLBACK');
        assert.deepEqual(after, before, 'A refused guard probe changed database rows.');
        assert.deepEqual(snapshot(), before, 'A guard probe changed rows outside its transaction.');
        assert.ok(refusal, 'The workflow guard probe unexpectedly succeeded.');
        if (triggerProbe) {
            assert.equal(refusal.message, expectedGuardCode, 'The workflow guard refused with a different code.');
            assert.equal(mapStateError(refusal).code, expectedGuardCode);
            assert.equal(mapStateError(refusal).statusCode, 409);
        } else {
            assert.equal(refusal.name, 'SqliteError');
            assert.equal(refusal.code, expectedGuardCode, `SQLite refused with a different constraint code. Native refusal: ${refusal.message}`);
            assert.equal(refusal.message, uniqueProbe ? `UNIQUE constraint failed: ${UNIQUE_CONSTRAINTS[expectedConstraint]}`
                : 'FOREIGN KEY constraint failed', 'SQLite refused with a different constraint identity.');
        }
        // The new closed child-process probe reports its verified native error.
        // Existing guard probes retain their no-value contract.
        if (expectedConstraint === 'Sample_Result_restrict') {
            return { name: refusal.name, code: refusal.code, message: refusal.message };
        }
    } finally {
        if (db.inTransaction) db.exec('ROLLBACK');
        db.close();
    }
}

module.exports = { rejectedGuardWrite };
