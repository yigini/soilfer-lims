const fs = require('node:fs');
const path = require('node:path');

const ownedDirectory = path.resolve(__dirname, '../.tmp');
function canonical(file) {
    const absolute = path.resolve(file);
    return (fs.existsSync(absolute) ? fs.realpathSync(absolute) :
        path.join(fs.realpathSync(path.dirname(absolute)), path.basename(absolute))).toLowerCase();
}

function assertOwnedTestDatabase(file, actor) {
    if (actor !== 'system:fixture' || process.env.NODE_ENV !== 'test' || typeof file !== 'string') {
        throw new Error('Workflow guard probes require system:fixture and NODE_ENV=test.');
    }
    require('../../services/workflowStateRules').assertFixtureContext();
    const absolute = path.resolve(file);
    const parent = path.dirname(absolute);
    if (!fs.existsSync(ownedDirectory) || !fs.existsSync(parent) ||
        canonical(parent) !== canonical(ownedDirectory) || canonical(absolute) !== absolute.toLowerCase()) {
        throw new Error('Workflow guard probes require a resolved test-owned temporary file.');
    }
    const configuredUrl = process.env.DATABASE_URL;
    if (configuredUrl && !configuredUrl.startsWith('file:')) throw new Error('Workflow guard probes require a local test database.');
    const protectedPaths = [path.resolve(__dirname, '../../prisma/dev.db'), process.env.DATABASE_PATH,
        process.env.PRODUCTION_DATABASE_PATH, configuredUrl && decodeURIComponent(configuredUrl.slice(5).split('?')[0])].filter(Boolean);
    if (protectedPaths.some(protectedFile => canonical(protectedFile) === canonical(absolute))) {
        throw new Error('Workflow guard probes cannot open the configured, working or production database.');
    }
    return absolute;
}

module.exports = { assertOwnedTestDatabase };
