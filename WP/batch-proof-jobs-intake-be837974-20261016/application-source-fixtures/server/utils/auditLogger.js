const { auditDb } = require('../db');

/**
 * Logs an action to the audit trail.
 * @param {string} action - The action performed (e.g., 'CREATE', 'UPDATE', 'DELETE').
 * @param {string} entity - The entity type (e.g., 'ANALYSIS', 'GROUP', 'METHODOLOGY').
 * @param {string|number} entityId - The ID of the entity.
 * @param {object} changes - Object describing the changes (e.g., { diff: ... } or the object itself).
 * @param {object} user - The user object performing the action (req.user).
 */
const logAudit = (action, entity, entityId, changes, user) => {
    const entry = {
        action,
        entity,
        entityId,
        changes,
        performedBy: user ? user.username : 'SYSTEM',
        performedById: user ? user.id : null,
        timestamp: new Date().toISOString()
    };
    auditDb.create(entry);
};

module.exports = logAudit;
