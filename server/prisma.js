const { PrismaClient } = require('./prisma_client');
const path = require('path');
const { PrismaBetterSqlite3 } = require('@prisma/adapter-better-sqlite3');
const Database = require('better-sqlite3');
const { registerDbFunctions, installSqliteHooks } = require('./services/exchangeDbFunctions');

// Install hooks so any new better-sqlite3 instances get UDFs
installSqliteHooks();

const dbPath = process.env.DATABASE_PATH ? path.resolve(process.env.DATABASE_PATH) : path.resolve(__dirname, 'prisma', 'dev.db');
if (process.env.NODE_ENV !== 'test') {
    console.log(`[PRISMA] Using better-sqlite3 adapter — DB: ${dbPath}`);
}

// Enforce production-grade SQLite pragmas on database file
try {
    const initDb = new Database(dbPath, { timeout: 5000 });
    initDb.pragma('journal_mode = WAL');
    initDb.pragma('busy_timeout = 5000');
    initDb.pragma('foreign_keys = ON');
    initDb.pragma('synchronous = NORMAL');
    initDb.close();
} catch (e) {
    if (process.env.NODE_ENV !== 'test') {
        console.warn('[PRISMA] Notice setting SQLite pragmas on startup:', e.message);
    }
}

class ExchangePrismaBetterSqlite3 extends PrismaBetterSqlite3 {
    async connect() {
        const adapter = await super.connect();
        if (adapter && adapter.client) {
            registerDbFunctions(adapter.client);
        }
        return adapter;
    }
    async connectToShadowDb() {
        const adapter = await super.connectToShadowDb();
        if (adapter && adapter.client) {
            registerDbFunctions(adapter.client);
        }
        return adapter;
    }
}

const adapter = new ExchangePrismaBetterSqlite3({ url: `file:${dbPath}`, timeout: 5000 });
const prisma = new PrismaClient({ adapter });

module.exports = prisma;
