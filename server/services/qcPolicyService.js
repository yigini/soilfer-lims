const policyService = require('./policyService');
const { resolveDuplicatePolicy } = require('./duplicateQcPolicyService');

async function resolveQcPolicy(batch, db, numberFormat) {
    const duplicate = await resolveDuplicatePolicy(batch, db);
    const used = await policyService.snapshot(batch.labId, { db, analysisCode: batch.analysis, methodologyId: duplicate.methodologyId });
    return {
        policyVersion: used.version,
        policyValues: { 'qc.mode': used.values['qc.mode'], 'qc.maxBatchSize': used.values['qc.maxBatchSize'],
            'qc.blankMaxAllowed': used.values['qc.blankMaxAllowed'], 'qc.controlMinRecovery': used.values['qc.controlMinRecovery'],
            'qc.controlMaxRecovery': used.values['qc.controlMaxRecovery'], 'qc.duplicateMaxRpd': duplicate.maxRpd,
            'qc.duplicateNearLoqMultiplier': duplicate.nearLoqMultiplier },
        blank: { maxAllowed: used.values['qc.blankMaxAllowed'] },
        control: { minRecovery: used.values['qc.controlMinRecovery'], maxRecovery: used.values['qc.controlMaxRecovery'] },
        duplicate: { ...duplicate, numberFormat }
    };
}
module.exports = { resolveQcPolicy };
