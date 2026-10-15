const prisma = require('../prisma');
const policyService = require('../services/policyService');
const { registry, PRESETS } = require('../config/policyRegistry');
const { hasPermission } = require('../config/roles');

function fail(res, e) { return res.status(e.statusCode || 500).json({ code: e.code || 'POLICY_ERROR', error: e.message }); }
exports.getPolicies = async (req, res) => {
    try {
        const data = await prisma.$transaction(async tx => {
            const lab = await policyService.resolveLab(req.params.id, tx);
            await policyService.assertScope(req.user, lab, false, tx);
            const context = { db: tx, analysisCode: req.query.analysisCode || null, methodologyId: req.query.methodologyId || null };
            const effective = await policyService.snapshot(lab.id, context);
            const [overrides, history, analyses, methodologies] = await Promise.all([
                tx.labPolicyOverride.findMany({ where: { labId: lab.id }, orderBy: { setAt: 'desc' } }),
                tx.auditLog.findMany({ where: { labId: lab.id, entity: 'LAB', details: { contains: 'LAB_POLICY_CHANGE' } }, orderBy: { timestamp: 'desc' } }),
                tx.analysis.findMany({ select: { code: true, name: true }, orderBy: { code: 'asc' } }),
                tx.methodology.findMany({ select: { id: true, name: true, analysisCode: true }, orderBy: { name: 'asc' } })
            ]);
            return { ...effective, lab: { id: lab.id, name: lab.name, code: lab.code }, registry, presets: PRESETS,
                overrides: overrides.map(row => ({ ...row, value: JSON.parse(row.value) })), history, analyses, methodologies,
                canEdit: hasPermission(req.user, 'MANAGE_LAB_POLICIES') };
        });
        return res.json(data);
    } catch (e) { return fail(res, e); }
};
exports.updatePolicies = async (req, res) => {
    if (!req.body || typeof req.body !== 'object' || Array.isArray(req.body) || Object.keys(req.body).some(k =>
        !['presetCode', 'changes', 'reason', 'expectedVersion'].includes(k))) {
        return res.status(400).json({ code: 'POLICY_VALUE_INVALID', error: 'Invalid policy payload.' });
    }
    try { return res.json(await policyService.change(req.user, req.params.id, req.body)); }
    catch (e) { return fail(res, e); }
};
