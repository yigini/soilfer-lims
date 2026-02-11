const { PrismaClient } = require('./prisma_client');
const path = require('path');

const isArm64Windows = process.arch === 'arm64' && process.platform === 'win32';

let prisma;

if (isArm64Windows) {
    // ARM64 Windows: Prisma native engine (x64) is incompatible.
    // Use better-sqlite3 driver adapter instead.
    console.log('[PRISMA] ARM64 Windows detected — using better-sqlite3 driver adapter');
    const Database = require('better-sqlite3');
    const { PrismaBetterSqlite3 } = require('@prisma/adapter-better-sqlite3');

    const dbPath = path.resolve(__dirname, 'prisma', 'dev.db');
    const db = new Database(dbPath);
    db.pragma('journal_mode = WAL');
    const adapter = new PrismaBetterSqlite3(db);
    prisma = new PrismaClient({ adapter });

    // Suppress the async engine-loading crash — the adapter handles all queries
    process.on('unhandledRejection', (reason) => {
        if (reason && reason.constructor && reason.constructor.name === 'PrismaClientInitializationError'
            && reason.message && reason.message.includes('query_engine')) {
            console.log('[PRISMA] Suppressed native engine load error (adapter is active)');
            return;
        }
        // Re-throw non-Prisma rejections
        throw reason;
    });
} else {
    // All other platforms: use native Prisma engine
    prisma = new PrismaClient({});
}

module.exports = prisma;
