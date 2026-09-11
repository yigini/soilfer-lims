'use strict';

const actionPolicyService = require('../services/actionPolicyService');
const projectMembershipService = require('../services/projectMembershipService');
const { ROLES, ALL_ROLES, PERMISSIONS } = require('../config/roles');

/**
 * Access & Governance Controller
 * Exposes server-authoritative role catalogues, capabilities, and discrepancy audits.
 */

/**
 * GET /api/access/assignable-roles?labId=...
 * Returns the exact subset of roles the authenticated actor can assign.
 */
exports.getAssignableRoles = async (req, res) => {
    try {
        const actor = req.user;
        const targetLabId = req.query.labId || actor.labId || null;

        const catalogue = actionPolicyService.getAssignableRolesCatalogue(actor, targetLabId);

        res.json({
            actorRole: actor.role,
            targetLabId,
            assignableRoles: catalogue.assignableRoles,
            unmanageableRoles: catalogue.unmanageableRoles
        });
    } catch (err) {
        console.error('[AccessController] getAssignableRoles error:', err);
        res.status(500).json({ error: 'Failed to resolve assignable roles' });
    }
};

/**
 * GET /api/access/capabilities
 * Returns canonical role capabilities and permission matrix.
 */
exports.getCapabilities = async (req, res) => {
    try {
        const rolesSummary = Object.values(ROLES).map(r => ({
            key: r.key,
            displayName: r.displayName,
            description: r.description
        }));

        res.json({
            roles: rolesSummary,
            permissions: Object.keys(PERMISSIONS)
        });
    } catch (err) {
        console.error('[AccessController] getCapabilities error:', err);
        res.status(500).json({ error: 'Failed to fetch capabilities' });
    }
};

/**
 * GET /api/access/project-membership-report
 * Read-only audit comparing Project.labId, ProjectLab, assignedLabIds, and countries.
 */
exports.getProjectMembershipReport = async (req, res) => {
    try {
        const report = await projectMembershipService.getDiscrepancyReport();
        res.json(report);
    } catch (err) {
        console.error('[AccessController] getProjectMembershipReport error:', err);
        res.status(500).json({ error: 'Failed to generate project membership discrepancy report' });
    }
};
