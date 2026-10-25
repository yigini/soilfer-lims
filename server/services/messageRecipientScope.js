const prisma = require('../prisma');
const scopeGuard = require('../utils/scopeGuard');
const { resolveLab } = require('./policyService');

// The recipient's registered laboratory supplies country authority; a sender's
// request body cannot grant access to another laboratory's inbox.
async function recipientScopeWhere(user) {
    if (scopeGuard.hasGlobalAccess(user)) return {};
    const ownLab = await resolveLab(user.labId, prisma);
    const actor = { ...user, labId: ownLab?.id || user.labId };
    const labs = await prisma.lab.findMany({ select: { id: true, code: true, country: true } });
    const allowed = labs.filter(lab => scopeGuard.canAccessEntity(actor,
        { labId: lab.id, country: lab.country }, { labField: 'labId', altLabField: null }));
    return { labId: { in: [...new Set(allowed.flatMap(lab => [lab.id, lab.code]).filter(Boolean))] } };
}

module.exports = { recipientScopeWhere };
