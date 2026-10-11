"""Independent read-only verification of a completed, newly audited forward run."""
import datetime,json,pathlib,stat,subprocess,sys
ROOT=pathlib.Path(sys.argv[1]);UNIT=sys.argv[2];sys.path.insert(0,str(ROOT))
import release_support as s
import startup_common as c

def run(args):return subprocess.check_output(args,text=True,timeout=120).strip()
rfile=ROOT/'production-receipt.json';original=s.sha(rfile);r=json.loads(rfile.read_bytes())
assert r['status']=='DEPLOYED_FORWARD' and r['head']==s.HEAD and r['image']==c.IMAGE
assert stat.S_IMODE(rfile.stat().st_mode)==0o400
assert run(['systemctl','show',UNIT,'--value','-p','ActiveState'])=='inactive'
assert run(['systemctl','show',UNIT,'--value','-p','ExecMainStatus'])=='0'
m=json.loads((ROOT/'prepared-manifest.json').read_bytes())
assert s.sha(ROOT/'prepared-manifest.json')==r['manifestSha256']
for name,want in m['files'].items():assert s.sha(ROOT/name)==want
assert s.sha(ROOT/'dev-installed-stopped-backup.db')==r['backupSha256']
assert s.sha(ROOT/'assets-installed-backup.tar.gz')==r['assetsBackupSha256']
assert s.sha(c.ORIGIN/'production-receipt.json')==c.FAILURE_SHA
old=json.loads((c.ORIGIN/'prepared-manifest.json').read_bytes())
for name,want in old['files'].items():assert s.sha(c.ORIGIN/name)==want
live=c.inspect('soilfer-lims');c.state_guard(live,True)
assert live['State']['Health']['Status']=='healthy'
expected=json.loads((ROOT/'protected-state.json').read_bytes());kobo=json.loads((ROOT/'normal-jobs-baseline.json').read_bytes());normal=c.jobs_copy_state(s.LIVE,expected,kobo)
physical=s.physical(s.LIVE);accept=s.verify_retained_acceptance(s.LIVE.parent)
assert accept==r['retainedAcceptance']
assert r['databaseChangesBeforeJobs']==0 and r['mainDatabaseBytesPreservedBeforeJobs'] and r['separateInstallerCommands']==0
assert r['apiChecks']=={'passed':31,'total':31,'failed':0} and len(r['probes'])==6
for stage in ['jobsOffChecks','jobsOnChecks']:
 assert len(r[stage]['entrypointInstallers'])==22 and r[stage]['startupChanges']==0
 assert all(x['mode']=='NO_OP' and x['totalChanges']==0 for x in r[stage]['entrypointInstallers'])
 assert 0<r[stage]['startupMemory']['peakBytes']<=c.LIMIT
checks={}
for path,method,want in [('/api/health','GET',200),('/login','GET',200),('/','GET',200),('/api/v2/data-exchange/receipts','POST',401)]:
 code=run(['curl','-sS','--max-time','15','-o','/dev/null','-w','%{http_code}','-X',method,'https://lims.yigini.net'+path]);assert code==str(want);checks[method+' '+path]=int(code)
health=json.loads(run(['curl','-fsS','--max-time','15','https://lims.yigini.net/api/health']));assert health['status']=='ok'
assert 'R=503' not in s.CONF.read_text() and s.sha(s.CONF)==m['files']['apache-before.conf']
assert min(s.disk_free().values())>=r['diskReserveRequiredBytes']
assert s.sha(rfile)==original
result={'status':'INDEPENDENT_READ_ONLY_PASS','verifiedUtc':s.utc(),'head':s.HEAD,'image':c.IMAGE,'productionReceiptSha256':original,
 'containerHealthy':True,'restartCount':live['RestartCount'],'oomKilled':False,'sameDataAndAssetsVolumes':True,
 'jobsEnabled':True,'ingressOpen':True,'autoPushAndSeedDisabled':True,'protectedTableCount':len(expected['tables']),
 'protectedReceiptCount':expected['tables']['_schema_migrations']['count'],'allProtectedRowsFieldsEqualBeforeJobs':True,'normalJobsBoundary':normal,
 'integrity':'ok','foreignKeyViolations':0,'retainedAcceptance':accept,'physical':physical,'health':health,
 'httpsChecks':checks,'freeBytes':s.disk_free(),'reserveRequiredBytes':r['diskReserveRequiredBytes'],
 'originalFailedReceiptUnchanged':True,'originalFrozenFilesUnchanged':len(old['files'])}
print(json.dumps(result,indent=2))