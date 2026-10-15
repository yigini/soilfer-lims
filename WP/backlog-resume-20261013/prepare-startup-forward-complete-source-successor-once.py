"""SOURCE ONLY: new startup graph from accepted080000 records; no operator is invoked."""
import ast,hashlib,json,pathlib,re,subprocess
REPO=pathlib.Path(__file__).resolve().parents[2];OLD=REPO/'WP/batch-proof-forward-resume-cde8-20261015';NEW=REPO/'WP/batch-proof-startup-forward-cde8-20261015'
assert not NEW.exists();NEW.mkdir();PRIOR='dd496777400e9c2f4f0ace73009f8cf8c86022d0';PREFIX='WP/batch-proof-forward-resume-cde8-20261015/first-proof-080000-closed-readiness-stop/'
def raw(head,path):
 row=subprocess.check_output(['git','ls-tree','-z',head,'--',path],cwd=REPO).rstrip(b'\0');meta,returned=row.split(b'\t');mode,kind,oid=meta.decode().split();assert kind=='blob' and returned.decode()==path
 b=subprocess.check_output(['git','cat-file','blob',oid],cwd=REPO);assert hashlib.sha1(('blob '+str(len(b))+'\0').encode()+b).hexdigest()==oid
 return b,{'path':path,'bytes':len(b),'sha256':hashlib.sha256(b).hexdigest(),'blob':oid}
def put(n,s):
 with (NEW/n).open('xb') as f:f.write(s.encode() if isinstance(s,str) else s)
def old(n):return (OLD/n).read_text(encoding='utf-8')
names=['proof_budget.py','proof_contract.py','proof_files.py','proof_disk.py','proof_docker.py','proof_health.py','proof_inputs.py','proof_startup.py','run_stopped_proof.py','prepare_proof.py','launch_proof.py','verify_proof_guards.py']
roles={
 'prior-closed-retention.json':'closed-retention-record.json',
 'prior-proof-terminal-refusal.json':'remote-originals/proof-terminal-refusal.json',
 'prior-proof-input.json':'remote-originals/proof-input.json',
 'prior-tooling-source-index.json':'remote-originals/tooling-source-index.json',
 'prior-source-review-original.json':'remote-originals/source-review-original.json',
 'prior-installed-209--seal.json':'remote-originals/installed-209/seal.json',
 'prior-installed-209--logical-state.json':'remote-originals/installed-209/logical-state.json',
 'prior-installed-209--raw--copy-authority.json':'remote-originals/installed-209/raw/copy-authority.json',
 'prior-installed-209--reader--copy-authority.json':'remote-originals/installed-209/reader/copy-authority.json',
 'prior-preservation-214.json':'remote-originals/preservation-214.json',
 'prior-preservation-209.json':'remote-originals/preservation-209.json',
 'prior-stage-214.json':'remote-originals/stage-214.json',
 'prior-stage-209.json':'remote-originals/stage-209.json',
 'prior-installation-result.json':'remote-originals/installation-result.json',
 'prior-actual-chart-impact.json':'remote-originals/actual-chart-impact.json',
 'prior-actual-order-impact.json':'remote-originals/actual-order-impact.json',
 'prior-assets-snapshot-handoff.json':'remote-originals/prior-assets-snapshot-handoff.json',
 'prior-fresh-actual-baseline.json':'remote-originals/prior-fresh-actual-baseline.json',
 'prior-carried-forward-inputs.json':'remote-originals/carried-forward-inputs.json',
}
pins={};(NEW/'bound-input-records').mkdir()
for n,path in roles.items():
 b,pin=raw(PRIOR,PREFIX+path);pins[n]=pin;(NEW/'bound-input-records'/n).write_bytes(b)
compose,compose_pin=raw('cde8c8896f5f9d5f1ab07b0ae16b1a765e0a6367','docker-compose.yml');put('compose-source.yml',compose)
for n in ['proof_files.py','proof_disk.py']:put(n,(OLD/n).read_bytes())
s=old('proof_budget.py');a=s.index('STAGES=(');b=s.index('# A count',a)
s=s[:a]+"STAGES=(\n    ('startup-1',{'clone':1,'triple':2,'backup':1,'assets':1,'startup-policy-chain':1}),\n    ('startup-2',{'clone':1,'triple':2,'backup':1,'assets':1,'startup-policy-chain':1}),\n)\n"+s[b:]
s=s.replace("CLI_SITE={'install_lab_policy_schema.js':'cli-policy','install_control_charts.js':'cli-charts','install_order_revisions.js':'cli-orders','order_revision_impact.js':'cli-order-impact'}","CLI_SITE={}")
s=s.replace("    'proof_install.py':{('install','clone_backup'):1,('install','seal'):1},\n",'').replace("    'proof_resume.py':{('prepare_resume','copy_triple'):1},","    'proof_inputs.py':{},\n    'proof_health.py':{},")
put('proof_budget.py',s)
s=old('proof_contract.py').replace("ROOT_NAME='workflow-batch-stopped-copy-cde8c889-20261015T080000Z'","ROOT_NAME='workflow-batch-startup-forward-cde8c889-20261015T090000Z'")
s=s.replace("SCOPE='BOUND_070000_RAW206_FORWARD_214_209_JOBS_OFF_STARTUP_ONLY'","SCOPE='BOUND_080000_INSTALLED209_TWO_NEW_JOBS_OFF_STARTUPS_ONLY'")
s=re.sub(r'^FILES=.*$', 'FILES=frozenset('+repr(set(names))+')',s,flags=re.M);s=re.sub(r'^CHAIN=.*$','CHAIN=[]',s,flags=re.M)
s=s.replace('FORWARD_DIRECTION=6184928681','FORWARD_DIRECTION=6187223904').replace("PRIOR_EVIDENCE='e283e6a8747598c1d5d447059c879042f5c3377e'","PRIOR_EVIDENCE='"+PRIOR+"'")
s=s.replace("PRIOR_ROOT=pathlib.PurePosixPath('/opt/lims/releases/workflow-batch-stopped-copy-cde8c889-20261015T070000Z')","PRIOR_ROOT=pathlib.PurePosixPath('/opt/lims/releases/workflow-batch-stopped-copy-cde8c889-20261015T080000Z')")
s=s.replace("PRIOR_RAW_DATA=str(PRIOR_ROOT/'installed-206/raw')","PRIOR_RAW_DATA=str(PRIOR_ROOT/'installed-209/raw')\nPRIOR_BACKUP=str(PRIOR_ROOT/'installed-209/backup.db')")
s=s.replace("PRIOR_RAW_ASSETS=str(PRIOR_ROOT/'raw-production-assets')","PRIOR_RAW_ASSETS='/opt/lims/releases/workflow-batch-stopped-copy-cde8c889-20261015T070000Z/raw-production-assets'")
s=re.sub(r'^PRIOR_FILES=.*$','PRIOR_FILES='+repr(pins),s,flags=re.M);s=s.replace('PRIOR_FILES_SHA=','COMPOSE_PIN='+repr(compose_pin)+'\nPRIOR_FILES_SHA=',1)
s=s.replace("'forwardRaw206InputOnly=true','no206OrPolicyReplay=true'","'startupOnlyInstalled209Inputs=true','noInstallerOrPolicyReplay=true','deriveHealthcheckFromPinnedCompose=true','exactDerivedDockerHealthcheckBeforeStart=true','unhealthyImmediateStop=true','composeSourceSha256='+COMPOSE_PIN['sha256'],'composeSourceBlob='+COMPOSE_PIN['blob']")
s=s.replace("'repeat206Evaluation=AFTER_CLOSURE_SEAL_AND_RETAINED_FILES_NOT_UNSEALED_TUPLES',",'')
s=s.replace('review.get(\'id\',0)>6184928681',"review.get('id',0)>6187223904").replace("'2026-10-15T05:11:07Z'","'2026-10-15T07:50:16Z'")
put('proof_contract.py',s)
put('proof_health.py','''"""Parse pinned Compose health bytes; derive exact Docker CLI representation."""
import json,pathlib,re,shlex
from proof_contract import COMPOSE_PIN,require,sha

def derive_healthcheck(raw,pin=COMPOSE_PIN):
    require(isinstance(raw,bytes) and len(raw)==pin['bytes'] and sha(raw)==pin['sha256'],'Pinned Compose bytes changed')
    import hashlib
    require(hashlib.sha1(('blob '+str(len(raw))+'\\0').encode()+raw).hexdigest()==pin['blob'],'Pinned Compose Git blob changed')
    text=raw.decode('utf-8').replace('\\r\\n','\\n');matches=list(re.finditer(r'^    healthcheck:\\n((?:      [^\\n]*\\n)+)',text,re.M))
    require(len(matches)==1 and 'services:\\n  lims:\\n' in text,'Single bound lims healthcheck block required')
    values={}
    for line in matches[0][1].splitlines():
        key,value=line[6:].split(':',1);require(key not in values,'Duplicate Compose health key');values[key]=value.strip()
    require(set(values)=={'test','interval','timeout','retries','start_period'},'Complete exact Compose health fields required')
    test=json.loads(values['test']);require(isinstance(test,list) and len(test)>1 and test[0]=='CMD' and all(isinstance(v,str) and v for v in test),'Bound exec-form health command required')
    factors={'ns':1,'us':1000,'ms':1000000,'s':1000000000,'m':60000000000,'h':3600000000000}
    def duration(value):
        m=re.fullmatch(r'([1-9][0-9]*)(ns|us|ms|s|m|h)',value);require(m is not None,'Bound positive duration required');return int(m[1])*factors[m[2]]
    require(values['retries'].isdecimal() and int(values['retries'])>0,'Positive retry count required')
    # docker/cli normalizes --health-cmd to CMD-SHELL. exec+shlex preserves the
    # exact argv parsed from Compose, with no retyped probe or duration values.
    command='exec '+shlex.join(test[1:])
    expected={'Test':['CMD-SHELL',command],'Interval':duration(values['interval']),'Timeout':duration(values['timeout']),'Retries':int(values['retries']),'StartPeriod':duration(values['start_period'])}
    flags=['--health-cmd',command,'--health-interval',values['interval'],'--health-timeout',values['timeout'],'--health-retries',values['retries'],'--health-start-period',values['start_period']]
    return {'composePin':dict(pin),'composeTest':test,'expectedDockerHealthcheck':expected,'createFlags':flags,'cliExecRepresentationDerivedNotLiteralComposeArray':True}

def load_health(root):return derive_healthcheck((pathlib.Path(root)/'compose-source.yml').read_bytes())

def assert_healthcheck(actual,derived):
    expected=derived['expectedDockerHealthcheck'];require(isinstance(actual,dict),'Healthcheck absent: STOP before start')
    require(set(actual) in [set(expected),set(expected)|{'StartInterval'}] and actual.get('StartInterval',0)==0,'Unexpected Docker health field/default')
    require(all(type(actual.get(k)) is type(v) and actual[k]==v for k,v in expected.items()),'Derived Docker healthcheck mismatch: STOP before start')
    return expected

def readiness_status(state):
    health=state.get('Health');require(isinstance(health,dict),'Running container missing health state')
    status=health.get('Status');require(status in ['starting','healthy','unhealthy'],'Unknown health state')
    require(status!='unhealthy','Unhealthy: immediate readiness STOP')
    return status
''')
put('proof_inputs.py','''"""Pinned080000 installed209 inputs. Only hashes/stat/recorded state, never old SQL."""
from proof_contract import *
from proof_files import file_state,triple,tree_state,identity_record,write_new

def prior_records(root):
    values={}
    for name,pin in PRIOR_FILES.items():
        p=pathlib.Path(root)/name;raw=p.read_bytes();require(not p.is_symlink() and len(raw)==pin['bytes'] and sha(raw)==pin['sha256'],'Bound080000 input bytes differ '+name);values[name]=exact_json(raw)
    validate_records(values);return values

def validate_records(v):
    require(set(v)==set(PRIOR_FILES),'Complete bound080000 evidence required')
    closed=v['prior-closed-retention.json'];refusal=v['prior-proof-terminal-refusal.json'];seal=v['prior-installed-209--seal.json'];state=v['prior-installed-209--logical-state.json']
    require(closed['root']==str(PRIOR_ROOT) and closed['originalRefusal']==refusal and refusal['closedUtc']=='2026-10-15T07:30:46.830553+00:00' and refusal['error']=='RuntimeError: 600-second readiness STOP' and refusal['ownedStopError'] is None,'Exact consumed080000 failure required')
    require(closed['packageUnchanged'] and closed['allHistoricalStoppedContainersPreserved'] and len(closed['newOwnedContainersStoppedRetained'])==9 and all(r['running'] is False for r in closed['newOwnedContainersStoppedRetained'].values()),'Bound retained containers/package differ')
    spec=v['prior-proof-input.json'];source=v['prior-tooling-source-index.json'];review=v['prior-source-review-original.json']
    require(spec['root']==str(PRIOR_ROOT) and spec['toolingCommit']==source['head']=='b9af37993632ca10b56943ae894fc0a816b8efcc' and spec['sourceReviewId']==review['id']==6185240820 and first_line(review['body'])=='Source review: PASS' and review['performed_via_github_app']['slug']=='claude','Prior exact authority differs')
    require(spec['head']==CANDIDATE and spec['tree']==TREE and spec['image']==IMAGE and spec['labAndHubBuildsOwnedByYY'] is True and spec['releaseWindowControl']=='RELEASE_DAY_DISK_ABORTS_ACCEPTED','Bound app/image/YY pins differ')
    props=dict(l.split('=',1) for l in closed['systemctlOriginal'].splitlines() if '=' in l);require(props['InvocationID']=='0cb103307f4240689a630b3666545772' and props['ActiveState']=='failed' and props['ExecMainStatus']=='1' and props['MemoryMax']==str(MEMORY) and props['MemorySwapMax']=='0','Prior executed identity/limits differ')
    for issue,receipts in [('214',41),('209',42)]:
        stage=v['prior-stage-'+issue+'.json'];preserved=v['prior-preservation-'+issue+'.json']
        for mode,key in [('DRY_RUN','dry'),('APPLIED','apply'),('NO_OP','repeat')]:plan(stage[key],issue,mode)
        require(stage['dryByteIdentity']['mainSha256AndLengthEqual'] and stage['repeatByteIdentity']['mainSha256AndLengthEqual'] and stage['repeatByteIdentity']['walAbsentEmptyEquivalentOrNonemptyExact'],'Prior identity guard missing')
        require(preserved==stage['preservation'] and preserved['allOriginalRowsAndReceiptsPreserved'] and preserved['priorStateFromBoundRecordNoSql'] and preserved['totalTables']==112 and preserved['schemaReceiptCount']==receipts and preserved['backfilledCount']==0,'Accepted installation preservation differs')
    require(v['prior-installation-result.json']['status']=='OWNED_COPY_INSTALLATION_PASS' and v['prior-installation-result.json']['productionMutations']==0,'Bound installation result differs')
    impact_gate(v['prior-actual-order-impact.json'])
    require(seal['rawMaster']==str(PRIOR_ROOT/'installed-209/raw/dev.db') and seal['backup']==PRIOR_BACKUP and seal['rawMasterNeverOpenedSqlite'] and seal['countsIncludeWal'],'Installed209 input boundary differs')
    require(sha(canonical(state))==seal['logicalStateSha256'] and len(state['tables'])==112 and state['tables']['_schema_migrations']['count']==42 and state['integrity']=='ok' and state['foreignKeyViolations']==0,'Recorded11242 logical state differs')
    rows={r['path']:r for r in closed['rootFileInventoryWithStableHashes']};require(len(rows)==closed['rootFileCount']==4517,'Full closed input inventory required')
    require(rows['installed-209/backup.db']['sha256']==seal['backupSha256'] and rows['installed-209/raw/dev.db']['sha256']==seal['originalFiles']['']['sha256'] and rows['installed-209/reader/dev.db']['sha256']==seal['originalFiles']['']['sha256'],'Raw/reader/backup record identity differs')
    require(identity_record(v['prior-installed-209--raw--copy-authority.json']['originalFiles'])==identity_record(seal['originalFiles']),'Raw copy authority differs')
    require(v['prior-assets-snapshot-handoff.json']['databaseAssetsCrossFileAtomicityClaimed'] is False if 'databaseAssetsCrossFileAtomicityClaimed' in v['prior-assets-snapshot-handoff.json'] else True,'No cross-file atomicity')
    return rows

def retained_guard(v):
    rows=validate_records(v);paths=[]
    for directory,base in [('installed-209','backup.db'),('installed-209/raw','dev.db'),('installed-209/reader','dev.db')]:paths.extend(directory+'/'+base+s for s in ['', '-wal','-shm'])
    paths.extend(v['prior-proof-input.json']['packageHashes'])
    for rel in paths:
        expected=rows.get(rel);actual=file_state(pathlib.Path(PRIOR_ROOT)/rel);require(actual==(None if expected is None else {k:value for k,value in expected.items() if k!='path'}),'Retained prior input changed '+rel)
    raw=triple(pathlib.Path(PRIOR_RAW_DATA)/'dev.db');require(raw['']['mode']==0o400 and identity_record(raw)==identity_record(v['prior-installed-209--seal.json']['originalFiles']),'Sealed209 raw identity differs')
    assets=tree_state(PRIOR_RAW_ASSETS);require(identity_record(assets['files'])==v['prior-assets-snapshot-handoff.json']['rawCopyByteIdentity'],'Retained070000 asset handoff differs')
    return raw,assets

def record_inputs(root,v):
    retained_guard(v);write_new(pathlib.Path(root)/'carried-forward-inputs.json',{'status':'BOUND_INSTALLED209_STARTUP_ONLY_INPUTS_NO_SQL','priorEvidenceCommit':PRIOR_EVIDENCE,'priorRoot':str(PRIOR_ROOT),'inputCopies':0,'newProductionSnapshots':0,'installerOrPolicyCalls':0,'inputSqlConnections':0,'stateValidatedByRecordedHashes':True,'installed209Seal':v['prior-installed-209--seal.json'],'accepted214Preservation':v['prior-preservation-214.json'],'accepted209Preservation':v['prior-preservation-209.json'],'actualChartCounts':v['prior-actual-chart-impact.json']['counts'],'actualOrderImpact':v['prior-actual-order-impact.json'],'jobsOnQualificationStillRequired':True})
    return pathlib.Path(PRIOR_BACKUP),v['prior-installed-209--logical-state.json']
''')
s=old('proof_docker.py').replace('from proof_budget import CLI_SITE','from proof_budget import CLI_SITE\nfrom proof_health import load_health,assert_healthcheck')
s=re.sub(r'^SCRIPTS=.*$','SCRIPTS=set()',s,flags=re.M)
s=s.replace("    require(re.fullmatch('[a-z0-9-]+',label)","    require(script is None and mode is None,'Startup-only source forbids installer/policy/collector calls')\n    require(re.fullmatch('[a-z0-9-]+',label)",1)
s=s.replace("assets=child_path(root,assets);args+=", "assets=child_path(root,assets);args+=load_health(root)['createFlags'];args+=")
s=s.replace("        return v\n    def stop", "        assert_healthcheck(v['Config'].get('Healthcheck'),load_health(self.root))\n        return v\n    def stop")
put('proof_docker.py',s)
s=old('proof_startup.py').replace('from proof_docker import inspect','from proof_docker import inspect\nfrom proof_health import readiness_status,load_health,assert_healthcheck')
s=s.replace("disk.check();v=docker.validate(id,owner,data,tmp,True)\n                if v['State'].get('Health',{}).get('Status')=='healthy':", "disk.check();v=docker.validate(id,owner,data,tmp,True)\n                if v['State'].get('Health',{}).get('Status') not in ['starting','healthy']:\n                    write_new(root/(label+'-readiness-refusal-health-state.json'),{'state':v['State'],'healthcheck':v['Config'].get('Healthcheck'),'immediateStop':True,'neverRetry':True})\n                status=readiness_status(v['State'])\n                if status=='healthy':")
s=s.replace("        write_new(root/(label+'-default-entrypoint-attempt.json')", "        assert_healthcheck(inspect(id)['Config'].get('Healthcheck'),load_health(root))\n        write_new(root/(label+'-default-entrypoint-attempt.json')")
put('proof_startup.py',s)
s=old('prepare_proof.py').replace("REL='WP/batch-proof-forward-resume-cde8-20261015/'","REL='WP/batch-proof-startup-forward-cde8-20261015/'")
s=s.replace("    manifest=exact_json(files['source-index.json']);", "    compose,meta=raw_git(CANDIDATE,COMPOSE_PIN['path']);require(meta=={k:COMPOSE_PIN[k] for k in ['bytes','sha256','blob']},'Pinned Compose source changed');files['compose-source.yml']=compose\n    manifest=exact_json(files['source-index.json']);")
s=s.replace("application=['server/scripts/install_sample_containers.js','Dockerfile'", "application=['docker-compose.yml','server/scripts/install_sample_containers.js','Dockerfile'")
put('prepare_proof.py',s)
s=old('launch_proof.py').replace("'current-evidence.json'}","'current-evidence.json','compose-source.yml'}")
put('launch_proof.py',s)
s=old('run_stopped_proof.py').replace('from proof_install import install\n','').replace('from proof_resume import prior_records,retained_guard,prepare_resume','from proof_inputs import prior_records,retained_guard,record_inputs\nfrom proof_health import load_health')
s=s.replace("'current-evidence.json'}","'current-evidence.json','compose-source.yml'}")
s=s.replace("        disk.bind(db_bytes,assets['allocatedBytes']);disk.begin_stage('forward-input')\n        target,previous,previous_state=prepare_resume(root,disk,inputs);disk.finish_stage('forward-input')\n        installed,installed_state=install(root,target,previous,previous_state,docker,disk)","        backup_state=file_state(PRIOR_BACKUP);db_bytes=max(db_bytes,max(backup_state['allocatedBytes'],((backup_state['bytes']+4095)//4096)*4096))\n        disk.bind(db_bytes,assets['allocatedBytes']);installed,installed_state=record_inputs(root,inputs)\n        write_new(root/'derived-healthcheck.json',load_health(root))")
s=s.replace('FORWARD_214_209_INSTALLATION_AND_JOBS_OFF_STARTUP_PASS_NOT_RELEASE_QUALIFIED','FORWARD_TWO_JOBS_OFF_STARTUPS_PASS_FROM_BOUND_INSTALLED209_NOT_RELEASE_QUALIFIED')
s=s.replace("'newPolicyOr206InstallerCalls':0,'inputRaw206NotBackup':True,'accepted206RepeatEvaluationAfterClosureNotOriginalTuples':True", "'newInstallerOrPolicyCalls':0,'installed209InputsByHashStatOnly':True,'derivedHealthcheck':load_health(root)")
put('run_stopped_proof.py',s)
# Carry applicable authority/accounting/file/name/WAL guards, excluding removed
# old206 resume/installer fixture cases. New input/health integration cases follow.
s='\n'.join(old('verify_proof_guards.py').splitlines()[:513])+'\n'
s=s.replace('from proof_install import install\n','')
tree=ast.parse(s);remove={'test_retained_argv','test_carried_absent_policy_refused_before_forward_install','inventory_create_boundary','test_absent_inventory_reaches_only_mocked_create_boundary','test_existing_name_stops_before_create_and_retains_inventory'};lines=s.splitlines(keepends=True)
for node in sorted([n for n in ast.walk(tree) if isinstance(n,ast.FunctionDef) and n.name in remove],key=lambda n:n.lineno,reverse=True):del lines[node.lineno-1:node.end_lineno]
s=''.join(lines).replace('6185000001','6188000001').replace('2026-10-15T05:30:00Z','2026-10-15T08:00:00Z').replace('2026-10-15T05:31:00Z','2026-10-15T08:01:00Z').replace('2026-10-15T05:32:00Z','2026-10-15T08:02:00Z')
reference=10556150894+4294967296+30*567558144+3*5787648
s=s.replace('46084179054',str(reference)).replace('46084179053',str(reference-1)).replace("'dbEquivalents':55","'dbEquivalents':30").replace("v['dbEquivalents']=54","v['dbEquivalents']=29").replace('(44,2,55)','(24,2,30)').replace("'forward-input'","'startup-1'").replace("record['declaredDbCopies'],44","record['declaredDbCopies'],24").replace("sources['proof_install.py']","sources['proof_inputs.py']").replace('dbBudgetEquivalents=55','dbBudgetEquivalents=30')
s=s.replace("b.begin('startup-1',b.required());b.claim('triple')","b.begin('startup-1',b.required());b.claim('triple');b.claim('triple')")
put('verify_proof_guards.py',s)
put('bound-prior-evidence-index.json',json.dumps({'commit':PRIOR,'files':pins,'scopeDirection':6187223904,'composePin':compose_pin},indent=2)+'\n')
put('SOURCE_PREPARATION_ONLY.json',json.dumps({'status':'NEW_STARTUP_ONLY_SOURCE_GRAPH_PREPARED_NOT_YET_TESTED_PUBLISHED_OR_APPROVED','sourceDirection':6187223904,'priorEvidence':PRIOR,'root':'/opt/lims/releases/workflow-batch-startup-forward-cde8c889-20261015T090000Z','operationalExecutions':0,'productionMutations':0,'oldSourceChanged':False,'newRootCreated':False,'pythonFiles':names,'next':'Complete health/input tests and local+host pure-guard verification; new exact all-hash source review before any operator.'},indent=2)+'\n')
print(json.dumps({'status':'NEW_SOURCE_ONLY_STARTUP_GRAPH_PREPARED_UNTESTED','folder':str(NEW),'pythonFiles':len(names),'boundPriorPins':len(pins),'operatorsRun':0,'hostMutations':0}))
