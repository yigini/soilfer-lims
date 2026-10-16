#!/usr/bin/env node
const fs = require('node:fs'), path = require('node:path'), os = require('node:os'), cp = require('node:child_process');
const { createHash } = require('node:crypto');
function fileHash(file) {
    const hash = createHash('sha256'), buffer = Buffer.allocUnsafe(1024 * 1024), fd = fs.openSync(file, 'r');
    try { let size; while ((size = fs.readSync(fd, buffer, 0, buffer.length, null))) hash.update(buffer.subarray(0, size)); }
    finally { fs.closeSync(fd); }
    return hash.digest('hex');
}
const triple = file => Object.fromEntries(['','-wal','-shm'].map(suffix => [suffix, fs.existsSync(file + suffix) ? fileHash(file + suffix) : null]));
function allocation(root) {
    const files = [];
    function visit(directory) {
        for (const entry of fs.readdirSync(directory, { withFileTypes: true }).sort((a,b) => a.name.localeCompare(b.name))) {
            const file = path.join(directory, entry.name), stat = fs.lstatSync(file);
            if (stat.isSymbolicLink()) throw Error('Retained snapshot accounting refuses aliases.');
            if (stat.isDirectory()) visit(file);
            else if (stat.isFile()) files.push({ path: file, bytes: stat.size, sha256: fileHash(file),
                allocatedBytes: Number.isSafeInteger(stat.blocks) ? stat.blocks * 512 : null,
                conservativeAllocationBytes: Math.max(stat.size, Math.ceil(stat.size / 4096) * 4096,
                    Number.isSafeInteger(stat.blocks) ? stat.blocks * 512 : 0) });
            else throw Error('Unexpected retained snapshot file type.');
        }
    }
    visit(root);
    return { root, files, logicalBytes: files.reduce((sum,row) => sum + row.bytes, 0),
        allocationMeasured: files.every(row => row.allocatedBytes !== null),
        conservativeAllocationBytes: files.reduce((sum,row) => sum + row.conservativeAllocationBytes, 0) };
}

// One isolated read-only child owns all policy-owner snapshots, including the
// secondary prerequisite's copies. Nothing connects SQLite to the original.
function collectOrderRevisionImpact({ dbPath } = {}) {
    if (typeof dbPath !== 'string' || !dbPath.trim() || !fs.existsSync(dbPath)) throw Error('Provide an existing explicit --db path.');
    const target = path.resolve(dbPath), before = triple(target);
    const retentionRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'lims-order-impact-'));
    const stdoutFile = path.join(retentionRoot, 'stdout-original.json'), stderrFile = path.join(retentionRoot, 'stderr-original.log');
    const stdout = fs.openSync(stdoutFile, 'wx'), stderr = fs.openSync(stderrFile, 'wx');
    let child;
    try { child = cp.spawnSync(process.execPath, [path.join(__dirname, 'install_order_revisions.js'), '--db', target, '--dry-run'],
        { env: { ...process.env, TEMP: retentionRoot, TMP: retentionRoot, TMPDIR: retentionRoot }, stdio: ['ignore',stdout,stderr] }); }
    finally { fs.closeSync(stdout); fs.closeSync(stderr); }
    const after = triple(target), originalFilesPreserved = JSON.stringify(before) === JSON.stringify(after);
    fs.writeFileSync(path.join(retentionRoot, 'exit-original.json'), JSON.stringify({ status: child.status, signal: child.signal,
        error: child.error?.message || null, before, after, originalFilesPreserved }, null, 2) + '\n', { flag: 'wx' });
    if (!originalFilesPreserved || child.error || child.status !== 0 || fs.statSync(stdoutFile).size > 64 * 1024 * 1024) {
        throw Object.assign(Error('Read-only impact collection refused; retain its complete original output.'),
            { code: 'ORDER_REVISION_IMPACT_REFUSED', retentionRoot, originalFilesPreserved });
    }
    const result = JSON.parse(fs.readFileSync(stdoutFile, 'utf8'));
    if (result.mode !== 'DRY_RUN' || result.totalChanges !== 0 || result.backfilledCount !== 0 || !result.readonlySnapshot?.originalFilesPreserved)
        throw Object.assign(Error('Read-only owner proof differs.'), { code: 'ORDER_REVISION_IMPACT_REFUSED', retentionRoot });
    return { ...result, access: 'RETAINED_SNAPSHOT_ONLY', originalDbWalShmSha256: before, originalFilesPreserved,
        productionMutations: 0, retainedAllocation: allocation(retentionRoot) };
}
if (require.main === module) {
    try {
        if (process.argv.length !== 4 || process.argv[2] !== '--db') throw Error('Use --db with an explicit existing file.');
        process.stdout.write(JSON.stringify(collectOrderRevisionImpact({ dbPath: process.argv[3] }), null, 2) + '\n');
    } catch (error) {
        process.stderr.write(JSON.stringify({ code: error.code || 'ORDER_REVISION_IMPACT_REFUSED', message: error.message,
            retentionRoot: error.retentionRoot || null, totalChanges: 0 }) + '\n'); process.exitCode = 1;
    }
}
module.exports = { collectOrderRevisionImpact };
