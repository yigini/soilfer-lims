const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

let fixture;
beforeAll(() => {
    fixture = fs.mkdtempSync(path.join(os.tmpdir(), 'lims-tree-check-'));
    fs.mkdirSync(path.join(fixture, 'server/scripts'), { recursive: true });
    fs.copyFileSync(path.resolve(__dirname, '../../scripts/check_tree.cjs'),
        path.join(fixture, 'server/scripts/check_tree.cjs'));
    const git = args => {
        const result = spawnSync('git', args, { cwd: fixture, encoding: 'utf8' });
        if (result.status !== 0) throw Error('Cannot prepare isolated repository fixture.');
    };
    git(['init', '--quiet']);
    fs.writeFileSync(path.join(fixture, 'sample.txt'), 'neutral example\n');
    git(['add', '--', 'sample.txt', 'server/scripts/check_tree.cjs']);
});

afterAll(() => {
    if (!fixture || path.dirname(fixture) !== fs.realpathSync(os.tmpdir()) ||
        !path.basename(fixture).startsWith('lims-tree-check-')) {
        throw Error('Refusing cleanup outside the isolated repository fixture.');
    }
    fs.rmSync(fixture, { recursive: true, force: true });
});

function check(value, env = process.env) {
    fs.writeFileSync(path.join(fixture, 'sample.txt'), value);
    return spawnSync(process.execPath, ['server/scripts/check_tree.cjs'], {
        cwd: fixture, encoding: 'utf8', env
    });
}

test('neutral tracked text passes', () => {
    expect(check('A neutral installation example.').status).toBe(0);
});

const accountPath = separator => ['C:', 'Users', 'yi' + 'gin', 'example'].join(separator);
const cases = [
    ['address', ['46', '19', '33', '37'].join('.')],
    ['domain', ['lims', 'yigini', 'net'].join('.')],
    ['machine name', ['soillab', 'server'].join('-')],
    ['single backslashes', accountPath('\\')],
    ['doubled backslashes', accountPath('\\\\')],
    ['repeated backslashes', accountPath('\\\\\\\\')],
    ['forward slashes', accountPath('/')],
    ['mixed separators', ['C:', 'Users', 'yi' + 'gin', 'example'].join('\\/')],
    ['first example key', ['soilfer', 'secret', 'key'].join('-')],
    ['second example key', ['super', 'secret', 'production', 'key'].join('-')],
    ['encoded access-value shape', ['eyJ' + 'a'.repeat(16), 'b'.repeat(16), 'c'.repeat(16)].join('.')]
];

test.each(cases)('rejects %s without echoing the matched value', (_name, value) => {
    const result = check(value);
    expect(result.status).toBe(1);
    expect(result.stderr).toContain('Repository text check failed');
    expect(result.stdout + result.stderr).not.toContain(value);
});

test('an unavailable Git command refuses the check', () => {
    const env = { ...process.env };
    for (const name of Object.keys(env)) if (name.toLowerCase() === 'path') delete env[name];
    env.PATH = '';
    const result = check('neutral example', env);
    expect(result.status).toBe(1);
    expect(result.stderr).toContain('Repository text check could not run');
});
