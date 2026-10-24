const fs = require('node:fs');
const path = require('node:path');
const { randomUUID } = require('node:crypto');
const { spawnSync } = require('node:child_process');
const { beforeGuards } = require('../helpers/legacyWorkflowDatabase');
const { prepareInitialAdminPassword, reportInitialAdminPassword } = require('../../utils/initialAdminPassword');

describe('R3 initial administrator password handoff', () => {
    const directory = path.resolve(__dirname, '../.tmp', 'password_handoff_' + randomUUID());
    const env = { DATABASE_PATH: path.join(directory, 'owned.db') };
    beforeAll(() => fs.mkdirSync(directory, { recursive: true }));

    test('a supplied password needs no new handoff file and is never logged', () => {
        const supplied = 'public-synthetic-bootstrap-fixture';
        const log = jest.spyOn(console, 'log').mockImplementation(() => {});
        try {
            const result = prepareInitialAdminPassword(supplied, env);
            expect(result.password === supplied).toBe(true);
            expect(result.handoffFile).toBeNull();
            reportInitialAdminPassword(result.handoffFile);
            expect(JSON.stringify(log.mock.calls).includes(supplied)).toBe(false);
            expect(fs.existsSync(path.join(directory, '.initial-admin-credentials'))).toBe(false);
        } finally { log.mockRestore(); }
    });
    test('generated passwords use exclusive owner-only files beside the owned database', () => {
        const result = prepareInitialAdminPassword(null, env);
        expect(result.password.length >= 32).toBe(true);
        expect(path.dirname(result.handoffFile)).toBe(path.join(directory, '.initial-admin-credentials'));
        expect(fs.readFileSync(result.handoffFile, 'utf8') === result.password + '\n').toBe(true);
        if (process.platform !== 'win32') {
            expect(fs.statSync(result.handoffFile).mode & 0o777).toBe(0o600);
            expect(fs.statSync(path.dirname(result.handoffFile)).mode & 0o777).toBe(0o700);
        }
        const second = prepareInitialAdminPassword(null, env);
        expect(second.handoffFile === result.handoffFile).toBe(false);
        expect(fs.readFileSync(result.handoffFile, 'utf8') === result.password + '\n').toBe(true);
        const log = jest.spyOn(console, 'log').mockImplementation(() => {});
        try {
            reportInitialAdminPassword(result.handoffFile);
            expect(JSON.stringify(log.mock.calls).includes(result.password)).toBe(false);
        } finally { log.mockRestore(); }
    });
    test.each(['local', 'global'])('real %s bootstrap stores its usable generated password without logging it', async mode => {
        // Use the exact direct-child path shape admitted by the existing owned
        // schema-fixture guard; that guard is deliberately not relaxed.
        const file = path.resolve(__dirname, '../.tmp', 'test_' + randomUUID() + '.db');
        const handoffDirectory = path.join(path.dirname(file), '.initial-admin-credentials');
        const previous = new Set(fs.existsSync(handoffDirectory) ? fs.readdirSync(handoffDirectory) : []);
        beforeGuards({ actor: 'system:fixture', file });
        const result = spawnSync(process.execPath, ['seed.js'], {
            cwd: path.resolve(__dirname, '../..'), encoding: 'utf8',
            env: { ...process.env, DATABASE_PATH: file, DEPLOYMENT_MODE: mode, ADMIN_INITIAL_PASSWORD: '' }
        });
        expect(result.status).toBe(0);
        const files = fs.readdirSync(handoffDirectory).filter(name => !previous.has(name));
        expect(files).toHaveLength(1);
        const password = fs.readFileSync(path.join(handoffDirectory, files[0]), 'utf8').trim();
        expect((result.stdout + result.stderr).includes(password)).toBe(false);
        const db = new (require('better-sqlite3'))(file, { readonly: true });
        try {
            const row = db.prepare('SELECT password, mustChangePassword FROM User WHERE username = ?').get('admin');
            expect(await require('bcryptjs').compare(password, row.password)).toBe(true);
            expect(row.mustChangePassword).toBe(1);
        } finally { db.close(); }
    });
    (process.platform === 'win32' ? test.skip : test)('refuses a symlink handoff directory without changing the target', () => {
        const other = path.join(directory, 'symlink-case');
        fs.mkdirSync(other);
        const target = path.join(other, 'untouched');
        fs.mkdirSync(target, { mode: 0o700 });
        fs.symlinkSync(target, path.join(other, '.initial-admin-credentials'));
        expect(() => prepareInitialAdminPassword(null, { DATABASE_PATH: path.join(other, 'owned.db') }))
            .toThrow('real owner-only directory');
        expect(fs.readdirSync(target)).toEqual([]);
    });
});
