const { PrismaClient } = require('./prisma_client');
const path = require('path');

// Prisma 7 uses TypeScript query compiler by default.
// Engine type "client" requires an adapter (no native engine).
// Use better-sqlite3 driver adapter on all platforms.
const { PrismaBetterSqlite3 } = require('@prisma/adapter-better-sqlite3');

const dbPath = process.env.DATABASE_PATH ? path.resolve(process.env.DATABASE_PATH) : path.resolve(__dirname, 'prisma', 'dev.db');
if (process.env.NODE_ENV !== 'test') {
    console.log(`[PRISMA] Using better-sqlite3 adapter — DB: ${dbPath}`);
}

const adapter = new PrismaBetterSqlite3({ url: `file:${dbPath}` });
const prisma = new PrismaClient({ adapter });

module.exports = prisma;
