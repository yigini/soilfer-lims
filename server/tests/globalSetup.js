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
        } finally { db.close(); }
    }

    process.env.DATABASE_PATH = testDbPath;
    process.env.DATABASE_URL = `file:${testDbPath}`;

    fs.writeFileSync(path.resolve(tmpDir, 'current_test_db.txt'), testDbPath, 'utf8');
};
