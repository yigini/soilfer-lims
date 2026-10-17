from pathlib import Path
k=Path(r'C:/Users/yigin/.codex/worktrees/audit-qc-integration/soilfer-lims/WP/batch-release-kit-be837974-20261016')
p=k/'capture_writer_journal.cjs';s=p.read_text(encoding='utf8');assert 'function verifyMainAdmission' not in s
needle="  absent(target + '-journal');\n";assert s.count(needle)==1
s=s.replace(needle,needle+"  verifyMainAdmission(directory, label, input, plan, header, page, pages);\n")
s=s.replace('checkedMainJournalAdmission: true, completeWriterFilesystemReview: false','checkedMainJournalAdmission: true, checkedNativeMainLogicalGrowthAdmission: true, completeWriterFilesystemReview: false')
needle='module.exports = { verifyCaptureWriter, readFile };';assert s.count(needle)==1
addition=r'''function sorted(value) {
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
}
'''
s=s.replace(needle,addition+'\n'+needle);p.write_text(s,encoding='utf8',newline='')
print('Silent native preflight now requires both immutable MAIN and journal admissions; source only')