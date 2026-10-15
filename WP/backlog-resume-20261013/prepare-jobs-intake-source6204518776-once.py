"""NEW source/fixture preparation only. No SSH, Docker, SQLite, or operators."""
import ast,hashlib,json,pathlib,shutil,subprocess
W=pathlib.Path(__file__).resolve().parents[2]
B=W/'WP/batch-proof-memory-events-be837974-20261015'
D=W/'WP/batch-proof-jobs-intake-be837974-20261016'
H=W/'WP/pr284-resume-20261012/proof-source-export-f5e59428'
assert not D.exists();D.mkdir()
provenance={}
for p in B.glob('*.py'):
 if p.name in {'proof_contract.py','proof_budget.py','proof_app_sources.py','proof_disk.py','proof_docker.py','proof_files.py','proof_health.py','proof_inputs.py','proof_memory.py','proof_render.py','proof_startup.py','prepare_proof.py','launch_proof.py','run_stopped_proof.py','verify_proof_guards.py'}:
  raw=p.read_bytes();(D/p.name).write_bytes(raw);provenance[p.name]={'source':p.relative_to(W).as_posix(),'sha256':hashlib.sha256(raw).hexdigest(),'bytes':len(raw)}
for n in ['application-source-fixtures','new-authority-fixtures','bound-input-records']:
 if (B/n).exists():shutil.copytree(B/n,D/n)
for n in ['capture_kobo_fetch.py','kobo_copy_preservation.py','runtime_proof_policies.py','postflight-roles.cjs','postflight-auth.cjs','postflight-reference.cjs','postflight-qc-runs.cjs','postflight-policy.cjs','readonly-smoke.cjs']:
 raw=(H/n).read_bytes();(D/n).write_bytes(raw);provenance[n]={'source':(H/n).relative_to(W).as_posix(),'sha256':hashlib.sha256(raw).hexdigest(),'bytes':len(raw)}
for n in ['compose-source.yml']:
 if (B/n).exists():(D/n).write_bytes((B/n).read_bytes())
def edit(name,changes):
 p=D/name;s=p.read_text(encoding='utf-8')
 for a,b in changes:
  assert a in s,(name,a[:100]);s=s.replace(a,b)
 p.write_bytes(s.encode())
newfiles=['proof_jobs.py','verify_jobs_guards.py','capture_kobo_fetch.py','kobo_copy_preservation.py','runtime_proof_policies.py','postflight-roles.cjs','postflight-auth.cjs','postflight-reference.cjs','postflight-qc-runs.cjs','postflight-policy.cjs','readonly-smoke.cjs']
edit('proof_contract.py',[
 ("ROOT_NAME='workflow-batch-startup-memory-be837974-20261015T233000Z'","ROOT_NAME='workflow-batch-jobs-intake-be837974-20261016T003000Z'"),
 ("SCOPE='BOUND_080000_INSTALLED209_TWO_NEW_JOBS_OFF_STARTUPS_ONLY'","SCOPE='BOUND_INSTALLED209_NEW_JOBS_ON_NATURAL_INTAKE_AND_BROAD_POSTFLIGHTS'"),
 ("'proof_memory.py'})","'proof_memory.py',"+','.join(repr(n) for n in newfiles)+"})"),
 ("review.get('id',0)>6203416404","review.get('id',0)>6204518776"),
 ("review['created_at']>'2026-10-15T22:16:57Z'","review['created_at']>'2026-10-15T23:36:01Z'"),
 ("'startupOnlyInstalled209Inputs=true'","'boundInstalled209JobsQualificationInputs=true'"),
 ("'budgetMinimum64DroppedForStartupOnlyGraph=true'","'minimum64RetainedForNewJobsGraph=true'"),
 ("'memorySamplesMaximumPerStartup=601'","'memorySamplesMaximumPerContainer=4096'"),
 ("'prior230000ConsumedFailureSha256=","'jobsScopeAcceptedComment=6204518776','jobsScopeAcceptedSha256='+JOBS_SCOPE_SHA,'acceptedStartupReceiptSha256=f9478dd0082a708167ef4569d4496cd50b29995b0e1f610b43517d38701def93','naturalIntakePolicy=ORIGINAL_CURSOR_ACTUAL_UPSTREAM','twoNaturalSyncCompletions=true','healthySoakMinimumSeconds=660','secondSyncAfterConfiguredIntervalPlusTwoMinutes=true','schedulerRefusalPairing=STREAM_ORDER_ONE_TO_ONE','all112Tables42ReceiptsProtected=true','noStandaloneCliContainers=true','sameMemoryEventsPolicyEveryContainer=true','broadPostflights=31_API_CHECKS_PLUS_SIX_READONLY_PROBES','productionRestartExpectedSeveralMinutesMustBeDisclosed=true','prior230000ConsumedFailureSha256=")])
with (D/'proof_contract.py').open('ab') as f:f.write(b"\nJOBS_SCOPE_SHA='f80f7eaadca3e6222be296ff9d5660f1ab84756ed59086fc8f9f37ad88403fff'\ndef jobs_scope_authority(v):\n    require(v.get('id')==6204518776 and v.get('created_at')==v.get('updated_at')=='2026-10-15T23:36:01Z' and sha(canonical(authority_projection(v)))==JOBS_SCOPE_SHA,'Actual accepted startup result and jobs scope changed')\n")
edit('prepare_proof.py',[("REL='WP/batch-proof-memory-events-be837974-20261015/'","REL='WP/batch-proof-jobs-intake-be837974-20261016/'"),("    current(out['main']","    out['jobsScope']=gh('repos/yigini/soilfer-lims/issues/comments/6204518776');jobs_scope_authority(out['jobsScope'])\n    current(out['main']")])
edit('run_stopped_proof.py',[("memory_authority(evidence['memoryDirection'])","memory_authority(evidence['memoryDirection']);jobs_scope_authority(evidence['jobsScope'])"),("from proof_startup import startup","from proof_jobs import qualification"),("startups=startup(root,installed,installed_state,pathlib.Path(PRIOR_RAW_ASSETS),docker,disk,spec['expectedReadyEvents'],spec['expectedEntrypointVerifiers'],lambda:retained_guard(inputs))","startups=qualification(root,installed,installed_state,pathlib.Path(PRIOR_RAW_ASSETS),docker,disk,spec['expectedReadyEvents'],spec['expectedEntrypointVerifiers'],lambda:retained_guard(inputs))"),("FORWARD_TWO_JOBS_OFF_STARTUPS_PASS_FROM_BOUND_INSTALLED209_NOT_RELEASE_QUALIFIED","JOBS_ON_NATURAL_INTAKE_AND_BROAD_POSTFLIGHTS_PASS_NOT_DEPLOYED"),("'jobsOnQualificationStillRequired':True","'jobsOnQualificationStillRequired':False")])
edit('proof_memory.py',[("MAX_SAMPLES_PER_STARTUP=601","MAX_SAMPLES_PER_STARTUP=4096")])
# The complete established sampler and raw-before-evaluation guards stay intact.
# No standalone CLI can execute; postflight children share their monitored app cgroup.
p=D/'proof_docker.py';s=p.read_text();a=s.index('WRAPPER=');z=s.index('def inspect',a);s=s[:a]+"SCRIPTS=set()\n\n"+s[z:]
s=s.replace("assets=None):","assets=None,jobs=False):",2)
s=s.replace("'--network','none'","'--network','bridge' if jobs else 'none'")
s=s.replace("'-e','DISABLE_BACKGROUND_JOBS=true'","'-e','DISABLE_BACKGROUND_JOBS='+('false' if jobs else 'true')")
a=s.index('    if script:\n');z=s.index('    return name,owner,args',a)
s=s[:a]+"    assets=child_path(root,assets);args+=load_health(root)['createFlags'];args+=['-e','JWT_SECRET='+secrets.token_hex(32),'--mount','type=bind,src='+str(assets)+',dst=/app/server/uploads',IMAGE]\n"+s[z:]
s=s.replace("self.created=[]","self.created=[];self.jobs={};self.observer=None")
s=s.replace("def command(self,args,label,timeout=30):","def command(self,args,label,timeout=30,input_bytes=None):")
s=s.replace("process=subprocess.Popen(args,stdout=o,stderr=e)","process=subprocess.Popen(args,stdout=o,stderr=e,stdin=subprocess.PIPE if input_bytes is not None else subprocess.DEVNULL)\n            if input_bytes is not None:\n                require(isinstance(input_bytes,bytes) and len(input_bytes)<=1024**2,'Bounded reviewed postflight input required');process.stdin.write(input_bytes);process.stdin.close()")
s=s.replace("                    self.disk.check();require(time.monotonic()-started<timeout", "                    self.disk.check()\n                    if self.observer is not None:self.observer()\n                    require(time.monotonic()-started<timeout")
s=s.replace("name,owner,args=arguments(self.root,label,data,tmp,script,mode,assets)","name,owner,args=arguments(self.root,label,data,tmp,script,mode,assets,jobs)")
s=s.replace("self.created.append((id,owner));self.validate", "self.created.append((id,owner));self.jobs[id]=jobs;self.validate")
s=s.replace("v['HostConfig']['NetworkMode']=='none'","v['HostConfig']['NetworkMode']==('bridge' if self.jobs.get(id,False) else 'none')")
s=s.replace("'DISABLE_BACKGROUND_JOBS':'true'","'DISABLE_BACKGROUND_JOBS':'false' if self.jobs.get(id,False) else 'true'")
a=s.index('    def cli(');z=s.index('    def stop_all(',a)
s=s[:a]+"    def cli(self,*args,**kwargs):\n        raise RuntimeError('Standalone CLI paths forbidden in this jobs qualification graph')\n"+s[z:]
assert 'releaseCliPeakBytes' not in s;compile(s,str(p),'exec');p.write_bytes(s.encode())
edit('proof_startup.py',[("def startup_log(log,expected_events,expected_verifiers):","def startup_log(log,expected_events,expected_verifiers,jobs=False):"),("require(not any(t in log for t in ['FATAL ERROR','Halting startup','Seeding initial','Initializing database schema','[KOBO_SCHEDULER] Triggering'])","require(not any(t in log for t in ['FATAL ERROR','Halting startup','Seeding initial','Initializing database schema']+([] if jobs else ['[KOBO_SCHEDULER] Triggering']))"),("'jobsEnabled':False}","'jobsEnabled':jobs}")])
# Budget both default chains conservatively at eight policy copies, plus the
# live first-sync consistent backup; min64 is restored for this NEW scope.
edit('proof_budget.py',[("MINIMUM_DB_EQUIVALENTS=0","MINIMUM_DB_EQUIVALENTS=64"),("('startup-2',{'clone':1,'triple':2,'backup':1,'assets':1,'startup-policy-chain':1})","('startup-2',{'clone':1,'triple':2,'backup':2,'assets':1,'startup-policy-chain':1})"),("'proof_inputs.py':{},'proof_health.py':{},'proof_memory.py':{},","'proof_inputs.py':{},'proof_health.py':{},'proof_memory.py':{},\n    'proof_jobs.py':{('jobs_off','clone_backup'):1,('jobs_off','copy_tree'):1,('jobs_off','seal'):1,('jobs_on','clone_backup'):1,('jobs_on','copy_tree'):1,('jobs_on','seal'):1,('consistent_backup','backup'):1},\n    'capture_kobo_fetch.py':{},'kobo_copy_preservation.py':{},'runtime_proof_policies.py':{},")])
# This bound remains a sampled-memory policy, never a peak gate.
edit('runtime_proof_policies.py',[("require(restart_count == 0 and 0 < peak <= LIMIT, 'Restart or memory-limit refusal')","require(restart_count == 0, 'Restart refusal; memory.events and sampled nonreclaimable policy is enforced on host')")])
# Pin the additional actual shipped API postflight source to the new app closure.
p=D/'proof_app_sources.py';s=p.read_text();tree={r.split(b'\t')[1].decode():r.split(b'\t')[0].decode().split() for r in subprocess.check_output(['git','ls-tree','-rz','be8379745bdfae52ce46496ff26514dc7d729640'],cwd=W).split(b'\0') if r}
name='server/scripts/postflight_issue140.cjs';mode,kind,oid=tree[name];raw=subprocess.check_output(['git','cat-file','blob',oid],cwd=W)
addition={name:{'mode':mode,'blob':oid,'bytes':len(raw),'sha256':hashlib.sha256(raw).hexdigest()}}
s=s.replace('APP_PINS_SHA=', 'APP_PINS.update('+repr(addition)+')\nAPP_PINS_SHA=',1);p.write_bytes(s.encode());p=D/'application-source-fixtures'/name;p.parent.mkdir(parents=True,exist_ok=True);p.write_bytes(raw)
(D/'source-preparation-provenance.json').write_bytes(json.dumps({'predecessors':provenance,'acceptedScopeId':6204518776,'sourceOnly':True,'operators':0,'historicalHelpersExecuted':0},sort_keys=True).encode()+b'\n')
print(json.dumps({'sourceFolder':str(D),'sourceOnly':True,'operators':0,'completeGraph':False}))
