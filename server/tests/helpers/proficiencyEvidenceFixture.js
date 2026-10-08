const fs = require('node:fs');
const Database = require('better-sqlite3');
const { randomUUID } = require('node:crypto');
const { beforeGuards } = require('./legacyWorkflowDatabase');
const { assertOwnedTestDatabase } = require('./testOwnedDatabase');

function proficiencyEvidenceFixture(rounds) {
    const labId = randomUUID(), username = 'system:fixture';
    const f = beforeGuards({ actor: username, schemaVariant: 'PRE_1_3_SAMPLE_CODES', relatedRows: {
        Lab: [{ id: labId, code: labId, name: 'Owned PT evidence fixture', country: 'TEST', updatedAt: Date.now() }],
        User: [{ id: username, username, email: 'pt-fixture@example.test', password: 'fixture', role: 'SUPER_ADMIN', updatedAt: Date.now() }] } });
    const db = new Database(f.file);
    try {
        db.exec('CREATE TABLE "_schema_migrations" ("id" TEXT PRIMARY KEY NOT NULL,"appliedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,"details" TEXT)');
        for (const [index, row] of rounds.entries()) db.prepare(`INSERT INTO "ProficiencyRound"
            (id,provider,roundRef,labId,analysisCode,assignedValue,uncertainty,labResult,zScore,outcome,date,updatedAt)
            VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`).run(`round-${index}`, 'fixture', 'historical', labId,
                row.analysisCode || 'MiXeD', 1, row.sigma, 4, row.zScore ?? 3, row.outcome || 'UNSATISFACTORY', Date.now(), Date.now());
    } finally { db.close(); }
    f.by = username;
    f.close = () => {
        assertOwnedTestDatabase(f.file, username);
        for (const suffix of ['', '-wal', '-shm']) if (fs.existsSync(f.file + suffix)) fs.unlinkSync(f.file + suffix);
    };
    return f;
}
module.exports = { proficiencyEvidenceFixture };
