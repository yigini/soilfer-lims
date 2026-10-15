"""After full closure, retain before bytes, diagnose isolated CLI, fix new runtime adapters."""
import datetime, hashlib, json, os, pathlib, subprocess, uuid
R=pathlib.Path(__file__).resolve().parents[2]; D=R/'WP/startup-order-readiness-20261015/closed-guard-source-successor-once'
assert not D.exists()
full=R/'WP/startup-order-readiness-20261015/full-ordinary-once'
summary=json.loads((full/'summary.json').read_bytes())
assert summary['closedUtc']=='2026-10-15T11:44:21.283845+00:00' and summary['failed']==2 and summary['sourceUnchanged']
assert subprocess.check_output(['git','rev-parse','HEAD'],cwd=R).decode().strip()=='787aa5692996a108120b510efa0154d7a74da85e'
frozen=json.loads((full/'source-after.json').read_bytes())
assert all(hashlib.sha256((R/n).read_bytes()).hexdigest()==v for n,v in frozen.items())
app=json.loads((R/'WP/startup-order-readiness-20261015/private-context-focused-and-full-open-publication-index.json').read_bytes())['appPaths']
names=app+['server/tests/helpers/workflowWriteScanner.js']
D.mkdir()
for name in names:
    output=D/'source-before'/name; output.parent.mkdir(parents=True,exist_ok=True); output.write_bytes((R/name).read_bytes())
diagnostic=R/'server/tests/.tmp'/('startup-cli-context-diagnostic-'+str(uuid.uuid4()))
for part in ['scripts','services']: (diagnostic/part).mkdir(parents=True,exist_ok=False)
for name in ['scripts/install_workflow_state_guards.js','services/workflowMigrationSources.js']:
    (diagnostic/name).write_bytes((R/'server'/name).read_bytes())
target=diagnostic/'never-opened-owned.db'
env=dict(os.environ);env.update(NODE_ENV='test',DATABASE_PATH=str(target),DATABASE_URL='file:'+str(target))
command=['node',str(diagnostic/'scripts/install_workflow_state_guards.js'),'--db',str(target)]
with (D/'isolated-cli-before-stdout-original.log').open('xb') as out,(D/'isolated-cli-before-stderr-original.log').open('xb') as err:
    result=subprocess.run(command,cwd=R/'server',env=env,stdout=out,stderr=err)
stderr=(D/'isolated-cli-before-stderr-original.log').read_text(encoding='utf-8')
assert result.returncode==1 and "Cannot find module '../utils/startupReadinessContext'" in stderr and 'MODULE_NOT_FOUND' in stderr
assert not target.exists()
record={'observedUtc':datetime.datetime.now(datetime.timezone.utc).isoformat(),'diagnosticDirectory':str(diagnostic),
    'argv':command,'exitCode':result.returncode,'freshOwnedDiagnosticNotOriginalChildStderr':True,
    'verifiedCause':'New top-level context require is absent in the deliberately isolated installer copy, before CLI JSON catch.',
    'databaseCreatedOrOpened':False,'fullResult':summary,'sourceBeforePaths':names,'productionOperations':0}
(D/'verified-dependency-cause-before-correction.json').write_text(json.dumps(record,indent=2),encoding='utf-8')
needle="const { openReadonlyDatabase } = require('../utils/startupReadinessContext');"
replacement="""// The optional startup context must not become a default CLI/image-copy dependency.
function openReadonlyDatabase(Database, target, options, startupContext) {
    return startupContext
        ? require('../utils/startupReadinessContext').openReadonlyDatabase(Database, target, options, startupContext)
        : new Database(target, options);
}"""
installers=[R/n for n in app if n.startswith('server/scripts/install_')]
assert len(installers)==26 and all(p.read_text(encoding='utf-8').count(needle)==1 for p in installers)
for file in installers:
    text=file.read_text(encoding='utf-8');file.write_bytes(text.replace(needle,replacement).encode())
file=R/'server/utils/startupReadinessContext.js';text=file.read_text(encoding='utf-8')
old="""                        if (name !== 'integrity_check' && name !== 'foreign_key_check') return db.pragma(sql, pragmaOptions);
                        // Some owners request the full rows, others the first
                        // value. Retain one full result and preserve both views.
                        if (!checks.has(name)) checks.set(name, db.pragma(sql));"""
new="""                        // This private facade accepts only the two startup
                        // checks. SQL stays literal and visible to the scanner.
                        if (name !== 'integrity_check' && name !== 'foreign_key_check')
                            throw new TypeError('The startup context supports only integrity and foreign-key checks.');
                        if (!checks.has(name)) checks.set(name, name === 'integrity_check'
                            ? db.pragma('integrity_check') : db.pragma('foreign_key_check'));
                        // Preserve the owners' full-row and simple result views."""
assert old in text;text=text.replace(old,new)
old="""                    if (key === 'prepare') return (...args) => {
                        if (!firstReadVersion) firstReadVersion = optionalDataHashes(activePath);
                        return db.prepare(...args);
                    };"""
new="""                    if (key === 'prepare' && !firstReadVersion)
                        firstReadVersion = optionalDataHashes(activePath);
                    // Prepared statements use the ordinary bound method. Their
                    // SQL remains visible at each owning installer call site."""
assert old in text;text=text.replace(old,new);file.write_bytes(text.encode())
(D/'runtime-correction-prepared.json').write_text(json.dumps({'changedRuntimePaths':[p.relative_to(R).as_posix() for p in installers]+[file.relative_to(R).as_posix()],
    'defaultCliUsesOriginalNewDatabasePath':True,'contextModuleOnlyRequiredOnOptIn':True,
    'literalPrivatePragmas':True,'noOpaquePreparedSqlForwarding':True,
    'stockTestsUnchanged':True,'testsNotRunYet':True,'productionOperations':0},indent=2),encoding='utf-8')
print(json.dumps({'status':'RUNTIME_SOURCE_CORRECTION_PREPARED_NOT_TESTED','verifiedIsolatedCliCause':True,'installers':len(installers),'beforeBytesRetained':len(names)}))
