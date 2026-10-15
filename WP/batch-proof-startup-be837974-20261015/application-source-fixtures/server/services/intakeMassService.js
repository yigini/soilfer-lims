const policyService = require('./policyService');

async function massRequirement(labId, analyses, retentionMass, db) {
    const breakdown = await Promise.all(analyses.map(async analysis => ({
        code: analysis.code,
        name: analysis.name,
        massRequired: analysis.sampleMassRequired || await policyService.get(labId, 'intake.defaultAnalysisMassG', { analysisCode: analysis.code, ...(db ? { db } : {}) })
    })));
    const totalAnalyticalMass = breakdown.reduce((sum, item) => sum + item.massRequired, 0);
    const retention = typeof retentionMass === 'number' ? retentionMass : await policyService.get(labId, 'intake.retentionMassG', db ? { db } : {});
    return { totalAnalyticalMass, totalRequiredMass: totalAnalyticalMass + retention, retentionMass: retention, breakdown };
}

function massDeficit(receivedMass, requirement) {
    if (receivedMass === null || !Number.isFinite(receivedMass) || receivedMass >= requirement.totalRequiredMass) return null;
    return { receivedMass, totalRequiredMass: requirement.totalRequiredMass, totalAnalyticalMass: requirement.totalAnalyticalMass,
        retentionBuffer: requirement.retentionMass, deficit: Math.round((requirement.totalRequiredMass - receivedMass) * 10) / 10,
        analysesAtRisk: requirement.breakdown };
}

module.exports = { massRequirement, massDeficit };
