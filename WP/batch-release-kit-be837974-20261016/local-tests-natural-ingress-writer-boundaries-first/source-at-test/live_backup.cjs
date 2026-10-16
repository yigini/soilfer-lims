/* Consistent first-sync backup: source is a kernel read-only named volume;
 * destination is a fresh, retained file in this owned CLI's writable /tmp.
 */
'use strict';
const fs = require('node:fs');
const crypto = require('node:crypto');
const { createRequire } = require('node:module');
async function backup(source, destination, Database) {
  const fd = fs.openSync(destination, 'wx', 0o600);
  try { fs.fsyncSync(fd); } finally { fs.closeSync(fd); }
  const began = process.hrtime.bigint();
  const db = new Database(source, { readonly: true, fileMustExist: true });
  try {
    db.pragma('query_only = ON');
    await db.backup(destination, { progress() {
      if (Number(process.hrtime.bigint() - began) / 1e9 >= 180) throw new Error('Owned backup deadline');
      return 256;
    } });
  } finally { db.close(); }
  const outputFd = fs.openSync(destination, 'r');
  const hash = crypto.createHash('sha256'); const buffer = Buffer.allocUnsafe(1024 * 1024);
  let length = 0;
  try {
    fs.fsyncSync(outputFd);
    let size;
    while ((size = fs.readSync(outputFd, buffer, 0, buffer.length, null))) { hash.update(buffer.subarray(0, size)); length += size; }
  } finally { fs.closeSync(outputFd); }
  fs.chmodSync(destination, 0o400);
  return { backupPath: '/tmp/backup.db', bytes: length, sha256: hash.digest('hex'),
    sourceReadonly: true, kernelReadOnlyDataMountRequired: true, consistentBackup: true, neverRetry: true };
}
if (require.main === module) {
  const args = process.argv.slice(2);
  if (args.length !== 2 || args[0] !== '--db' || args[1] !== '/app/server/prisma/dev.db') {
    process.stderr.write('Exact live read-only backup source required\n'); process.exitCode = 1;
  } else {
    const appRequire = createRequire('/app/server/package.json');
    backup(args[1], '/tmp/backup.db', appRequire('better-sqlite3'))
      .then(value => process.stdout.write(JSON.stringify(value) + '\n'))
      .catch(() => { process.stderr.write('Live read-only backup refused\n'); process.exitCode = 1; });
  }
}
module.exports = { backup };
