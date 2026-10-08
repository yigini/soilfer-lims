const { assertFixtureContext } = require('../../services/workflowStateRules');
const { createProfileRun } = require('../../services/qcCompatibilityRunService');
const fs = require('node:fs'), path = require('node:path');

// #252 pin6062398663: explicit preexisting PROFILE_ONLY setup, never a fake
// HTTP response or a production route. Existing QC assertions use real rows.
async function createStoredProfileRunFixture(db, { actor, input } = {}) {
    assertFixtureContext();
    if (process.env.NODE_ENV !== 'test' || !actor || !input ||
        typeof actor !== 'object' || typeof input !== 'object' || Array.isArray(input)) {
        throw new Error('Stored PROFILE_ONLY fixtures require test context and explicit actor/input.');
    }
    const databases = await db.$queryRawUnsafe('PRAGMA database_list');
    const file = databases.find(row => row.name === 'main')?.file;
    const root = path.resolve(__dirname, '../..');
    const resolved = file && fs.existsSync(file) && fs.realpathSync(file);
    const relative = resolved && path.relative(root, resolved).replace(/\\/g, '/');
    const production = process.env.PRODUCTION_DATABASE_PATH;
    const protectedPaths = [path.resolve(root, 'prisma/dev.db'), production].filter(Boolean)
        .map(candidate => (fs.existsSync(candidate) ? fs.realpathSync(candidate) : path.resolve(candidate)).toLowerCase());
    if (!relative || !(/^tests\/\.tmp\/[^/]+\.db$/.test(relative) || /^\.tmp_journey_runner_[^/]+\/[^/]+\.db$/.test(relative)) ||
        protectedPaths.includes(resolved.toLowerCase())) {
        throw new Error('Stored PROFILE_ONLY fixtures require a test-owned database file.');
    }
    return createProfileRun(db, actor, input);
}

module.exports = { createStoredProfileRunFixture };
