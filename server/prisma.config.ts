import path from 'node:path';
import { defineConfig } from 'prisma/config';

export default defineConfig({
    earlyAccess: true,
    schema: path.join(__dirname, 'prisma', 'schema.prisma'),
    migrate: {
        adapter: async () => {
            const { PrismaBetterSqlite3 } = await import('@prisma/adapter-better-sqlite3');
            const Database = (await import('better-sqlite3')).default;
            const dbPath = path.join(__dirname, 'prisma', 'dev.db');
            const db = new Database(dbPath);
            return new PrismaBetterSqlite3(db);
        },
    },
});
