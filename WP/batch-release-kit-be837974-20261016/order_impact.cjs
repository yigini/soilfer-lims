/* Release-owned read-only order impact transport. No APPLY route is exposed.
 * The pinned application's --dry-run owner still computes every scientific
 * value. Only its old direct-file spawn/capture wrapper is replaced here.
 */
'use strict';
const fs = require('node:fs'), path = require('node:path'), cp = require('node:child_process');
const { createHash } = require('node:crypto');
const LIMIT = 64 * 1024 ** 2, META = 8192;
const ADMISSION = { filesystemClosureClaimed: false, maximumStderrBytes: LIMIT,
  maximumStdoutBytes: LIMIT, metadataMaximumBytes: META, readOnlyDryRunOnly: true,
  sentinelBytes: 1, version: 1 };
const CHILD = ['/app/server/scripts/install_order_revisions.js', '--db', '/app/server/prisma/dev.db', '--dry-run'];
const hash = raw => createHash('sha256').update(raw).digest('hex');
function need(value, message) { if (!value) throw Error(message); }
function regular(file, links = 1n) {
  for (let p = path.resolve(file);;) {
    if (fs.existsSync(p)) need(!fs.lstatSync(p).isSymbolicLink(), 'Impact file/ancestor alias refused');
    const parent = path.dirname(p); if (parent === p) break; p = parent;
  }
  const s = fs.lstatSync(file, { bigint: true });
  need(s.isFile() && s.nlink === links, 'Exact regular impact file/link count required');
  return s;
}
function same(a, b) {
  return ['dev', 'ino', 'size', 'mode', 'nlink', 'mtimeNs', 'ctimeNs'].every(k => a[k] === b[k]);
}
function fileRecord(file, links = 1n) {
  const before = regular(file, links), fd = fs.openSync(file, fs.constants.O_RDONLY | (fs.constants.O_NOFOLLOW || 0));
  const digest = createHash('sha256'), buffer = Buffer.allocUnsafe(65536); let bytes = 0;
  try {
    need(before.size <= BigInt(Number.MAX_SAFE_INTEGER), 'Impact file size is not an exact integer');
    need(same(before, fs.fstatSync(fd, { bigint: true })), 'Impact descriptor identity differs');
    while (bytes <= Number(before.size)) {
      const count = fs.readSync(fd, buffer, 0, Math.min(buffer.length, Number(before.size) + 1 - bytes), null);
      if (!count) break; bytes += count; need(bytes <= Number(before.size), 'Impact file grew while hashing');
      digest.update(buffer.subarray(0, count));
    }
    need(bytes === Number(before.size) && same(before, fs.fstatSync(fd, { bigint: true })) &&
      same(before, regular(file, links)), 'Impact original changed while hashing');
  } finally { fs.closeSync(fd); }
  return { bytes, sha256: digest.digest('hex') };
}
function triple(target) {
  return Object.fromEntries(['', '-wal', '-shm'].map(s => [s, fs.existsSync(target + s) ? fileRecord(target + s).sha256 : null]));
}
function syncDirectory(directory) {
  if (process.platform === 'win32') return; // LOCAL projection only; operational host is Linux.
  const fd = fs.openSync(directory, 'r'); try { fs.fsyncSync(fd); } finally { fs.closeSync(fd); }
}
function writeOnce(file, raw) {
  need(raw.length <= META, 'Impact metadata exceeds before-create admission');
  const fd = fs.openSync(file, 'wx', 0o600);
  try { fs.writeFileSync(fd, raw); fs.fsyncSync(fd); } finally { fs.closeSync(fd); }
  fs.chmodSync(file, 0o400); syncDirectory(path.dirname(file));
}
function readAdmission(file) {
  // The parent publishes this one immutable control record with its retained
  // pending hardlink. This exact pair is the sole two-link exception; stream
  // files and snapshot contents still require one independent inode each.
  const before = regular(file, 2n);
  need(before.size <= BigInt(META), 'Impact admission oversized');
  need(same(before, regular(file + '.pending', 2n)), 'Impact admission hardlink pair differs');
  const fd = fs.openSync(file, fs.constants.O_RDONLY | (fs.constants.O_NOFOLLOW || 0));
  const buffer = Buffer.alloc(META + 1); let bytes = 0;
  try {
    need(same(before, fs.fstatSync(fd, { bigint: true })), 'Impact admission descriptor differs');
    while (bytes < buffer.length) {
      const count = fs.readSync(fd, buffer, bytes, buffer.length - bytes, null);
      if (!count) break; bytes += count;
    }
    need(bytes === Number(before.size) && same(before, fs.fstatSync(fd, { bigint: true })) &&
      same(before, regular(file, 2n)), 'Impact admission changed during bounded read');
  } finally { fs.closeSync(fd); }
  const raw = buffer.subarray(0, bytes);
  need(raw.equals(Buffer.from(JSON.stringify(ADMISSION) + '\n')), 'Exact before-create impact output admission required');
  return ADMISSION;
}
async function capture(directory, argv, spawn = cp.spawn, limit = LIMIT, sourceCheck = null) {
  // Tests may select a smaller LOCAL limit; the operator always uses LIMIT.
  need(Number.isSafeInteger(limit) && limit > 0 && limit <= LIMIT, 'Impact stream bound invalid');
  const files = {}, streams = {}; let child, errorType = null, status = null, signal = null;
  for (const name of ['order-impact.stdout', 'order-impact.stderr', 'order-impact-exit.json'])
    need(!fs.existsSync(path.join(directory, name)), 'Impact output name consumed; never retry');
  try {
    for (const name of ['stdout', 'stderr']) {
      const filename = path.join(directory, 'order-impact.' + name);
      files[name] = { filename, fd: fs.openSync(filename, 'wx', 0o600) };
      files[name].identity = fs.fstatSync(files[name].fd, { bigint: true });
      streams[name] = { bytes: 0, sha256: null, eof: false, overflow: false };
    }
    child = spawn(process.execPath, argv, { env: { ...process.env, TEMP: directory, TMP: directory, TMPDIR: directory },
      stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true });
    for (const name of ['stdout', 'stderr']) {
      const stream = child[name], row = streams[name];
      stream.on('readable', () => {
        try {
          // read(n) is bounded before every write; fast exit and arbitrarily
          // large pipe chunks cannot bypass the one-sentinel retention limit.
          while (!row.overflow) {
            const raw = stream.read(Math.min(65536, limit + 1 - row.bytes));
            if (raw === null) break;
            let offset = 0;
            while (offset < raw.length) {
              const wrote = fs.writeSync(files[name].fd, raw, offset, raw.length - offset);
              need(wrote > 0, 'Impact stream write made no progress'); offset += wrote;
            }
            row.bytes += raw.length;
            if (row.bytes > limit) {
              row.overflow = true; errorType = 'OUTPUT_LIMIT_EXCEEDED';
              // This child is ONLY --dry-run. No APPLY transaction is exposed
              // to this new transport refusal. Prefixes stay incomplete.
              child.kill('SIGKILL'); child.stdout.destroy(); child.stderr.destroy();
            }
          }
        } catch (error) {
          errorType = error.code || error.name; child.kill('SIGKILL'); child.stdout.destroy(); child.stderr.destroy();
        }
      });
      stream.on('end', () => { row.eof = true; });
      stream.on('error', error => { errorType = error.code || error.name; child.kill('SIGKILL'); });
    }
    await new Promise(resolve => {
      child.on('error', error => { errorType = error.code || error.name; });
      child.on('close', (code, why) => { status = code; signal = why; resolve(); });
    });
  } catch (error) { errorType = error.code || error.name; }
  finally {
    let sealError = null;
    for (const name of ['stdout', 'stderr']) {
      const file = files[name];
      if (!file) continue;
      try {
        fs.fsyncSync(file.fd);
        const after = fs.fstatSync(file.fd, { bigint: true }), named = regular(file.filename);
        need(after.dev === file.identity.dev && after.ino === file.identity.ino && after.nlink === 1n &&
          after.size === BigInt(streams[name].bytes) && same(after, named), 'Impact output descriptor/path differs');
      } catch (error) { sealError ||= error; }
      finally { fs.closeSync(file.fd); }
      try { fs.chmodSync(file.filename, 0o400); streams[name].sha256 = fileRecord(file.filename).sha256; }
      catch (error) { sealError ||= error; }
    }
    if (sealError) throw sealError;
    syncDirectory(directory);
  }
  need(files.stdout && files.stderr, 'Failed impact stream creation; retain consumed names');
  const completeOriginals = !errorType && ['stdout', 'stderr'].every(n => streams[n].eof && !streams[n].overflow);
  const source = sourceCheck ? sourceCheck() : { before: null, after: null };
  const result = { version: 1, childArgv: argv, status, signal, errorType, streams,
    sourceBefore: source.before, sourceAfter: source.after, completeOriginals, neverRetry: true };
  writeOnce(path.join(directory, 'order-impact-exit.json'), Buffer.from(JSON.stringify(result) + '\n'));
  return result;
}
function allocation(root) {
  const files = [];
  const outerNames = ['cli-output-admission.json', 'cli-output-admission.json.pending', 'cli-original.stdout', 'cli-original.stderr'];
  if (outerNames.some(n => fs.existsSync(path.join(root, n)))) {
    // The enclosing supervisor's producer is admitted independently. Its
    // original pipes may still be open; this child cannot seal or hash them.
    const outer = require('./cli_output.cjs');
    outer.readAdmission(root, ['/release/order_impact.cjs', '--db', CHILD[2]]);
    for (const name of ['cli-original.stdout', 'cli-original.stderr']) {
      const file = path.join(root, name);
      if (fs.existsSync(file)) need(regular(file).size <= BigInt(outer.LIMIT + 1), 'Outer CLI prefix exceeds held bound');
    }
  }
  function visit(directory) {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
      const file = path.join(directory, entry.name), s = fs.lstatSync(file);
      need(!s.isSymbolicLink(), 'Impact allocation alias refused');
      if (directory === root && entry.isFile() && [
        'snapshot-admission.json', 'snapshot-admission.json.pending',
        'order-impact-admission.json', 'order-impact-admission.json.pending', ...outerNames
      ].includes(entry.name)) continue; // Already charged independent controller records.
      if (s.isDirectory()) {
        need(directory === root && /^lims-policy-schema-readonly-[A-Za-z0-9_-]+$/.test(entry.name), 'Unknown impact snapshot directory');
        visit(file);
      }
      else {
        need(directory !== root || ['order-impact.stdout', 'order-impact.stderr', 'order-impact-exit.json'].includes(entry.name),
          'Unknown impact temporary output');
        need(s.isFile() && s.nlink === 1, 'Independent impact allocation file required');
        const row = fileRecord(file), blocks = Number.isSafeInteger(s.blocks) ? s.blocks * 512 : null;
        files.push({ path: file, ...row, allocatedBytes: blocks,
          conservativeAllocationBytes: Math.max(row.bytes, Math.ceil(row.bytes / 4096) * 4096, blocks || 0) });
      }
    }
  }
  visit(root);
  return { root, files, logicalBytes: files.reduce((n, r) => n + r.bytes, 0),
    allocationMeasured: files.every(r => r.allocatedBytes !== null),
    conservativeAllocationBytes: files.reduce((n, r) => n + r.conservativeAllocationBytes, 0) };
}
async function collect(target, directory, spawn = cp.spawn) {
  readAdmission(path.join(directory, 'order-impact-admission.json'));
  const before = triple(target), captured = await capture(directory, CHILD, spawn, LIMIT,
    () => ({ before, after: triple(target) })), after = captured.sourceAfter;
  need(JSON.stringify(before) === JSON.stringify(after), 'Order impact changed source triple');
  need(captured.completeOriginals && captured.status === 0 && captured.signal === null, 'Incomplete order impact; retain originals');
  const result = JSON.parse(fs.readFileSync(path.join(directory, 'order-impact.stdout'), 'utf8'));
  need(result.mode === 'DRY_RUN' && result.totalChanges === 0 && result.backfilledCount === 0 &&
    result.readonlySnapshot?.originalFilesPreserved === true, 'Read-only impact owner proof differs');
  return { ...result, access: 'RETAINED_SNAPSHOT_ONLY', originalDbWalShmSha256: before,
    originalFilesPreserved: true, productionMutations: 0, retainedAllocation: allocation(directory) };
}
if (require.main === module) {
  (async () => {
    need(process.argv.length === 4 && process.argv[2] === '--db' && process.argv[3] === CHILD[2], 'Exact read-only impact invocation required');
    process.stdout.write(JSON.stringify(await collect(CHILD[2], '/tmp'), null, 2) + '\n');
  })().catch(() => { process.stderr.write('ORDER_REVISION_IMPACT_REFUSED_RETAIN_ALL\n'); process.exitCode = 1; });
}
module.exports = { ADMISSION, CHILD, readAdmission, capture, collect, allocation };
