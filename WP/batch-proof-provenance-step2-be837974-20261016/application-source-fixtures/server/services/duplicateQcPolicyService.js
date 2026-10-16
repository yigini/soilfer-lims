const policyService = require('./policyService');
const { resolveBatchMethodContext } = require('./qcMethodContextService');

// Use recorded methods, never the catalogue's default methodology.
async function resolveDuplicatePolicy(batch, db = require('../prisma')) {
    const methodContext = await resolveBatchMethodContext(batch, db);
    const { methodologyId } = methodContext;
    const context = { analysisCode: batch.analysis, methodologyId, db };
    const [nearLoqMultiplier, maxRpd] = await Promise.all([
        policyService.get(batch.labId, 'qc.duplicateNearLoqMultiplier', context),
        policyService.get(batch.labId, 'qc.duplicateMaxRpd', context)
    ]);
    return { maxRpd, nearLoqMultiplier, ...methodContext };
}

module.exports = { resolveDuplicatePolicy };
