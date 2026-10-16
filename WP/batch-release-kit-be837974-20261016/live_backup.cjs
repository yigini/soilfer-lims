/* Source read transaction and output content admission precede exclusive creation.
 * SQLite internal journal files and global filesystem closure are separate work.
 */
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { createRequire } = require('node:module');
const MAXIMUM = 32 * 1024 ** 3;
function requireValue(condition, message) { if (!condition) throw new Error(message); }
function validateAdmission(value) {
  requireValue(value && Object.keys(value).sort().join(',') ===
    'journalAndFilesystemClosureClaimed,maximumMainBytes,version' && value.version === 1 &&
    value.journalAndFilesystemClosureClaimed === false && Number.isSafeInteger(value.maximumMainBytes) &&
    value.maximumMainBytes >= 512 && value.maximumMainBytes <= MAXIMUM,
  'Exact held live-backup content admission required');
  return value;
}
function readAdmission(filename) {
  const fd = fs.openSync(filename, fs.constants.O_RDONLY | (fs.constants.O_NOFOLLOW || 0));
  try {
    const before = fs.fstatSync(fd, { bigint: true });
    requireValue(before.isFile() && before.size > 0n && before.size <= 8192n, 'Bounded admission file required');
    const raw = Buffer.alloc(Number(before.size) + 1);
    const count = fs.readSync(fd, raw, 0, raw.length, 0);
    const after = fs.fstatSync(fd, { bigint: true }), named = fs.lstatSync(filename, { bigint: true });
    requireValue(count === Number(before.size) && same(before, after) && same(after, named), 'Admission changed');
    const value = validateAdmission(JSON.parse(raw.subarray(0, count).toString('utf8')));
    const canonical = JSON.stringify({ journalAndFilesystemClosureClaimed: false,
      maximumMainBytes: value.maximumMainBytes, version: 1 }) + '\n';
    requireValue(raw.subarray(0, count).equals(Buffer.from(canonical)), 'Canonical admission required');
    return value;
  } finally { fs.closeSync(fd); }
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
  try { fs.lstatSync(destination); throw new Error('Owned output already consumed'); }
  catch (error) { if (error.code !== 'ENOENT') throw error; }
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
    try { fs.fsyncSync(fd); } finally { fs.closeSync(fd); }
    await db.backup(destination, { progress() {
      if (Number(process.hrtime.bigint() - began) / 1e9 >= 180) throw new Error('Owned backup deadline');
      return 256;
    } });
  } finally {
    try { if (db.inTransaction) db.exec('ROLLBACK'); } finally { db.close(); }
  }
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
    Promise.resolve().then(() => backup(args[1], '/tmp/backup.db', appRequire('better-sqlite3'),
      readAdmission('/tmp/backup-admission.json')))
      .then(value => process.stdout.write(JSON.stringify(value) + '\n'))
      .catch(() => { process.stderr.write('Live read-only backup refused\n'); process.exitCode = 1; });
  }
}
module.exports = { backup, readAdmission, validateAdmission };
