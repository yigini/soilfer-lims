// Package an allowlisted source snapshot and references. No Git or database mutation.
// This is a one-time capture: do not overwrite a handoff that has already been shipped.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const cp = require('child_process');
const root = path.resolve(__dirname, '../..');
const packageRelative = path.relative(root, __dirname).replaceAll('\\', '/');
const git = (...args) => cp.execFileSync('git', args, { cwd: root, maxBuffer: 32 * 1024 * 1024 });
const split = buffer => buffer.toString('utf8').split('\0').filter(Boolean);
const sha = value => crypto.createHash('sha256').update(value).digest('hex');
const output = path.join(__dirname, 'manifest.json');
if (fs.existsSync(output)) throw new Error('A snapshot already exists. Create a new dated handoff instead of overwriting it.');
const head = git('rev-parse', 'HEAD').toString().trim();
const branch = git('branch', '--show-current').toString().trim();
const modified = split(git('diff', '--name-only', '-z', 'HEAD'));
const untracked = split(git('ls-files', '--others', '--exclude-standard', '-z'));
const tracked = new Set(split(git('ls-files', '-z')));
const changedPaths = [...new Set([...modified, ...untracked])].filter(p => !p.startsWith(packageRelative + '/') && p !== packageRelative + '.zip').sort();
const allowed = /^(?:\.gitignore$|client\/src\/|server\/(?:app\.js$|controllers\/|services\/|routes\/|utils\/|seeds\/|data\/(?:analysisDisplayNames|operationalChecklists|importedParameterNames)\.json$|tests\/contracts\/)|WP\/lab-operations-redesign-v3\/)/;
const forbidden = /(?:^|\/)(?:\.env(?:\.|$)|node_modules\/|prisma_client\/)|\.(?:db|db-wal|db-shm|pem|key|pfx|p12|log)$/i;
const changes = [], artifacts = [];
const record = relative => {
    const data = fs.readFileSync(path.join(__dirname, relative));
    artifacts.push({ path: relative.replaceAll('\\', '/'), bytes: data.length, sha256: sha(data) });
};
const copy = (sourceRelative, targetRelative) => {
    const from = path.resolve(root, sourceRelative), to = path.resolve(__dirname, targetRelative);
    if (!from.startsWith(root + path.sep) || !to.startsWith(__dirname + path.sep)) throw new Error('Path outside capture boundary');
    const data = fs.readFileSync(from);
    fs.mkdirSync(path.dirname(to), { recursive: true });
    fs.writeFileSync(to, data, { flag: 'wx' });
    record(targetRelative);
    return data;
};
for (const relative of changedPaths) {
    if (!allowed.test(relative) || forbidden.test(relative)) throw new Error('Unreviewed changed path: ' + relative);
    if (!fs.existsSync(path.join(root, relative))) throw new Error('Deletion needs explicit recovery handling: ' + relative);
    const data = copy(relative, 'source-snapshot/' + relative);
    const base = tracked.has(relative) ? git('show', `HEAD:${relative}`) : null;
    changes.push({ path: relative, state: base === null ? 'new' : 'modified', bytes: data.length, sha256: sha(data), baselineSha256: base === null ? null : sha(base), snapshot: 'source-snapshot/' + relative });
}
function includeTree(relative) {
    for (const entry of fs.readdirSync(path.join(root, relative), { withFileTypes: true })) {
        const child = relative + '/' + entry.name;
        if (entry.isSymbolicLink()) throw new Error('Do not package symbolic links: ' + child);
        if (entry.isDirectory()) includeTree(child);
        else if (!forbidden.test(child)) copy(child, 'reference-materials/' + child);
    }
}
includeTree('WP/lab-operations-redesign-v3');
includeTree('WP/sample-workspace-redesign-v2');
for (const file of ['technician-workbench-implementation-plan.md', 'technician-workbench-concept.html', 'workflow-map-implementation-plan.md', 'lims-workflow-redesign.html', 'spectral-intake-concept.html', 'reception-plan-v2.md', 'Catalogue Extension.pdf', 'Soil Lab Readiness Check.pdf', 'SoilFER ProDOC Alignment.pdf', 'SoilFER-LIMS Analytical Audit.pdf']) copy('WP/' + file, 'reference-materials/WP/' + file);
fs.writeFileSync(path.join(__dirname, 'tracked-changes.patch'), git('diff', '--binary', '--full-index', 'HEAD'), { flag: 'wx' });
record('tracked-changes.patch');
for (const file of ['START-HERE.md', 'RELEASE-CHECKLIST.md', 'ANTIGRAVITY-MESSAGE.md', 'verify-handoff.cjs', 'capture-handoff.cjs']) record(file);
for (const change of changes) if (sha(fs.readFileSync(path.join(root, change.path))) !== change.sha256) throw new Error('Source changed during capture: ' + change.path);
if (git('rev-parse', 'HEAD').toString().trim() !== head) throw new Error('Git HEAD changed during capture');
const manifest = { formatVersion: 1, capturedAt: new Date().toISOString(), project: root, baselineHead: head, baselineBranch: branch, originalAuditHead: 'bee0b6e', scope: 'uncommitted source changes, tests, evidence and prior plans; not a full repository or production backup', exclusions: ['credentials', 'environment files', 'Git internals', 'databases', 'uploads/spectra', 'dependencies', 'build output'], counts: { changedFiles: changes.length, newFiles: changes.filter(c => c.state === 'new').length, modifiedFiles: changes.filter(c => c.state === 'modified').length, packageArtifacts: artifacts.length }, changes, artifacts };
fs.writeFileSync(output, JSON.stringify(manifest, null, 2), { flag: 'wx' });
console.log(JSON.stringify({ baselineHead: head, ...manifest.counts }, null, 2));
