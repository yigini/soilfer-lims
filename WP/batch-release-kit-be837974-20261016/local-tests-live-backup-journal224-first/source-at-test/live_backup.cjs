/* Empty-destination main and journal allowances precede exclusive creation.
 * Exact dependency/source proof is required; global filesystem closure is separate.
 */
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { createRequire } = require('node:module');
const proof = require('./live-backup-sqlite-source.json');
const MAXIMUM = 32 * 1024 ** 3;
const JOURNAL_MAXIMUM = 2 * 65536;
function requireValue(condition, message) { if (!condition) throw new Error(message); }
function validateAdmission(value) {
  requireValue(value && Object.keys(value).sort().join(',') ===
    'filesystemClosureClaimed,maximumJournalBytes,maximumMainBytes,version' && value.version === 2 &&
    value.filesystemClosureClaimed === false && value.maximumJournalBytes === JOURNAL_MAXIMUM &&
    Number.isSafeInteger(value.maximumMainBytes) && value.maximumMainBytes >= 512 &&
    value.maximumMainBytes <= MAXIMUM - JOURNAL_MAXIMUM,
  'Exact held live-backup main and journal admission required');
  return value;
}
function readBounded(filename, maximum, exact) {
  const fd = fs.openSync(filename, fs.constants.O_RDONLY | (fs.constants.O_NOFOLLOW || 0));
  try {
    const before = fs.fstatSync(fd, { bigint: true });
    requireValue(before.isFile() && before.size > 0n && before.size <= BigInt(maximum) &&
      (exact === undefined || before.size === BigInt(exact)), 'Bounded exact input file required');
    const raw = Buffer.alloc(Number(before.size) + 1);
    const count = fs.readSync(fd, raw, 0, raw.length, 0);
    const after = fs.fstatSync(fd, { bigint: true }), named = fs.lstatSync(filename, { bigint: true });
    requireValue(count === Number(before.size) && same(before, after) && same(after, named), 'Admission changed');
    return raw.subarray(0, count);
  } finally { fs.closeSync(fd); }
}
function readAdmission(filename) {
  const raw = readBounded(filename, 8192);
  const value = validateAdmission(JSON.parse(raw.toString('utf8')));
  const canonical = JSON.stringify({ filesystemClosureClaimed: false,
    maximumJournalBytes: JOURNAL_MAXIMUM, maximumMainBytes: value.maximumMainBytes, version: 2 }) + '\n';
  requireValue(raw.equals(Buffer.from(canonical)), 'Canonical admission required');
  return value;
}
function verifyDependency(appRequire) {
  const root = path.dirname(appRequire.resolve('better-sqlite3/package.json'));
  const files = ['binding.gyp', 'deps/common.gypi', 'deps/copy.js', 'deps/defines.gypi',
    'deps/sqlite3.gyp', 'deps/sqlite3/sqlite3.c', 'lib/methods/backup.js', 'package.json', 'src/objects/backup.cpp'];
  requireValue(proof.maximumJournalBytes === JOURNAL_MAXIMUM && proof.packageVersion === '12.6.2' &&
    Object.keys(proof.files).sort().join(',') === files.sort().join(','),
    'Exact reviewed backup dependency proof required');
  for (const [name, row] of Object.entries(proof.files)) {
    const filename = path.join(root, name);
    for (let current = filename; ; current = path.dirname(current)) {
      requireValue(!fs.lstatSync(current).isSymbolicLink(), 'Backup dependency ancestor alias refused');
      if (current === path.dirname(current)) break;
    }
    const raw = readBounded(filename, 10 * 1024 ** 2, row.bytes);
    requireValue(crypto.createHash('sha256').update(raw).digest('hex') === row.sha256,
      'Backup dependency source changed');
  }
}
function same(a, b) {
  return ['dev', 'ino', 'size', 'mtimeNs', 'ctimeNs', 'mode', 'nlink'].every(key => a[key] === b[key]);
}
function unusedDestination(destination) {
  requireValue(path.isAbsolute(destination), 'Absolute owned output required');
  for (let current = destination; ; current = path.dirname(current)) {
    if (fs.existsSync(current)) requireValue(!fs.lstatSync(current).isSymbolicLink(), 'Output ancestor alias refused');
    if (current === path.dirname(current)) break;
  }
  for (const filename of [destination, ...['-journal', '-wal', '-shm'].map(suffix => destination + suffix)]) {
    try { fs.lstatSync(filename); throw new Error('Owned output already consumed'); }
    catch (error) { if (error.code !== 'ENOENT') throw error; }
  }
}
function noSidecars(destination) {
  for (const suffix of ['-journal', '-wal', '-shm']) {
    try { fs.lstatSync(destination + suffix); throw new Error('Successful backup left an internal sidecar'); }
    catch (error) { if (error.code !== 'ENOENT') throw error; }
  }
}
async function backup(source, destination, Database, admission) {
  const limit = validateAdmission(admission);
  unusedDestination(destination);
  const began = process.hrtime.bigint();
  const db = new Database(source, { readonly: true, fileMustExist: true });
  let expected;
  try {
    db.pragma('query_only = ON');
    requireValue(db.pragma('query_only', { simple: true }) === 1, 'Read-only query guard refused');
    const engine = db.prepare('SELECT sqlite_version() AS version, sqlite_source_id() AS sourceId').get();
    requireValue(engine.version === proof.sqliteVersion && engine.sourceId === proof.sqliteSourceId,
      'Backup native SQLite source differs from reviewed journal proof');
    db.exec('BEGIN');
    // BEGIN is deferred. Read the schema to establish the snapshot before sizing.
    db.prepare('SELECT count(*) AS count FROM sqlite_schema').get();
    const pages = db.pragma('page_count', { simple: true });
    const pageSize = db.pragma('page_size', { simple: true });
    requireValue(Number.isSafeInteger(pages) && pages > 0 && Number.isSafeInteger(pageSize) &&
      pageSize >= 512 && pageSize <= 65536 && (pageSize & (pageSize - 1)) === 0,
    'Pinned SQLite page layout required');
    expected = pages * pageSize;
    requireValue(Number.isSafeInteger(expected) && expected <= limit.maximumMainBytes,
      'Pinned output exceeds held content admission');
    // Precreate so better-sqlite3 never deletes a failed newly created backup.
    const fd = fs.openSync(destination, fs.constants.O_WRONLY | fs.constants.O_CREAT |
      fs.constants.O_EXCL | (fs.constants.O_NOFOLLOW || 0), 0o600);
    try {
      const empty = fs.fstatSync(fd, { bigint: true });
      requireValue(empty.isFile() && empty.size === 0n && empty.nlink === 1n &&
        same(empty, fs.lstatSync(destination, { bigint: true })), 'Exact empty backup destination required');
      fs.fsyncSync(fd);
      await db.backup(destination, { progress() {
        if (Number(process.hrtime.bigint() - began) / 1e9 >= 180) throw new Error('Owned backup deadline');
        return 256;
      } });
      const output = fs.fstatSync(fd, { bigint: true });
      requireValue(output.dev === empty.dev && output.ino === empty.ino && output.nlink === 1n &&
        same(output, fs.lstatSync(destination, { bigint: true })), 'Backup destination identity changed');
    } finally { fs.closeSync(fd); }
  } finally {
    try { if (db.inTransaction) db.exec('ROLLBACK'); } finally { db.close(); }
  }
  noSidecars(destination);
  const outputFd = fs.openSync(destination, fs.constants.O_RDWR | (fs.constants.O_NOFOLLOW || 0));
  const hash = crypto.createHash('sha256'), buffer = Buffer.allocUnsafe(1024 * 1024);
  let length = 0;
  try {
    const before = fs.fstatSync(outputFd, { bigint: true });
    requireValue(before.isFile() && before.nlink === 1n && before.size === BigInt(expected), 'Exact pinned backup length required');
    // One overflow byte proves EOF; a growing file cannot make this read unbounded.
    while (length <= expected) {
      const size = fs.readSync(outputFd, buffer, 0, Math.min(buffer.length, expected + 1 - length), null);
      if (!size) break;
      hash.update(buffer.subarray(0, size)); length += size;
    }
    const after = fs.fstatSync(outputFd, { bigint: true }), named = fs.lstatSync(destination, { bigint: true });
    requireValue(length === expected && same(before, after) && same(after, named), 'Backup changed during bounded sealing');
    fs.fchmodSync(outputFd, 0o400); fs.fsyncSync(outputFd);
  } finally { fs.closeSync(outputFd); }
  return { backupPath: '/tmp/backup.db', bytes: length, sha256: hash.digest('hex'),
    sourceReadonly: true, kernelReadOnlyDataMountRequired: true, consistentBackup: true, neverRetry: true };
}
if (require.main === module) {
  const args = process.argv.slice(2);
  if (args.length !== 2 || args[0] !== '--db' || args[1] !== '/app/server/prisma/dev.db') {
    process.stderr.write('Exact live read-only backup source required\n'); process.exitCode = 1;
  } else {
    const appRequire = createRequire('/app/server/package.json');
    Promise.resolve().then(() => {
      const admission = readAdmission('/tmp/backup-admission.json');
      verifyDependency(appRequire);
      return backup(args[1], '/tmp/backup.db', appRequire('better-sqlite3'), admission);
    })
      .then(value => process.stdout.write(JSON.stringify(value) + '\n'))
      .catch(() => { process.stderr.write('Live read-only backup refused\n'); process.exitCode = 1; });
  }
}
module.exports = { backup, readAdmission, validateAdmission, verifyDependency };
