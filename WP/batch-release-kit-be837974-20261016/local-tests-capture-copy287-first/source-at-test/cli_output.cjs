/* Bounded original CLI pipes. Capture failure never signals the scientific child.
 * The existing owner600-second clock remains the sole supervisor deadline.
 */
'use strict';
const fs = require('node:fs'), path = require('node:path'), cp = require('node:child_process');
const { createHash } = require('node:crypto');
const LIMIT = 32 * 1024 ** 2, META = 8192;
const hash = raw => createHash('sha256').update(raw).digest('hex');
function need(ok, message) { if (!ok) throw Error(message); }
function regular(file, links = 1n) {
  for (let p = path.resolve(file);;) {
    if (fs.existsSync(p)) need(!fs.lstatSync(p).isSymbolicLink(), 'CLI output ancestor alias refused');
    const parent = path.dirname(p); if (parent === p) break; p = parent;
  }
  const s = fs.lstatSync(file, { bigint: true });
  need(s.isFile() && s.nlink === links, 'Independent regular CLI output required'); return s;
}
function same(a, b) {
  return ['dev', 'ino', 'size', 'mode', 'nlink', 'uid', 'gid', 'mtimeNs', 'ctimeNs'].every(k => a[k] === b[k]);
}
function syncDirectory(directory) {
  if (process.platform === 'win32') return; // LOCAL projection only.
  const fd = fs.openSync(directory, 'r'); try { fs.fsyncSync(fd); } finally { fs.closeSync(fd); }
}
function admission(argv) {
  return { childArgvSha256: hash(Buffer.from(JSON.stringify(argv))), childSignalledOnCaptureFailure: false,
    filesystemClosureClaimed: false, maximumStderrBytes: LIMIT, maximumStdoutBytes: LIMIT,
    metadataMaximumBytes: META, newChildDeadline: false, sentinelBytes: 1, version: 1 };
}
function readAdmission(directory, argv) {
  const file = path.join(directory, 'cli-output-admission.json'), before = regular(file, 2n);
  need(before.size <= BigInt(META) && (before.mode & 0o222n) === 0n &&
    same(before, regular(file + '.pending', 2n)), 'CLI admission pair/bound/immutable mode differs');
  const fd = fs.openSync(file, fs.constants.O_RDONLY | (fs.constants.O_NOFOLLOW || 0));
  const raw = Buffer.alloc(META + 1); let bytes = 0;
  try {
    need(same(before, fs.fstatSync(fd, { bigint: true })), 'CLI admission descriptor differs');
    while (bytes < raw.length) { const n = fs.readSync(fd, raw, bytes, raw.length - bytes, null); if (!n) break; bytes += n; }
    need(bytes === Number(before.size) && same(before, fs.fstatSync(fd, { bigint: true })) &&
      same(before, regular(file, 2n)) && same(before, regular(file + '.pending', 2n)), 'CLI admission changed');
  } finally { fs.closeSync(fd); }
  need(raw.subarray(0, bytes).equals(Buffer.from(JSON.stringify(admission(argv)) + '\n')), 'Exact before-create CLI admission required');
}
async function capture(directory, argv, spawn = cp.spawn, limit = LIMIT, write = fs.writeSync) {
  need(Number.isSafeInteger(limit) && limit > 0 && limit <= LIMIT, 'CLI stream bound invalid');
  for (const name of ['cli-original.stdout', 'cli-original.stderr', 'cli-child-complete.json',
    'cli-child-complete.json.pending', 'cli-exit-permit.json', 'cli-exit-permit.json.pending'])
    need(!fs.existsSync(path.join(directory, name)) && !fs.lstatSync(directory).isSymbolicLink(), 'CLI output namespace consumed');
  const files = {}, streams = {}; let status = null, signal = null, errorType = null;
  try {
    for (const name of ['stdout', 'stderr']) {
      const file = path.join(directory, 'cli-original.' + name);
      const fd = fs.openSync(file, 'wx', 0o600); files[name] = { file, fd, initial: regular(file) };
      streams[name] = { bytes: 0, sha256: null, eof: false, overflow: false, unretainedBytesObserved: false };
    }
    const child = spawn(process.execPath, argv, { env: process.env, stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true });
    for (const name of ['stdout', 'stderr']) {
      const row = streams[name], pipe = child[name]; let failed = false;
      pipe.on('readable', () => {
        try {
          for (;;) {
            // Bound every read BEFORE its write. On failure keep draining,
            // retaining no further bytes; the child and transaction continue.
            const raw = pipe.read(failed || row.overflow ? 65536 : Math.min(65536, limit + 1 - row.bytes));
            if (raw === null) break;
            if (failed || row.overflow) { row.unretainedBytesObserved = true; continue; }
            let offset = 0;
            try {
              while (offset < raw.length) {
                const n = write(files[name].fd, raw, offset, raw.length - offset);
                need(Number.isInteger(n) && n > 0 && n <= raw.length - offset, 'CLI output write failed');
                offset += n; row.bytes += n;
              }
            } catch (error) { failed = true; row.unretainedBytesObserved = true; errorType ||= error.code || error.name; }
            if (row.bytes > limit) { row.overflow = true; errorType ||= 'OUTPUT_LIMIT_EXCEEDED'; }
          }
        } catch (error) { failed = true; errorType ||= error.code || error.name; }
      });
      pipe.on('end', () => { row.eof = true; });
      pipe.on('error', error => { errorType ||= error.code || error.name; });
    }
    await new Promise(resolve => {
      child.on('error', error => { errorType ||= error.code || error.name; });
      child.on('close', (code, why) => { status = code; signal = why; resolve(); });
    });
  } catch (error) { errorType ||= error.code || error.name; }
  finally {
    let failure;
    for (const name of ['stdout', 'stderr']) {
      const value = files[name]; if (!value) continue;
      try {
        fs.fsyncSync(value.fd);
        const opened = fs.fstatSync(value.fd, { bigint: true }), named = regular(value.file);
        need(opened.dev === value.initial.dev && opened.ino === value.initial.ino && opened.nlink === 1n &&
          opened.size === BigInt(streams[name].bytes) && same(opened, named), 'CLI stream identity/length differs');
        if (process.platform !== 'win32') { fs.fchmodSync(value.fd, 0o400); fs.fsyncSync(value.fd); }
      } catch (error) { failure ||= error; }
      finally { fs.closeSync(value.fd); }
      if (process.platform === 'win32') fs.chmodSync(value.file, 0o400);
      try {
        const before = regular(value.file), fd = fs.openSync(value.file, 'r'), digest = createHash('sha256');
        let bytes = 0; const buffer = Buffer.allocUnsafe(65536);
        try {
          need(before.size <= BigInt(limit + 1) && same(before, fs.fstatSync(fd, { bigint: true })), 'CLI sealed descriptor differs');
          while (bytes <= Number(before.size)) {
            const n = fs.readSync(fd, buffer, 0, Math.min(buffer.length, Number(before.size) + 1 - bytes), null);
            if (!n) break; bytes += n; digest.update(buffer.subarray(0, n));
          }
          need(bytes === streams[name].bytes && same(before, fs.fstatSync(fd, { bigint: true })) &&
            same(before, regular(value.file)), 'CLI sealed stream changed');
          streams[name].sha256 = digest.digest('hex');
        } finally { fs.closeSync(fd); }
      } catch (error) { failure ||= error; }
    }
    if (failure) throw failure;
    syncDirectory(directory);
  }
  need(files.stdout && files.stderr, 'Incomplete CLI output creation');
  return { status, signal, errorType, output: { version: 1, streams,
    completeOriginals: !errorType && Object.values(streams).every(r => r.eof && !r.overflow && !r.unretainedBytesObserved),
    childSignalledByCapture: false } };
}
module.exports = { LIMIT, admission, readAdmission, capture };
