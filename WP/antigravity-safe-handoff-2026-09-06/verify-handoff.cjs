// Read-only comparison. Never applies patches, overwrites source, accesses a DB or deploys.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const manifest = JSON.parse(fs.readFileSync(path.join(__dirname, 'manifest.json'), 'utf8'));
const args = process.argv.slice(2);
if (args.length && (args[0] !== '--workspace' || args.length !== 2)) throw new Error('Usage: node verify-handoff.cjs [--workspace PROJECT_PATH]');
const target = path.resolve(args.length ? args[1] : __dirname);
const failures = [];
function check(relative, expected) {
    const file = path.resolve(target, relative);
    if (!file.startsWith(target + path.sep)) throw new Error('Unsafe manifest path');
    if (!fs.existsSync(file)) { failures.push({ path: relative, reason: 'MISSING' }); return; }
    const actual = crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
    if (actual !== expected) failures.push({ path: relative, reason: 'DIFFERENT' });
}
if (args.length) {
    for (const entry of manifest.changes) check(entry.path, entry.sha256);
} else {
    for (const entry of manifest.artifacts) check(entry.path, entry.sha256);
}
console.log(JSON.stringify({ mode: args.length ? 'working-tree comparison (listed files only)' : 'package-integrity check', checked: args.length ? manifest.changes.length : manifest.artifacts.length, differences: failures, message: failures.length ? 'Inspect and reconcile differences; do not overwrite automatically.' : 'All listed file hashes match.' }, null, 2));
process.exitCode = failures.length ? 1 : 0;
