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
  need(plan.headerHex === header.toString('hex'), 'Original admitted writer header differs');
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
  const main = verifyMainAdmission(directory, label, input, plan, header, page, pages);
  verifyStatementAdmission(directory, label, input, main, appRoot);
  need(same(actual.info, fs.lstatSync(target, { bigint: true })), 'Writer changed before scientific spawn');
  return { label, checkedMainJournalAdmission: true, checkedNativeMainLogicalGrowthAdmission: true,
    checkedStatementJournalContentAdmission: true, statementJournalFileLengthOrVfsBounded: false,
    completeWriterFilesystemReview: false };
}
function sorted(value) {
  if (Array.isArray(value)) return value.map(sorted);
  if (value !== null && typeof value === 'object') return Object.fromEntries(Object.keys(value).sort().map(k => [k, sorted(value[k])]));
  return value;
}
const equal = (a, b) => JSON.stringify(sorted(a)) === JSON.stringify(sorted(b));
function verifyMainAdmission(directory, label, journalInput, journal, header, page, pages) {
  const filename = path.join(directory, 'writer-main-admission.json');
  const input = readFile(filename, 8192, 2), pending = readFile(filename + '.pending', 8192, 2);
  const immutable = process.platform === 'win32' ? (input.info.mode & 0o222n) === 0n : (input.info.mode & 0o777n) === 0o400n;
  need(immutable && input.info.dev === pending.info.dev && input.info.ino === pending.info.ino &&
    input.sha256 === pending.sha256, 'Immutable native MAIN admission pair required');
  const plan = JSON.parse(input.raw), sourceInput = readFile(path.join(__dirname, 'capture-native-main-source.json'), 65536);
  const source = JSON.parse(sourceInput.raw);
  need(source.scope === 'CAPTURE_STRICT_PRE_NATIVE_MAIN_LOGICAL_GROWTH_ONLY' && source.completeRestrictedMainNativeCallerReview === true &&
    source.mainFileLengthOrVfsPreallocationBounded === false && source.physicalFilesystemClosureClaimed === false,
    'Exact restricted native MAIN caller proof required');
  for (const [name, pin] of Object.entries(source.files)) {
    const actual = readFile(path.join(__dirname, name), 1024 ** 2);
    need(actual.bytes === pin.bytes && actual.sha256 === pin.sha256, 'Native MAIN tooling/proof source changed');
  }
  const nativeInput = readFile(path.join(__dirname, 'capture-native-inventory-source.json'), 65536);
  const native = JSON.parse(nativeInput.raw), profile = native.profiles[label];
  need(native.mainJournalCallerProofSha256 === journal.callerProofSha256 && source.nativeInventoryProofSha256 === nativeInput.sha256 &&
    profile && header.readUInt32BE(56) === 1 && header[20] === 0 && header[21] === 64 && header[22] === 32 && header[23] === 32,
    'Native MAIN UTF-8/record geometry or source profile differs');
  const insertions = []; let roots = 0, deletes = 0;
  for (const object of profile.objects) {
    if (object.type === 'table' || object.type === 'index') roots++;
    if (object.type === 'table') { insertions.push({calls: 1, maximumPayloadBytes: 6}); deletes++; }
    insertions.push({calls: 1, maximumPayloadBytes: profile.maximumSchemaPayloadBytes});
  }
  insertions.push({calls: 1, maximumPayloadBytes: profile.maximumReceiptTablePayloadBytes},
    {calls: 1, maximumPayloadBytes: profile.maximumReceiptIndexPayloadBytes});
  const operations = {version: 1, scope: 'DECLARED_NATIVE_NORMAL_BTREE_MUTATIONS', callerReviewSha256: nativeInput.sha256,
    createdRoots: roots, normalInsertions: insertions, deletions: deletes};
  const calls = insertions.reduce((n, r) => n + r.calls, 0);
  const overflow = insertions.reduce((n, r) => n + r.calls * Math.ceil(r.maximumPayloadBytes / (page - 4)), 0);
  const allocations = roots + deletes * 214 + calls * 107 + overflow, additional = 2 * allocations;
  const maximumPages = pages + additional, maximumBytes = maximumPages * page, growth = additional * page;
  const bound = {originalPages: pages, pageSize: page, nativeInsertCalls: calls, createdRoots: roots,
    balanceAllocationCallsPerInsert: 107, maximumOverflowAllocationCalls: overflow,
    maximumAllocationCalls: allocations, maximumAdditionalPages: additional,
    maximumLogicalMainPages: maximumPages, maximumLogicalMainBytes: maximumBytes, maximumLogicalGrowthBytes: growth,
    nativeDeleteCalls: deletes, deleteBalanceAllocationCalls: deletes * 214, normalInsertionsIncludeOverwrites: true,
    callerReviewVerified: false, writerGraphAdmissionImplemented: false, mainFileLengthOrVfsPreallocationBounded: false,
    physicalFilesystemClosureClaimed: false};
  const rounded = Math.ceil(growth / 4096) * 4096;
  const layout = {fileCount: 1, directoryCount: 0, contentBytes: growth, roundedContentBytes: rounded,
    entryAndInodeAllowanceBytes: 8192, declaredAllocationBytes: rounded + 8192, physicalFilesystemClosureClaimed: false};
  need(Number.isSafeInteger(maximumBytes) && maximumBytes <= 32 * 1024 ** 3 && maximumPages <= 4294967294 &&
    growth <= source.maximumLogicalGrowthBytes[label], 'Complete native MAIN page envelope too large');
  need(plan.version === 1 && plan.scope === 'CAPTURE_NATIVE_MAIN_LOGICAL_GROWTH_ADMISSION' && plan.label === label &&
    plan.nativeMainProofSha256 === sourceInput.sha256 && plan.nativeInventoryProofSha256 === nativeInput.sha256 &&
    plan.journalAdmissionSha256 === journalInput.sha256 && equal(plan.directoryIdentity, journal.directoryIdentity) &&
    plan.containerSource === journal.containerSource && equal(plan.operations, operations) && equal(plan.bound, bound) && equal(plan.layout, layout),
    'Native MAIN complete operation arithmetic or original source chain differs');
  const original = plan.schemaOriginal, name = label === 'capture-206-prepare' ? 'capture-schema-initial.json' : 'capture-schema-206.json';
  need(original && equal(Object.keys(original).sort(), ['bytes','file','sha256']) && original.file === name &&
    Number.isSafeInteger(original.bytes) && original.bytes > 0 && original.bytes <= 16 * 1024 ** 2 &&
    /^[a-f0-9]{64}$/.test(original.sha256) && /^[a-f0-9]{64}$/.test(plan.schemaSha256) &&
    plan.collectorProofSha256 === source.collectorProofSha256,
    'Native MAIN full schema original binding differs');
  for (const name of ['collectorSourceByteBindingVerified','restrictedMainNativeProfileVerified','logicalMainGrowthWriterAdmissionImplemented'])
    need(plan[name] === true, 'Required native MAIN admission condition missing');
  for (const name of ['independentSchemaToPrivateDbBytesProof','mainFileLengthOrVfsPreallocationBounded',
    'statementOrSqlScratchBounded','walGrowthBounded','physicalFilesystemClosureClaimed','completeWriterFilesystemReview'])
    need(plan[name] === false, 'Native MAIN admission cannot invent filesystem authority');
  return {input, plan};
}

function verifyStatementAdmission(directory, label, journalInput, main, appRoot) {
  const filename = path.join(directory, 'writer-statement-admission.json');
  const input = readFile(filename, 8192, 2), pending = readFile(filename + '.pending', 8192, 2);
  const immutable = process.platform === 'win32' ? (input.info.mode & 0o222n) === 0n : (input.info.mode & 0o777n) === 0o400n;
  need(immutable && input.info.dev === pending.info.dev && input.info.ino === pending.info.ino &&
    input.sha256 === pending.sha256, 'Immutable statement content admission pair required');
  const sourceInput = readFile(path.join(__dirname, 'capture-statement-journal-source.json'), 65536);
  const source = JSON.parse(sourceInput.raw);
  need(source.scope === 'CAPTURE_STRICT_PRE_STATEMENT_JOURNAL_CONTENT_ADMISSION' &&
    source.restrictedStatementSourceInventoryVerified === true && source.statementJournalFileLengthOrVfsBounded === false &&
    source.physicalFilesystemClosureClaimed === false, 'Exact conditional statement content source required');
  for (const [name, pin] of Object.entries(source.files)) {
    const actual = readFile(path.join(__dirname, name), 1024 ** 2);
    need(actual.bytes === pin.bytes && actual.sha256 === pin.sha256, 'Statement tooling/proof source changed');
  }
  const proofInput = readFile(path.join(__dirname, 'statement-journal-source.json'), 65536);
  const proof = JSON.parse(proofInput.raw), prefix = 'WP/batch-release-kit-be837974-20261016/';
  need(source.statementSourceProofSha256 === proofInput.sha256 &&
    proof.scope === 'CONDITIONAL_FORWARD_STATEMENT_JOURNAL_CONTENT' && proof.completeRestrictedCaptureStatementInventory === true &&
    proof.runtimeBinaryToSourceBindingVerified === false && proof.writerGraphAdmissionImplemented === false &&
    proof.sqlScratchSizeBounded === false && proof.physicalFilesystemClosureClaimed === false,
    'Exact native statement source declaration required');
  for (const [name, pin] of Object.entries(proof.files)) {
    need(!path.posix.isAbsolute(name) && !name.split('/').includes('..'), 'Foreign statement source path');
    const filename = name.startsWith(prefix) ? path.join(__dirname, name.slice(prefix.length)) : path.join(appRoot, name);
    const actual = readFile(filename, 10 * 1024 ** 2);
    need(actual.bytes === pin.bytes && actual.sha256 === pin.sha256, 'Native statement caller/source changed');
  }
  const count = label === 'capture-206-prepare' ? 10 : 24;
  need(proof.captureStatementStarts[label] === count, 'Complete source SQL statement count differs');
  const native = main.plan.bound, size = native.pageSize, pages = native.maximumLogicalMainPages;
  const per = pages * (size + 4), total = count * per, rounded = count * Math.ceil(per / 4096) * 4096;
  need(Number.isSafeInteger(total) && total <= 32 * 1024 ** 3, 'Complete statement content too large; never clip');
  const layout = {fileCount: count, directoryCount: 0, contentBytes: total, roundedContentBytes: rounded,
    entryAndInodeAllowanceBytes: count * 8192, declaredAllocationBytes: rounded + count * 8192,
    physicalFilesystemClosureClaimed: false};
  const statements = {version: 1, scope: 'DECLARED_FORWARD_SQL_WRITE_STATEMENTS', maximumStatementStarts: count,
    maximumSimultaneousStatementSavepoints: 1, explicitSavepoints: false, continuedWritingAfterRollbackOrSqlError: false};
  const bound = {version: 1, scope: 'CONDITIONAL_FORWARD_STATEMENT_JOURNAL_CONTENT', sourceProofSha256: proofInput.sha256,
    declaredStatements: statements, nativeMutationBound: native, maximumStatementStarts: count,
    maximumRecordsPerStatement: pages, maximumCumulativePageRecords: count * pages,
    recordBytes: size + 4, recordHeaderBytes: 4, journalHeaderBytes: 0,
    maximumCumulativeLogicalContentBytes: total, maximumSingleFileLogicalContentBytes: total,
    maximumFileCreations: count, aggregateAllocationCharges: layout, memoryBufferCreditBytes: 0,
    truncateReuseDeleteRollbackCreditBytes: 0, statementJournalLogicalContentBounded: true,
    requiresCompleteNativeAndStatementInventories: true, requiresNoExplicitOrOverlappingSavepoints: true,
    requiresNoContinuedWritingAfterRollbackOrSqlError: true, callerReviewVerified: false, collectorBindingImplemented: false,
    runtimeBinaryToSourceBindingVerified: false, runtimeDefaultVfsVerified: false, writerGraphAdmissionImplemented: false,
    statementJournalFileLengthOrVfsBounded: false, sqlScratchSizeBounded: false, walGrowthBounded: false,
    fullLifetimeOriginalsRetained: false, continuousPeakMeasured: false, physicalFilesystemClosureClaimed: false};
  const expected = {version: 1, scope: 'CAPTURE_STATEMENT_JOURNAL_CONTENT_ADMISSION', label,
    statementAdmissionProofSha256: sourceInput.sha256, mainAdmissionSha256: main.input.sha256,
    journalAdmissionSha256: journalInput.sha256, schemaOriginal: main.plan.schemaOriginal,
    collectorProofSha256: main.plan.collectorProofSha256, bound, layout,
    collectorSourceByteBindingVerified: true, restrictedStatementSourceInventoryVerified: true,
    conditionalStatementContentWriterAdmissionImplemented: true, independentSchemaToPrivateDbBytesProof: false,
    runtimeBinaryToSourceBindingVerified: false, runtimeDefaultVfsVerified: false, temporaryDirectoryRoutingVerified: false,
    statementJournalFileLengthOrVfsBounded: false, sqlScratchSizeBounded: false, walGrowthBounded: false,
    fullLifetimeOriginalsRetained: false, continuousPeakMeasured: false, physicalFilesystemClosureClaimed: false,
    completeWriterFilesystemReview: false};
  need(input.raw.equals(Buffer.from(JSON.stringify(sorted(expected)) + '\n')),
    'Canonical complete statement arithmetic/source admission differs');
}

module.exports = { verifyCaptureWriter, readFile };
