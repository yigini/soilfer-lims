const { assertFixtureContext } = require('../../services/workflowStateRules');
const { createProfileRun } = require('../../services/qcCompatibilityRunService');

// #252 pin6062398663: explicit preexisting PROFILE_ONLY setup, never a fake
// HTTP response or a production route. Existing QC assertions use real rows.
async function createStoredProfileRunFixture(db, { actor, input } = {}) {
    assertFixtureContext();
    if (process.env.NODE_ENV !== 'test' || !actor || !input ||
        typeof actor !== 'object' || typeof input !== 'object' || Array.isArray(input)) {
        throw new Error('Stored PROFILE_ONLY fixtures require test context and explicit actor/input.');
    }
    return createProfileRun(db, actor, input);
}

module.exports = { createStoredProfileRunFixture };
