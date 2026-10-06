const fs = require('fs');
const path = require('path');

module.exports = async function globalSetup() {
    process.env.NODE_ENV = 'test';
    process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret-key-12345';

    const tmpDir = path.resolve(__dirname, '.tmp');
    if (!fs.existsSync(tmpDir)) {
        fs.mkdirSync(tmpDir, { recursive: true });
    }

    const testDbPath = path.resolve(tmpDir, `test_${Date.now()}_${Math.random().toString(36).slice(2, 7)}.db`);
    const sourceDbPath = path.resolve(__dirname, '../prisma/dev.db');

    if (fs.existsSync(sourceDbPath)) {
        fs.copyFileSync(sourceDbPath, testDbPath);
        // Prisma db push cannot express this partial index. Install the actual
        // release DDL on the disposable test copy so CI checks the same guard.
        const Database = require('better-sqlite3');
        const db = new Database(testDbPath, { fileMustExist: true });
        try {
            if (!db.prepare("SELECT 1 FROM sqlite_master WHERE type = 'index' AND name = 'WorkItem_one_active_per_analysis'").get()) {
                db.exec(fs.readFileSync(path.resolve(__dirname, '../prisma/migrations/20261004190100_unique_active_workitem/migration.sql'), 'utf8'));
            }
            const stateColumns = ['Sample', 'WorkItem'].map(table => {
                const columns = db.prepare(`PRAGMA table_info("${table}")`).all().map(row => row.name);
                return ['holdPriorStatus', 'legacyStatus'].map(column => columns.includes(column));
            }).flat();
            const evidenceTable = !!db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name='ResultEvidenceEvent'").get();
            if (stateColumns.every(value => !value) && !evidenceTable) {
                db.transaction(() => db.exec(fs.readFileSync(path.resolve(__dirname, '../prisma/migrations/20261005000000_workflow_state_evidence/migration.sql'), 'utf8')))();
            } else if (!stateColumns.every(Boolean) || !evidenceTable) {
                throw new Error('Disposable test template has a partial workflow-state schema.');
            }
            const guardSql = fs.readFileSync(path.resolve(__dirname, '../prisma/migrations/20261005000100_workflow_state_guards/migration.sql'), 'utf8');
            const guardNames = [...guardSql.matchAll(/CREATE TRIGGER "([^"]+)"/g)].map(match => match[1]);
            const installed = new Set(db.prepare("SELECT name FROM sqlite_master WHERE type='trigger'").all().map(row => row.name));
            const present = guardNames.map(name => installed.has(name));
            if (present.every(value => !value)) db.transaction(() => db.exec(guardSql))();
            else if (!present.every(Boolean)) throw new Error('Disposable test template has partial workflow-state guards.');
            db.exec(`CREATE TABLE IF NOT EXISTS "_schema_migrations" ("id" TEXT PRIMARY KEY NOT NULL,
                "appliedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, "details" TEXT)`);
        } finally { db.close(); }
        require('../scripts/install_result_attempt_links').installResultAttemptLinks({ dbPath: testDbPath, apply: true });
        require('../scripts/install_reference_materials').installReferenceMaterials({ dbPath: testDbPath, apply: true });
    }

    process.env.DATABASE_PATH = testDbPath;
    process.env.DATABASE_URL = `file:${testDbPath}`;

    fs.writeFileSync(path.resolve(tmpDir, 'current_test_db.txt'), testDbPath, 'utf8');
};
