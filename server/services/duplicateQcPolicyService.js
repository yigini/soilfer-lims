const policyService = require('./policyService');

// Use recorded methods, never the catalogue's default methodology.
async function resolveDuplicatePolicy(batch, db = require('../prisma')) {
    const [analysis, members] = await Promise.all([
        db.analysis.findUnique({ where: { code: batch.analysis }, select: { loq: true, validation: true } }),
        db.workItem.findMany({ where: { ...({ batchId: batch.id, analysis: batch.analysis }), duplicateOf: null }, select: { sampleId: true, methodologyId: true } })
    ]);
    const results = members.length ? await db.result.findMany({ where: {
        batchId: batch.id, param: batch.analysis, isCurrent: true, sampleId: { in: members.map(item => item.sampleId) }
    }, select: { sampleId: true, methodologyId: true } }) : [];
    const methods = new Set();
    for (const member of members) {
        const recorded = results.filter(row => row.sampleId === member.sampleId && row.methodologyId);
        if (recorded.length) recorded.forEach(row => methods.add(row.methodologyId));
        else if (member.methodologyId) methods.add(member.methodologyId);
    }
    const methodologyId = methods.size === 1 ? [...methods][0] : null;
    const context = { analysisCode: batch.analysis, methodologyId, db };
    const [nearLoqMultiplier, maxRpd] = await Promise.all([
        policyService.get(batch.labId, 'qc.duplicateNearLoqMultiplier', context),
        policyService.get(batch.labId, 'qc.duplicateMaxRpd', context)
    ]);
    const base = { maxRpd, nearLoqMultiplier, loq: null, loqSource: null, methodologyId: null };
    if (methods.size > 1) return { ...base, noLoqReason: 'METHOD_AMBIGUOUS' };
    const method = methodologyId ? await db.methodology.findUnique({ where: { id: methodologyId }, select: { loq: true } }) : null;
    let validation = {};
    try { validation = analysis?.validation ? JSON.parse(analysis.validation) : {}; } catch (_) { /* No inferred LOQ. */ }
    const candidates = [[method?.loq, 'METHODOLOGY'], [analysis?.loq, 'ANALYSIS'], [validation?.loq, 'ANALYSIS_VALIDATION']];
    const selected = candidates.find(([value]) => value !== null && value !== undefined);
    if (!selected) return { ...base, methodologyId };
    const [loq, loqSource] = selected;
    if (typeof loq !== 'number' || !Number.isFinite(loq) || loq < 0) return { ...base, methodologyId, noLoqReason: 'LOQ_INVALID' };
    return { ...base, loq, loqSource, methodologyId };
}

module.exports = { resolveDuplicatePolicy };
