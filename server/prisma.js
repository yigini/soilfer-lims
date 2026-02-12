const { PrismaClient } = require('./prisma_client');
const path = require('path');

const isArm64Windows = process.arch === 'arm64' && process.platform === 'win32';
const dbPath = path.resolve(__dirname, 'prisma', 'dev.db');

let prisma;

if (isArm64Windows) {
    // ARM64 Windows: Prisma native engine (x64) is incompatible.
    // Use better-sqlite3 driver adapter (Prisma 7 factory API).
    console.log('[PRISMA] ARM64 Windows detected — using better-sqlite3 driver adapter');
    const { PrismaBetterSqlite3 } = require('@prisma/adapter-better-sqlite3');

    const adapter = new PrismaBetterSqlite3({ url: `file:${dbPath}` });
    prisma = new PrismaClient({ adapter });
} else {
    // All other platforms (Linux Docker, macOS, etc.): use native Prisma engine
    // Pass datasourceUrl since Prisma 7 removed url from schema.prisma
    prisma = new PrismaClient({
        datasourceUrl: `file:${dbPath}`
    });
}

module.exports = prisma;
