const db = require('../prisma');
const custody = require('../services/custodyService');
const retention = require('../services/sampleRetentionService');
const scope = require('../utils/scopeGuard');
const rules = require('../services/workflowStateRules');
const respond = (action, conflictCode = 'STATE_CHANGED', fallbackCode = 'CUSTODY_ERROR') => async (req, res) => {
    try { return res.json(await action(req)); }
    catch (error) { const mapped = rules.mapStateError(error, conflictCode); return res.status(mapped.statusCode || 500).json({ code: mapped.code === 'STATE_CHANGED' ? conflictCode : mapped.code || fallbackCode, error: mapped.message }); }
};
exports.events = respond(req => custody.list(db, req.params.id, req.user));
exports.record = respond(req => custody.record(db, req.params.id, req.user, req.body));
exports.move = respond(req => custody.record(db, req.params.id, req.user, { ...req.body, type: 'MOVED' }), 'SAMPLE_STATE_CHANGED', 'SAMPLE_MOVEMENT_ERROR');
exports.queue = respond(async req => ({ samples: await retention.queue(db, req.user) }));
exports.locations = respond(async req => {
    const sample = await custody.scopedSample(db, req.params.id, req.user);
    return db.inventoryLocation.findMany({ where: scope.buildScopedWhere(req.user,
        { labId: sample.assignedLab, purpose: 'SAMPLE', isActive: true }, { entityType: 'Inventory', altLabField: null }), orderBy: { name: 'asc' } });
});
