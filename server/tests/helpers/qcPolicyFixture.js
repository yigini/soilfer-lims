const jwt = require('jsonwebtoken');
const policyService = require('../../services/policyService');

// Opt in only in retained fixtures whose contract concerns review or reports
// without a QC run. The default AUTO requirement stays active in every other
// fixture, and evaluated QC remains gated even under this explicit waiver.
async function setFixtureQcRequirement(db, actorOrToken, labId, value = 'NOT_REQUIRED') {
    require('../../services/workflowStateRules').assertFixtureContext();
    const actor = typeof actorOrToken === 'string' ? jwt.decode(actorOrToken) : actorOrToken;
    return policyService.change(actor, labId, {
        reason: 'Explicit QC requirement for this isolated retained contract fixture',
        changes: [{ key: 'qc.requireBatchQc', value }]
    }, { db });
}

module.exports = { setFixtureQcRequirement };
