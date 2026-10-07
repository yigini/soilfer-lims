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

function configureExchangeAdapter(adapter) {
    adapter.client.pragma('foreign_keys = ON');
    registerDbFunctions(adapter.client);
    const startTransaction = adapter.startTransaction.bind(adapter);
    adapter.startTransaction = async isolationLevel => {
        const transaction = await startTransaction(isolationLevel);
        const release = transaction.rollback.bind(transaction);
        transaction.rollback = async () => {
            // Prisma calls this hook after a failed COMMIT. SQLite leaves a
            // deferred-FK failure open; the upstream hook only releases its
            // mutex. Roll back the actual connection before releasing it.
            try {
                if (adapter.client.inTransaction) adapter.client.exec('ROLLBACK');
            } finally {
                await release();
            }
        };
        return transaction;
    };
    return adapter;
}

class ExchangePrismaBetterSqlite3 extends PrismaBetterSqlite3 {
    async connect() {
        return configureExchangeAdapter(await super.connect());
    }
    async connectToShadowDb() {
        return configureExchangeAdapter(await super.connectToShadowDb());
    }
}

const adapter = new ExchangePrismaBetterSqlite3({ url: `file:${dbPath}`, timeout: 5000 });
const prisma = new PrismaClient({ adapter });

module.exports = prisma;
