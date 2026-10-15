"""Retain failed draft bytes; new fixture opts into the real workflow owner."""
import hashlib,json,pathlib
R=pathlib.Path(__file__).resolve().parents[2];D=R/'WP/startup-order-readiness-20261015/managed-fixture-preparation-once'
assert not D.exists();D.mkdir()
names=['server/tests/helpers/qcGateFixture.js','server/tests/contracts/startup_readiness_context.test.js','server/utils/startupReadinessContext.js']
for name in names:
 b=(R/name).read_bytes();(D/(pathlib.Path(name).name+'.before-original')).write_bytes(b)
p=R/names[0];s=p.read_text(encoding='utf-8')
s=s.replace('async function qcGateFixture({ count = 1,','async function qcGateFixture({ managedStartup = false, count = 1,',1)
old="const historical = beforeGuards({ actor: username, schemaVariant: 'PRE_1_3_SAMPLE_CODES', relatedRows: {"
assert s.count(old)==1
s=s.replace(old,"const historical = beforeGuards({ actor: username, ...(managedStartup ? { installWorkflowStateGuards: true } : { schemaVariant: 'PRE_1_3_SAMPLE_CODES' }), relatedRows: {")
old='''    historical.applyPendingMigration({ migration: 'SAMPLE_CODES' });
    const connection = new Database(file, { fileMustExist: true });
    try { connection.exec('CREATE TABLE "_schema_migrations" ("id" TEXT PRIMARY KEY NOT NULL,"appliedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,"details" TEXT)'); }
    finally { connection.close(); }'''
assert s.count(old)==1
s=s.replace(old,'''    if (!managedStartup) {
        historical.applyPendingMigration({ migration: 'SAMPLE_CODES' });
        const connection = new Database(file, { fileMustExist: true });
        try { connection.exec('CREATE TABLE "_schema_migrations" ("id" TEXT PRIMARY KEY NOT NULL,"appliedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,"details" TEXT)'); }
        finally { connection.close(); }
    }''')
p.write_bytes(s.encode())
p=R/names[1];s=p.read_text(encoding='utf-8');old='qcGateFixture({ resolvedRules: false, fixedWindowPolicy: false })';assert s.count(old)==1;s=s.replace(old,'qcGateFixture({ managedStartup: true, resolvedRules: false, fixedWindowPolicy: false })');p.write_bytes(s.encode())
p=R/'WP/backlog-resume-20261013/verify-startup-managed-context-focused-once.py';assert not p.exists()
s=(R/'WP/backlog-resume-20261013/verify-startup-private-context-focused-once.py').read_text(encoding='utf-8').replace('private-context-focused-once','managed-context-focused-once');p.write_bytes(s.encode())
(D/'preparation.json').write_text(json.dumps({'status':'NEW_FIXTURE_ONLY_SUCCESSOR','beforeFailedRun':'private-context-focused-once','failedTotals':{'suites':3,'tests':17,'passed':12,'failed':5},'runtimeSourceUnchanged':True,'existingPolicyChartOrderTestsUnchanged':True,'defaultFixtureUnchanged':True,'managedFixtureUsesActualWorkflowInstaller':True,'after':{n:hashlib.sha256((R/n).read_bytes()).hexdigest() for n in names}},indent=2),encoding='utf-8')
print(json.dumps({'status':'MANAGED_FIXTURE_SUCCESSOR_PREPARED','runtimeSourceChanged':False}))
