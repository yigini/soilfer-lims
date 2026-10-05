const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { createHash } = require('node:crypto');
const { spawnSync } = require('node:child_process');

const scripts = [
    ['cleanup-data.js', 'SCRIPT_RETIRED_DESTRUCTIVE_CLEANUP'],
    ['migrate_stage_e.js', 'SCRIPT_RETIRED_UNREVIEWED_STATUS_MIGRATION']
];

test.each(scripts)('%s cannot open, create or alter data under any former override', (script, code) => {
    const owned = fs.mkdtempSync(path.join(os.tmpdir(), 'audit179-retired-'));
    const existing = path.join(owned, 'protected.db'), missing = path.join(owned, 'never-created.db');
    // A non-SQLite sentinel proves refusal happens before any database opening.
    fs.writeFileSync(existing, 'protected analytical, QC and audit sentinel');
    const fingerprint = () => ({ sha256: createHash('sha256').update(fs.readFileSync(existing)).digest('hex'),
        mtime: fs.statSync(existing).mtimeMs });
    const before = fingerprint();
    try {
        for (const databasePath of [existing, missing]) for (const args of [[], ['--execute', '--apply', '--force'], ['--dry-run']]) {
            const child = spawnSync(process.execPath, [path.resolve(__dirname, '../../scripts', script), ...args], {
                encoding: 'utf8', env: { ...process.env, DATABASE_PATH: databasePath, DATABASE_URL: `file:${databasePath}`,
                    ALLOW_WORKFLOW_FIXTURES: '1', FORCE: '1' }
            });
            expect(child.error).toBeUndefined();
            expect(child.status).toBe(1);
            expect(child.stderr).toContain(code);
            expect(child.stderr).toContain('scripts/migrate_legacy_statuses.js');
            expect(child.stderr).toContain('reviewed status-migration plan');
            expect(child.stderr).not.toMatch(/SQLITE|Prisma|database file/i);
            expect(fs.existsSync(missing)).toBe(false);
            expect(fingerprint()).toEqual(before);
        }
    } finally { fs.rmSync(owned, { recursive: true, force: true }); }
});
