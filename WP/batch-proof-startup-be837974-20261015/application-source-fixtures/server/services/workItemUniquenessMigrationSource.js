const fs = require('node:fs');
const path = require('node:path');
const { createHash } = require('node:crypto');

// #190 pins6061135570/6061301340: the unchanged #178 release sources.
function readSource(directory, sha256) {
    const root = path.resolve(__dirname, '..', fs.existsSync('/.dockerenv')
        ? '.migrations-backup/178' : 'prisma/migrations', directory);
    let bytes;
    try { bytes = fs.readFileSync(path.join(root, 'migration.sql')); }
    catch (cause) {
        throw Object.assign(new Error('Duplicate-marker prerequisite DDL is unavailable.', { cause }),
            { code: 'WORKITEM_PREREQUISITE_SOURCE_MISMATCH' });
    }
    if (createHash('sha256').update(bytes).digest('hex') !== sha256) {
        throw Object.assign(new Error('Duplicate-marker prerequisite source digest differs.'),
            { code: 'WORKITEM_PREREQUISITE_SOURCE_MISMATCH' });
    }
    return Object.freeze({ sql: bytes.toString('utf8'), sha256 });
}

function loadWorkItemDuplicateMarkerSource() {
    return readSource('20261004190000_add_workitem_duplicate_marker',
        '80278c2d318bc47fa92746015ec278a204a7ff08a9e36d24faca0a56ef05fa1e');
}

function loadActiveWorkItemIndexSource() {
    return readSource('20261004190100_unique_active_workitem',
        'a6e1cf6a26319954e35f4008bc4d18e904014f086db0e31d88e42948fac6556e');
}

module.exports = { loadWorkItemDuplicateMarkerSource, loadActiveWorkItemIndexSource };
