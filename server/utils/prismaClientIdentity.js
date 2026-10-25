// Reloading a module must not reclassify roots that were already constructed.
const registryKey = Symbol.for('soilfer-lims.prismaRootClients');
if (!Object.hasOwn(globalThis, registryKey)) {
    Object.defineProperty(globalThis, registryKey, { value: new WeakSet() });
}
const rootClients = globalThis[registryKey];

// Record identity at construction, including standalone tools and isolated test
// databases. No client capabilities or private Prisma fields determine its role.
function createRootClient(options) {
    const { PrismaClient } = require('../prisma_client');
    const client = new PrismaClient(options);
    rootClients.add(client);
    return client;
}

// Transaction clients may also expose $transaction. Keep the exact caller object
// so nested commands continue to share the outer transaction and QC collector.
function isRootClient(client) {
    return rootClients.has(client);
}

module.exports = { createRootClient, isRootClient };
