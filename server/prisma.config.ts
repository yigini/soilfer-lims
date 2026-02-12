import path from 'node:path';
import { defineConfig } from 'prisma/config';

// Database path relative to this config file (server/ directory)
const dbPath = path.join(__dirname, 'prisma', 'dev.db');

export default defineConfig({
    earlyAccess: true,
    schema: path.join(__dirname, 'prisma', 'schema.prisma'),
    migrate: {
        adapter: async () => {
            const { PrismaBetterSqlite3 } = await import('@prisma/adapter-better-sqlite3');
            return new PrismaBetterSqlite3({ url: `file:${dbPath}` });
        },
    },
});
