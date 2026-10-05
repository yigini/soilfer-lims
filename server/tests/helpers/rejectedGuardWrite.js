const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { createHash } = require('node:crypto');
const Database = require('better-sqlite3');
const { TRIGGER_CODES, mapStateError } = require('../../services/workflowStateRules');
const { assertOwnedTestDatabase } = require('./testOwnedDatabase');

function rejectedGuardWrite({ actor, file, statement, parameters = [], expectedGuardCode }) {
    file = assertOwnedTestDatabase(file, actor);
    if (!TRIGGER_CODES.includes(expectedGuardCode) || typeof statement !== 'string' || !Array.isArray(parameters)) {
        throw new Error('A statement and exact expected release guard code are required.');
    }
    // One bound DML statement only; the helper cannot execute guard/schema changes.
    if (!/^(?:UPDATE\s+|INSERT\s+INTO\s+|DELETE\s+FROM\s+)["`\[]?(?:Sample|WorkItem|Batch|ReviewDecision|ResultEvidenceEvent)["`\]]?\s/i.test(statement.trim()) ||
        /;|--|\/\*|\b(?:PRAGMA|TRIGGER|ATTACH|DETACH)\b/i.test(statement)) throw new Error('Only a single workflow guard probe is allowed.');
    const db = new Database(file, { fileMustExist: true });
    try {
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
        assert.equal(refusal.message, expectedGuardCode, 'The workflow guard refused with a different code.');
        assert.equal(mapStateError(refusal).code, expectedGuardCode);
        assert.equal(mapStateError(refusal).statusCode, 409);
    } finally {
        if (db.inTransaction) db.exec('ROLLBACK');
        db.close();
    }
}

module.exports = { rejectedGuardWrite };
