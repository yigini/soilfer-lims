const prisma = require('../prisma');

function isAvailable(method, analysisCode, labId) {
    return !!method && method.analysisCode === analysisCode && (!method.labId || method.labId === labId);
}

async function resolveDefaultSelections(codes, labId, db = prisma) {
    const [methods, overrides] = await Promise.all([
        db.methodology.findMany({ where: { analysisCode: { in: codes }, OR: labId ? [{ labId }, { labId: null }] : [{ labId: null }] } }),
        labId ? db.labMethodDefault.findMany({ where: { labId, analysisCode: { in: codes } } }) : []
    ]);
    return new Map(codes.map(code => {
        const candidates = methods.filter(m => m.analysisCode === code);
        const override = overrides.find(o => o.analysisCode === code);
        if (override) {
            const method = candidates.find(m => m.id === override.methodologyId);
            return [code, isAvailable(method, code, labId) ? { method, error: null } : { method: null, error: 'Invalid laboratory method default. Choose a method belonging to this parameter and laboratory.' }];
        }
        const local = candidates.filter(m => m.isDefault && labId && m.labId === labId);
        const eligible = local.length ? local : candidates.filter(m => m.isDefault && !m.labId);
        return [code, eligible.length > 1 ? { method: null, error: 'Multiple default methods are configured. Choose one laboratory method before ordering.' } : { method: eligible[0] || null, error: null }];
    }));
}

async function resolveDefaultMethod(analysisCode, labId, db = prisma) {
    const selection = (await resolveDefaultSelections([analysisCode], labId, db)).get(analysisCode);
    if (selection.error) throw new Error(selection.error);
    return selection.method;
}

async function methodologyUsage(id, db = prisma) {
    const [workItems, results, orderLines, labDefaults, equipment] = await Promise.all([
        db.workItem.count({ where: { methodologyId: id } }), db.result.count({ where: { methodologyId: id } }),
        db.orderLine.count({ where: { methodologyId: id } }), db.labMethodDefault.count({ where: { methodologyId: id } }),
        db.equipmentMethodEligibility.count({ where: { methodId: id } })
    ]);
    return { workItems, results, orderLines, labDefaults, equipment };
}

module.exports = { isAvailable, resolveDefaultSelections, resolveDefaultMethod, methodologyUsage };
