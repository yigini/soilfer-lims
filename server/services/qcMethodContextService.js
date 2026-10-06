// Shared #177 resolution: recorded methods only, followed by the first supplied LOQ.
async function resolveLoq(analysisCode, methodologyId, db, noLoqReason = null) {
    const base = { loq: null, loqSource: null, methodologyId };
    if (noLoqReason === 'METHOD_AMBIGUOUS') return { ...base, methodologyId: null, noLoqReason };
    const [analysis, method] = await Promise.all([
        db.analysis.findUnique({ where: { code: analysisCode }, select: { loq: true, validation: true } }),
        methodologyId ? db.methodology.findUnique({ where: { id: methodologyId }, select: { loq: true } }) : null
    ]);
    let validation = {};
    try { validation = analysis?.validation ? JSON.parse(analysis.validation) : {}; } catch (_) { /* No inferred LOQ. */ }
    const selected = [[method?.loq, 'METHODOLOGY'], [analysis?.loq, 'ANALYSIS'], [validation?.loq, 'ANALYSIS_VALIDATION']]
        .find(([value]) => value !== null && value !== undefined);
    if (!selected) return base;
    const [loq, loqSource] = selected;
    if (typeof loq !== 'number' || !Number.isFinite(loq) || loq < 0) return { ...base, noLoqReason: 'LOQ_INVALID' };
    return { ...base, loq, loqSource };
}

async function resolveBatchMethodContext(batch, db) {
    const members = await db.workItem.findMany({ where: { batchId: batch.id, analysis: batch.analysis }, select: { sampleId: true, methodologyId: true } });
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
    return { ...await resolveLoq(batch.analysis, methodologyId, db, methods.size > 1 ? 'METHOD_AMBIGUOUS' : null), sampleCount: members.length };
}
module.exports = { resolveLoq, resolveBatchMethodContext };
