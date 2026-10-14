"""Apply only actual6169628053 receipt scope, eight independent cases and three explicit reason inputs."""
import datetime,hashlib,json,sys
from pathlib import Path
sys.stdout.reconfigure(encoding='utf8')
root=Path(__file__).resolve().parents[2];wp=Path(__file__).parent;dest=wp/'issue209-keyed-mode-response-contract-review'
assert not dest.exists() and (wp/'issue209-keyed-receipt-decisions-6169628053/index.json').exists()
paths=['server/services/orderService.js','server/tests/contracts/audit_1_2_state_authority.test.js']
old={path:(root/path).read_bytes() for path in paths}
dest.mkdir()
for path,raw in old.items():(dest/(Path(path).name+'.before-original')).write_bytes(raw)
cases=[c for c in json.loads((wp/'issue209-closed-runtime-boundary-analysis/closed-failed-case-inventory.json').read_bytes()) if c['suite']=='audit_1_2_state_authority.test.js'];assert len(cases)==4
(dest/'pre-correction-classification.json').write_bytes((json.dumps({'createdUtc':datetime.datetime.now(datetime.UTC).isoformat(),'reviewedBeforeChanges':True,'actualDirection':6169628053,'cases':[{**c,'classification':'AUTHORIZED_LEGACY_RECEIPT_EXPECTATION_CHANGE' if c['test']=='analyses adding work to SUBMITTED_FULL atomically resumes processing' else 'EXPLICIT_MANDATORY_REASON_INPUT_BEFORE_UNCHANGED_INJECTED_ROLLBACK_ASSERTION'} for c in cases],'runtimeChangesRequired':['Mode included in normalized payload hash, preserving actor/sample scope and all retained receipts','Replay projects the original response without internal payloadHash metadata; no stored row changes'],'legacyAssertionChanges':1,'newMeaningfulTests':8,'futureFullExpectedTests':5642,'productionOperations':0},indent=2)+'\n').encode())
s=old[paths[0]].decode().replace('\r\n','\n')
needle='const payloadHash = receipts.computePayloadHash({ analyses: [...request.analyses].sort(), reason: request.reason,'
assert s.count(needle)==1
s=s.replace(needle,"const payloadHash = receipts.computePayloadHash({ mode: isOrder ? 'order' : 'analyses',\n                analyses: [...request.analyses].sort(), reason: request.reason,")
needle='                    return checked.receipt.parsedOutcome;'
assert s.count(needle)==1
s=s.replace(needle,"                    // The receipt hash is internal metadata; replay keeps the original public response.\n                    const replay = { ...checked.receipt.parsedOutcome };\n                    delete replay.payloadHash;\n                    return replay;")
new={paths[0]:s}
s=old[paths[1]].decode().replace('\r\n','\n')
needle="    expect(saved.receipts).toHaveLength(mode === 'order' ? 1 : 0);";assert s.count(needle)==1
s=s.replace(needle,"    // Claudio6169628053: a supplied key is recorded once on either route.\n    expect(saved.receipts).toHaveLength(1);")
needle="analysisOrders.reviseAnalyses(sample.id, { analyses: ['PH_H2O', 'SOC'] }, manager"
assert s.count(needle)==2
s=s.replace(needle,"analysisOrders.reviseAnalyses(sample.id, { analyses: ['PH_H2O', 'SOC'], reason: 'Reviewed additional ordered parameter before injected failure' }, manager")
added="""
// #209/6169628053: these checks exercise response, payload, mode and absent-key contracts separately.
function keyedOrderTables() {
    const raw = new (require('better-sqlite3'))(databasePath, { readonly: true, fileMustExist: true });
    try {
        return raw.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name").all().map(({ name }) => ({
            name, rows: raw.prepare('SELECT * FROM "' + name.replaceAll('"', '""') + '"').all().map(row => JSON.stringify(row)).sort()
        }));
    } finally { raw.close(); }
}

async function keyedOrderCase(mode, keyed = true) {
    const { sample } = await fixture('PROCESSING', 'PH_H2O', 'NOT_ASSIGNED');
    await samples.transitionSample(sample.id, sample.status, manager, null, { requiredAnalyses: '["PH_H2O"]' }, client);
    const input = { analyses: ['PH_H2O', 'SOC'], reason: 'Reviewed complete keyed order target' };
    const options = { mode, tx: client, ...(keyed && { idempotencyKey: id() }) };
    const original = await analysisOrders.reviseAnalyses(sample.id, input, manager, options);
    return { sample, input, options, original };
}

test.each(['analyses', 'order'])('%s same-key replay returns the original response with all-table zero writes', async mode => {
    const f = await keyedOrderCase(mode), before = keyedOrderTables();
    expect(await client.commandReceipt.count({ where: { targetResource: `Sample:${f.sample.id}` } })).toBe(1);
    const replay = await analysisOrders.reviseAnalyses(f.sample.id, f.input, manager, f.options);
    expect(JSON.parse(JSON.stringify(replay))).toEqual(JSON.parse(JSON.stringify(f.original)));
    expect(keyedOrderTables()).toEqual(before);
});

test.each(['analyses', 'order'])('%s same key with a differing reason refuses with all-table zero writes', async mode => {
    const f = await keyedOrderCase(mode), before = keyedOrderTables();
    await expect(analysisOrders.reviseAnalyses(f.sample.id, { ...f.input, reason: 'Different deliberate order reason' }, manager, f.options))
        .rejects.toMatchObject({ statusCode: 409, code: 'IDEMPOTENCY_KEY_CONFLICT' });
    expect(keyedOrderTables()).toEqual(before);
});

test.each(['analyses', 'order'])('%s key cannot replay identical parameters through the other mode and changes no table', async mode => {
    const f = await keyedOrderCase(mode), before = keyedOrderTables();
    await expect(analysisOrders.reviseAnalyses(f.sample.id, f.input, manager, { ...f.options, mode: mode === 'order' ? 'analyses' : 'order' }))
        .rejects.toMatchObject({ statusCode: 409, code: 'IDEMPOTENCY_KEY_CONFLICT' });
    expect(keyedOrderTables()).toEqual(before);
});

test.each(['analyses', 'order'])('%s command without a key writes its order and work without any receipt', async mode => {
    const f = await keyedOrderCase(mode, false);
    expect(f.original).toMatchObject({ success: true, added: ['SOC'] });
    expect(await client.sampleOrderRevision.count({ where: { sampleId: f.sample.id, status: 'ACTIVE' } })).toBe(1);
    expect(await client.workItem.count({ where: { sampleId: f.sample.id, analysis: 'SOC' } })).toBe(1);
    expect(await client.commandReceipt.count({ where: { targetResource: `Sample:${f.sample.id}` } })).toBe(0);
});
"""
s+=added;new[paths[1]]=s
for path,text in new.items():
 newline='\r\n' if b'\r\n' in old[path] else '\n';(root/path).write_bytes(text.replace('\n',newline).encode())
recovered=new[paths[1]][:-len(added)]
recovered=recovered.replace("    // Claudio6169628053: a supplied key is recorded once on either route.\n    expect(saved.receipts).toHaveLength(1);","    expect(saved.receipts).toHaveLength(mode === 'order' ? 1 : 0);")
recovered=recovered.replace("analyses: ['PH_H2O', 'SOC'], reason: 'Reviewed additional ordered parameter before injected failure'","analyses: ['PH_H2O', 'SOC']")
assert recovered==old[paths[1]].decode().replace('\r\n','\n')
proof={'actualDirection':6169628053,'oldTestBodyExactlyRecoveredAfterRemovingNewCasesAndReversingOneAuthorizedExpectationAndTwoReasonInputSites':True,'legacyExpectationChange':{'old':"mode === 'order' ? 1 : 0",'new':'1','reason':'A supplied key must never be ignored; exactly one scoped sameTX receipt in both modes per6169628053'},'inputSitesChanged':2,'oldRollbackAssertionsUnchanged':True,'addedMeaningfulTests':8,'runtimeReceiptRowsRewritten':0,'schemaOrScannerChanges':0,'productionOperations':0,'paths':{p:{'beforeSha256':hashlib.sha256(old[p]).hexdigest(),'afterSha256':hashlib.sha256((root/p).read_bytes()).hexdigest()} for p in paths}}
(dest/'change-provenance.json').write_bytes((json.dumps(proof,indent=2)+'\n').encode())
print(json.dumps({'runtimePaths':1,'testPaths':1,'authorizedLegacyExpectationChanges':1,'meaningfulNewCases':8,'futureFullExpectedTests':5642,'productionOperations':0}))
