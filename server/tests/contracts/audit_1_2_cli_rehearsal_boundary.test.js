const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { createHash } = require('node:crypto');
const { spawnSync } = require('node:child_process');

test('the manager rehearsal CLI refuses external databases and path arguments before launching a child', () => {
    const owned = fs.mkdtempSync(path.join(os.tmpdir(), 'audit179-cli-refusal-'));
    const protectedFile = path.join(owned, 'protected.db');
    fs.writeFileSync(protectedFile, 'untouched analytical, QC and audit data');
    const fingerprint = () => ({ hash: createHash('sha256').update(fs.readFileSync(protectedFile)).digest('hex'), mtime: fs.statSync(protectedFile).mtimeMs });
    const before = fingerprint();
    try {
        for (const [args, settings] of [
            [[], { DATABASE_URL: `file:${protectedFile}` }], [[], { DATABASE_PATH: protectedFile }],
            [[], { DATABASE_URL: 'postgresql://outside-test-ownership' }], [['--database', protectedFile], {}], [['--force'], {}]
        ]) {
            const env = { ...process.env, NODE_ENV: 'test', ALLOW_WORKFLOW_FIXTURES: '1' };
            delete env.DATABASE_PATH; delete env.DATABASE_URL;
            const child = spawnSync(process.execPath, [path.resolve(__dirname, '../../scripts/run_manager_dashboard_tasklist_side_by_side.cjs'), ...args], {
                encoding: 'utf8', env: { ...env, ...settings }, timeout: 5000
            });
            expect(child.error).toBeUndefined();
            expect(child.status).toBe(1);
            expect(child.stderr).toContain('TEST_REHEARSAL_REFUSED');
            expect(child.stdout).toBe('');
            expect(fingerprint()).toEqual(before);
            expect(fs.readdirSync(owned)).toEqual(['protected.db']);
        }
    } finally { fs.rmSync(owned, { recursive: true, force: true }); }
});
