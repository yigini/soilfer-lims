// Reloading a module must not reclassify roots that were already constructed.
const registryKey = Symbol.for('soilfer-lims.prismaRootClients');
if (!Object.hasOwn(globalThis, registryKey)) {
    Object.defineProperty(globalThis, registryKey, { value: new WeakSet() });
}
const rootClients = globalThis[registryKey];

// Explicit construction hook for roots and root adapters. Return the exact
// object: transaction and QC collector identities must never be unwrapped.
function registerRootClient(client) {
    rootClients.add(client);
    return client;
}

// Record identity at construction, including standalone tools and isolated test
// databases. No client capabilities or private Prisma fields determine its role.
function createRootClient(options) {
    const { PrismaClient } = require('../prisma_client');
    return registerRootClient(new PrismaClient(options));
}

// Prisma's public extension API creates another root identity. Register it at
// construction instead of inspecting either client's capabilities or internals.
function extendRootClient(client, extension) {
    if (!isRootClient(client)) throw new TypeError('A registered root client is required for an extension.');
    return registerRootClient(client.$extends(extension));
}

// Transaction clients may also expose $transaction. Keep the exact caller object
// so nested commands continue to share the outer transaction and QC collector.
function isRootClient(client) {
    return rootClients.has(client);
}

module.exports = { createRootClient, extendRootClient, registerRootClient, isRootClient };
