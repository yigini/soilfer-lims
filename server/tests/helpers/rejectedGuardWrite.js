const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { createHash } = require('node:crypto');
const Database = require('better-sqlite3');
const { TRIGGER_CODES, mapStateError } = require('../../services/workflowStateRules');
const { assertOwnedTestDatabase } = require('./testOwnedDatabase');

const UNIQUE_CONSTRAINTS = Object.freeze({ WorkItem_one_active_per_analysis: 'WorkItem.sampleId, WorkItem.analysis' });

function rejectedGuardWrite({ actor, file, statement, parameters = [], expectedGuardCode, expectedConstraint }) {
    file = assertOwnedTestDatabase(file, actor);
    const triggerProbe = TRIGGER_CODES.includes(expectedGuardCode);
    const uniqueProbe = expectedGuardCode === 'SQLITE_CONSTRAINT_UNIQUE' && Object.hasOwn(UNIQUE_CONSTRAINTS, expectedConstraint);
    const foreignKeyProbe = expectedGuardCode === 'SQLITE_CONSTRAINT_FOREIGNKEY';
    if (!(triggerProbe || uniqueProbe || foreignKeyProbe) || typeof statement !== 'string' || !Array.isArray(parameters)) {
        throw new Error('A statement and exact expected release guard code are required.');
    }
    // One bound DML statement only; the helper cannot execute guard/schema changes.
    if (!/^(?:UPDATE\s+|INSERT\s+INTO\s+|DELETE\s+FROM\s+)["`\[]?(?:Sample|WorkItem|Batch|ReviewDecision|ResultEvidenceEvent)["`\]]?\s/i.test(statement.trim()) ||
        /;|--|\/\*|\b(?:PRAGMA|TRIGGER|ATTACH|DETACH)\b/i.test(statement)) throw new Error('Only a single workflow guard probe is allowed.');
    const db = new Database(file, { fileMustExist: true });
    try {
        db.pragma('foreign_keys = ON');
        assert.equal(db.pragma('foreign_keys', { simple: true }), 1, 'Constraint probes require foreign keys ON.');
        if (uniqueProbe) {
            const index = db.prepare("SELECT name, tbl_name FROM sqlite_master WHERE type='index' AND name=?").get(expectedConstraint);
            assert.equal(index?.name, expectedConstraint, 'The exact expected unique index must exist.');
            assert.equal(index.tbl_name, 'WorkItem', 'The expected unique index must constrain WorkItem.');
            assert.equal(db.prepare('PRAGMA index_list("WorkItem")').all().find(row => row.name === expectedConstraint)?.unique, 1);
        }
        const guardSql = fs.readFileSync(path.resolve(__dirname, '../../prisma/migrations/20261005000100_workflow_state_guards/migration.sql'), 'utf8');
        const installed = new Set(db.prepare("SELECT name FROM sqlite_master WHERE type='trigger'").all().map(row => row.name));
        for (const match of guardSql.matchAll(/CREATE TRIGGER "([^"]+)"/g)) assert.ok(installed.has(match[1]), `Missing release guard ${match[1]}`);
        function snapshot() {
            return db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name").all().map(({ name }) => {
                const rows = db.prepare(`SELECT * FROM "${name.replace(/"/g, '""')}"`).all()
                    .map(row => JSON.stringify(row, (_, value) => typeof value === 'bigint' ? `${value}n` : value)).sort();
                return { table: name, count: rows.length, checksum: createHash('sha256').update(JSON.stringify(rows)).digest('hex') };
            });
        }
        db.exec('BEGIN IMMEDIATE');
        const before = snapshot();
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
            assert.equal(refusal.code, expectedGuardCode, 'SQLite refused with a different constraint code.');
            assert.equal(refusal.message, uniqueProbe ? `UNIQUE constraint failed: ${UNIQUE_CONSTRAINTS[expectedConstraint]}`
                : 'FOREIGN KEY constraint failed', 'SQLite refused with a different constraint identity.');
        }
    } finally {
        if (db.inTransaction) db.exec('ROLLBACK');
        db.close();
    }
}

module.exports = { rejectedGuardWrite };
