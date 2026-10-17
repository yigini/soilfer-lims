/* Silent preflight for two retained-clone writers; no SQL on their database. */
'use strict';
const fs = require('node:fs'), path = require('node:path'), crypto = require('node:crypto');
const { createRequire } = require('node:module');
const proofPath = path.join(__dirname, 'capture-writer-journal-source.json');
const hash = raw => crypto.createHash('sha256').update(raw).digest('hex');
const need = (value, message) => { if (!value) throw Error(message); };
const same = (a, b) => ['dev', 'ino', 'size', 'mtimeNs', 'ctimeNs', 'mode', 'nlink'].every(k => a[k] === b[k]);
function ancestors(filename) {
  for (let current = filename; ; current = path.dirname(current)) {
    need(!fs.lstatSync(current).isSymbolicLink(), 'Writer source ancestor alias refused');
    if (current === path.dirname(current)) break;
  }
}
function readFile(filename, maximum, links = 1) {
  ancestors(filename);
  const fd = fs.openSync(filename, fs.constants.O_RDONLY | (fs.constants.O_NOFOLLOW || 0));
  try {
    const before = fs.fstatSync(fd, { bigint: true });
    need(before.isFile() && before.nlink === BigInt(links) && before.size <= BigInt(maximum), 'Bounded independent writer source required');
    const digest = crypto.createHash('sha256'), buffer = Buffer.alloc(65536); let total = 0;
    const parts = maximum <= 65536 ? [] : null;
    while (true) {
      const count = fs.readSync(fd, buffer, 0, Math.min(buffer.length, Number(before.size) + 1 - total), total);
      if (!count) break;
      total += count; need(total <= Number(before.size), 'Writer input grew');
      digest.update(buffer.subarray(0, count)); if (parts) parts.push(Buffer.from(buffer.subarray(0, count)));
    }
    need(total === Number(before.size) && same(before, fs.fstatSync(fd, { bigint: true })) &&
      same(before, fs.lstatSync(filename, { bigint: true })), 'Writer source changed');
    return { bytes: total, sha256: digest.digest('hex'), info: before, raw: parts && Buffer.concat(parts) };
  } finally { fs.closeSync(fd); }
}
function absent(filename) {
  try { fs.lstatSync(filename); throw Error('Existing writer journal refused'); }
  catch (error) { if (error.code !== 'ENOENT') throw error; }
}
function verifyCaptureWriter(directory, label, options = {}) {
  const platform = options.platform || process.platform, appRoot = options.appRoot || '/app';
  need(platform === 'linux' && ['capture-206-prepare', 'capture-214-prepare'].includes(label), 'Exact Linux capture writer required');
  need(process.env.NODE_OPTIONS === '', 'Blank writer NODE_OPTIONS required');
  const filename = path.join(directory, 'writer-journal-admission.json');
  const input = readFile(filename, 8192, 2), pending = readFile(filename + '.pending', 8192, 2);
  // Windows cannot represent Unix owner-only mode; LOCAL projected fixtures
  // require its native read-only bit. The operational Linux predicate is 0400.
  const immutable = process.platform === 'win32' ? (input.info.mode & 0o222n) === 0n : (input.info.mode & 0o777n) === 0o400n;
  need(input.info.dev === pending.info.dev && input.info.ino === pending.info.ino &&
    immutable && input.sha256 === pending.sha256, 'Immutable original writer admission pair required');
  const plan = JSON.parse(input.raw), proofInput = readFile(proofPath, 65536), proof = JSON.parse(proofInput.raw);
  need(plan.version === 2 && plan.scope === 'CAPTURE_MAIN_ROLLBACK_JOURNAL_ADMISSION' && plan.label === label &&
    plan.callerProofSha256 === proofInput.sha256 && proof.completeMainJournalCallerReview === true &&
    proof.completeWriterFilesystemReview === false && plan.completeWriterFilesystemReview === false &&
    plan.containerSource === '/app/server/prisma/dev.db', 'Exact supported main-journal admission required');
  for (const [name, pin] of Object.entries(proof.files)) {
    const actual = readFile(path.join(appRoot, pin.runtimePath || name), 10 * 1024 ** 2);
    need(actual.bytes === pin.bytes && actual.sha256 === pin.sha256, 'Pinned writer caller/native source changed');
  }
  const appRequire = createRequire(path.join(appRoot, 'server/package.json'));
  need(appRequire.resolve('better-sqlite3/package.json') === path.join(appRoot, 'server/node_modules/better-sqlite3/package.json'), 'Foreign native binding resolution');
  const Database = appRequire('better-sqlite3'), memory = new Database(':memory:');
  try {
    const engine = memory.prepare('SELECT sqlite_version() version, sqlite_source_id() sourceId').get();
    need(engine.version === '3.51.2' && engine.sourceId === '2026-01-09 17:27:48 b270f8339eb13b504d0b2ba154ebca966b7dde08e40c3ed7d559749818cb2075', 'Unknown writer SQLite engine');
  } finally { memory.close(); }
  const target = options.target || plan.containerSource, actual = readFile(target, 32 * 1024 ** 3);
  need(actual.bytes === plan.originalFiles[''].bytes && actual.sha256 === plan.originalFiles[''].sha256, 'Admitted writer main changed');
  const headerFd = fs.openSync(target, fs.constants.O_RDONLY | (fs.constants.O_NOFOLLOW || 0));
  const header = Buffer.alloc(100);
  try { need(fs.readSync(headerFd, header, 0, 100, 0) === 100 && same(actual.info, fs.fstatSync(headerFd, { bigint: true })), 'Writer header changed'); }
  finally { fs.closeSync(headerFd); }
  const page = header.readUInt16BE(16) === 1 ? 65536 : header.readUInt16BE(16), pages = actual.bytes / page;
  need(header.subarray(0, 16).equals(Buffer.from('SQLite format 3\0')) && header[18] === 1 && header[19] === 1 &&
    page >= 512 && page <= 65536 && (page & (page - 1)) === 0 && Number.isInteger(pages) && pages >= 1 &&
    header.readUInt32BE(28) === pages && header.readUInt32BE(24) === header.readUInt32BE(92) &&
    header.readUInt32BE(52) === 0 && header.readUInt32BE(64) === 0, 'Unsupported writer header profile');
  need(plan.bound.originalPages === pages && plan.bound.pageSize === page && plan.bound.maximumSectorBytes === 65536 &&
    plan.bound.maximumJournalBytes === pages * (page + 8) + 2 * 65536 * (pages + 2), 'Writer journal content bound differs');
  const identities = new Set([actual.info.dev + ':' + actual.info.ino]);
  for (const suffix of ['-wal', '-shm']) {
    try {
      const side = readFile(target + suffix, 0), key = side.info.dev + ':' + side.info.ino;
      need(side.bytes === 0 && side.info.dev === actual.info.dev && !identities.has(key), 'Writer WAL/SHM content or alias refused'); identities.add(key);
    } catch (error) { if (error.code !== 'ENOENT') throw error; }
  }
  absent(target + '-journal');
  need(same(actual.info, fs.lstatSync(target, { bigint: true })), 'Writer changed before scientific spawn');
  return { label, checkedMainJournalAdmission: true, completeWriterFilesystemReview: false };
}
module.exports = { verifyCaptureWriter, readFile };
