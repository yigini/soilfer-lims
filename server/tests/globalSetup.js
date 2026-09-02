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
    }

    process.env.DATABASE_PATH = testDbPath;
    process.env.DATABASE_URL = `file:${testDbPath}`;

    fs.writeFileSync(path.resolve(tmpDir, 'current_test_db.txt'), testDbPath, 'utf8');
};
