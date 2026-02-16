const { PrismaClient } = require('./prisma_client');
const path = require('path');
const { PrismaBetterSqlite3 } = require('@prisma/adapter-better-sqlite3');

const dbPath = path.resolve(__dirname, 'prisma', 'dev.db');
const adapter = new PrismaBetterSqlite3({ url: `file:${dbPath}` });
const prisma = new PrismaClient({ adapter });

async function main() {
    try {
        const langs = await prisma.language.findMany();
        console.log('Languages:', JSON.stringify(langs, null, 2));
    } catch (e) {
        console.error(e);
    } finally {
        await prisma.$disconnect();
    }
}

main();
