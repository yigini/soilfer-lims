const policyService = require('./policyService');
const { resolveDuplicatePolicy } = require('./duplicateQcPolicyService');
const qcRuleService = require('./qcRuleService');

async function resolveQcPolicy(batch, db, numberFormat) {
    const duplicate = await resolveDuplicatePolicy(batch, db);
    const used = await policyService.snapshot(batch.labId, { db, analysisCode: batch.analysis, methodologyId: duplicate.methodologyId });
    const qcRule = await qcRuleService.resolve(batch.labId, batch.analysis, { db, ...duplicate, policySnapshot: used });
    const values = Object.fromEntries(Object.entries(qcRule.resolved).map(([field, row]) => [field, row.value]));
    return {
        qcRule, qcMode: used.values['qc.mode'], sampleCount: duplicate.sampleCount,
        policyVersion: used.version,
        policyValues: { 'qc.mode': used.values['qc.mode'], 'qc.maxBatchSize': used.values['qc.maxBatchSize'],
            'qc.blankMaxAllowed': used.values['qc.blankMaxAllowed'], 'qc.controlMinRecovery': used.values['qc.controlMinRecovery'],
            'qc.controlMaxRecovery': used.values['qc.controlMaxRecovery'], 'qc.duplicateMaxRpd': duplicate.maxRpd,
            'qc.duplicateNearLoqMultiplier': duplicate.nearLoqMultiplier },
        blank: { maxAllowed: values.blankAbsLimit, mode: values.blankLimitMode, ...duplicate },
        control: { minRecovery: values.crmRecoveryMin, maxRecovery: values.crmRecoveryMax,
            crmMode: values.crmMode, crmAbsWindow: values.crmAbsWindow, lrmMode: values.lrmMode, lrmWindowPct: values.lrmWindowPct },
        duplicate: { ...duplicate, maxRpd: values.duplicateRpdMax, mode: values.duplicateMode,
            absMax: values.duplicateAbsMax, absMaxBelow5LOQ: values.duplicateAbsMaxBelow5LOQ, numberFormat }
    };
}
module.exports = { resolveQcPolicy };
