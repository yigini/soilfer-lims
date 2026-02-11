const { PrismaClient } = require('./prisma_client');

const prisma = new PrismaClient({
    // Optional: Log queries during development
    // log: ['query', 'info', 'warn', 'error'],
});

module.exports = prisma;
