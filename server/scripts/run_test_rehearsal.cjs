'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { randomUUID } = require('node:crypto');

// #179 pin 5990137651: a closed test-process boundary, never a fixture import.
const rehearsals = new Set([
    'run_manager_dashboard_tasklist_side_by_side.cjs',
    'verify_issue149_3643053_remediations.cjs',
    'verify_issue149_932cb6a_remediations.cjs',
    'verify_issue149_9ac1202_remediations.cjs',
    'verify_issue149_complete_remediations.cjs',
    'verify_issue149_9850d78_remediations.cjs',
    'verify_issue149_ccc08c2_remediations.cjs',
    'verify_issue149_6df8fe6_remediations.cjs',
    'verify_issue149_b5ddd14_remediations.cjs',
    'verify_issue149_working_review.cjs',
    'verify_issue149_remediations.cjs'
]);
function runTestRehearsal(name) {
    const owned = path.resolve(__dirname, '../tests/.tmp');
    const refuse = message => { console.error(`TEST_REHEARSAL_REFUSED: ${message}`); process.exitCode = 1; };
    if (!rehearsals.has(name) || process.argv.length !== 2) return refuse('This rehearsal accepts no arguments or database path.');
    for (const [key, value] of [['DATABASE_PATH', process.env.DATABASE_PATH], ['DATABASE_URL', process.env.DATABASE_URL]]) {
        if (!value) continue;
        if (key === 'DATABASE_URL' && !value.startsWith('file:')) return refuse('Only a test-owned local database URL is allowed.');
        let candidate;
        try { candidate = path.resolve(key === 'DATABASE_URL' ? decodeURIComponent(value.slice(5).split('?')[0]) : value); }
        catch { return refuse('Invalid database path.'); }
        const relative = path.relative(owned, candidate);
        if (!relative || relative.startsWith('..') || path.isAbsolute(relative) || relative.includes(path.sep)) return refuse('A database setting points outside the test-owned directory.');
        if (fs.existsSync(candidate) && fs.realpathSync(candidate).toLowerCase() !== candidate.toLowerCase()) return refuse('Database symlinks are not accepted.');
    }
    fs.mkdirSync(owned, { recursive: true });
    if (fs.realpathSync(owned).toLowerCase() !== owned.toLowerCase()) return refuse('The test-owned directory must be a resolved local directory.');
    const anchor = path.join(owned, `cli-rehearsal-anchor-${randomUUID()}.db`);
    const child = spawnSync(process.execPath, [path.resolve(__dirname, '../tests/rehearsals', name)], {
        stdio: 'inherit', env: { ...process.env, NODE_ENV: 'test', DATABASE_PATH: anchor, DATABASE_URL: `file:${anchor}`,
            DISABLE_BACKGROUND_JOBS: 'true', TEST_REHEARSAL_DIRECTORY: owned }
    });
    if (child.error) return refuse(child.error.message);
    process.exitCode = child.status ?? 1;
}
module.exports = { runTestRehearsal };
