"""One owned jobs-OFF broad postflight and one natural jobs-ON intake proof.

Only NEW children of the exact reviewed root are opened as SQLite. Old inputs
are hash/stat authorities. No cursor, config, clock, seed or manual sync writes.
"""
import contextlib,pathlib,sqlite3,time
from proof_contract import *
from proof_files import clone_backup,copy_tree,seal,write_new,file_state,utc_now,child_path,tree_state
from proof_docker import inspect
from proof_health import load_health,assert_healthcheck,HealthHistory,readiness_status
from proof_startup import startup_log
from proof_memory import MemoryHistory,ready_max_rss
from capture_kobo_fetch import capture
from kobo_copy_preservation import verify_copy
from runtime_proof_policies import (TARGET_CONFIG,TARGET_LAB,TARGET_PROJECT,
    expected_refusals,scheduler_refusals,completed_syncs,observation_end,
    require_final_observation,intake_summary,utc_seconds)

PROBES=('postflight-roles.cjs','postflight-auth.cjs','postflight-reference.cjs',
        'postflight-qc-runs.cjs','postflight-policy.cjs','readonly-smoke.cjs')
HTTP_CODE="""(async()=>{const checks=[];for(const [p,method,want] of [['/api/health','GET',200],['/login','GET',200],['/api/v2/sis/receipts','POST',401]]){const r=await fetch('http://127.0.0.1:3000'+p,{method});if(r.status!==want)throw Error(p+':'+r.status);checks.push({path:p,method,status:r.status})}console.log(JSON.stringify(checks))})().catch(e=>{console.error(e.message);process.exitCode=1})"""

def probe_results(raw):
    matches=re.findall(rb'POSTFLIGHT SUMMARY: (\d+)/(\d+) checks passed \((\d+) failed\)',raw)
    require(matches==[(b'31',b'31',b'0')],'Complete shipped 31/31 API checks required')
    return {'passed':31,'total':31,'failed':0}

def broad_postflights(root,id,docker):
    args=['docker','exec','-i','-w','/app/server','-e','POSTFLIGHT_ADMIN_ID=1770311018064',
          '-e','POSTFLIGHT_MANAGER_ID=user-mgr-gha','-e','POSTFLIGHT_TECH_ID=user-tech-gha',
          '-e','POSTFLIGHT_BASE_URL=http://127.0.0.1:3000',id,'node']
    raw,_=docker.command(args+['scripts/postflight_issue140.cjs'],'api-postflight',120)
    records=[]
    for name in PROBES:
        source=(root/name).read_bytes()
        docker.command(args,'broad-'+name[:-4],120,input_bytes=source)
        records.append({'source':name,'sha256':sha(source),'exitCode':0})
    return {'apiChecks':probe_results(raw),'readOnlyProbes':records,'fullStoppedEqualityRequiredAfterAllProbes':True}

class Monitor:
    def __init__(self,root,label,id,owner,docker,data,tmp):
        self.memory=MemoryHistory(root,label,id,owner);self.last=None;self.docker=docker
        self.id=id;self.owner=owner;self.data=data;self.tmp=tmp
    def sample(self,phase='running-command',force=False):
        now=time.monotonic()
        if force or self.last is None or now-self.last>=1:
            self.docker.validate(self.id,self.owner,self.data,self.tmp,True)
            self.memory.observe(phase);self.last=now
    def final(self,rss):
        self.sample('before-stop',True);return self.memory.summary(rss)

def ready(root,label,id,owner,data,tmp,docker,events,verifiers,jobs,began,monitor):
    history=HealthHistory(root,label,began)
    while time.monotonic()-began<READY_SECONDS:
        docker.disk.check()
        def observe(obj):history.observe(obj,time.monotonic());monitor.sample('health-poll',True)
        obj=docker.validate(id,owner,data,tmp,True,observe=observe)
        if readiness_status(obj['State'])=='healthy':
            probes,_=docker.command(['docker','exec',id,'node','-e',HTTP_CODE],label+'-http-probes',30)
            raw,err=docker.command(['docker','logs',id],label+'-startup-logs',30)
            checks=startup_log((raw+b'\n'+err).decode('utf-8','strict'),events,verifiers,jobs=jobs)
            monitor.sample('ready-final',True)
            require(time.monotonic()-began<READY_SECONDS,'600-second readiness STOP including HTTP and final memory sample')
            return {'checks':checks,'httpProbes':exact_json(probes),'readyUtc':utc_now(),
                    'readinessElapsedSeconds':time.monotonic()-began,**history.summary(history.last_time)}
        time.sleep(1)
    raise RuntimeError('600-second readiness STOP')

def stopped_owned(id,owner,docker,data,tmp):
    docker.validate(id,owner,data,tmp,False)
    # Enumerate every container, not only the newly owned one, before a seal.
    from proof_docker import all_containers
    target=pathlib.Path(data).resolve()
    for row in all_containers().values():
        for mount in row['mounts']:
            src=pathlib.Path(mount['Source']).resolve()
            require(not(row['running'] and mount.get('RW') and
                (src==target or src in target.parents or target in src.parents)),
                'A running writer still mounts this owned database before seal')

def jobs_off(root,backup,state,assets,docker,disk,events,verifiers,input_guard):
    label='startup-1';disk.begin_stage(label)
    data=clone_backup(root,label+'-database',backup,disk.check)
    copied=root/(label+'-assets');copy_tree(assets,copied,disk.check);input_guard();asset_state=tree_state(copied)
    tmp=root/(label+'-retained-temp');id,owner=docker.create(label,data,tmp,assets=copied)
    began=time.monotonic();monitor=Monitor(root,label,id,owner,docker,data,tmp)
    write_new(root/(label+'-default-entrypoint-attempt.json'),{'id':id,'jobsEnabled':False,'neverRetry':True})
    try:
        docker.command(['docker','start',id],label+'-start',30);docker.observer=monitor.sample
        readiness=ready(root,label,id,owner,data,tmp,docker,events,verifiers,False,began,monitor)
        probes=broad_postflights(root,id,docker)
        memory=monitor.final(ready_max_rss(readiness['checks']['readyEvents']))
    finally:
        docker.observer=None;docker.stop(id,owner,label)
    stopped_owned(id,owner,docker,data,tmp)
    require(tree_state(copied)==asset_state,'Broad postflight changed copied asset files')
    sealed,actual=seal(root,label+'-stopped-seal',data/'dev.db',disk.check)
    require(actual==state,'Jobs-OFF startup or broad postflights changed full112-table42-receipt state')
    input_guard();result={'id':id,'readiness':readiness,'broadPostflights':probes,'memory':memory,
        'fullInstalledStatePreserved':True,'stoppedContainerRetained':True,'stoppedBackup':str(sealed)}
    write_new(root/(label+'-result.json'),result);disk.finish_stage(label)
    return sealed,result

def configs_from_new_backup(root,backup):
    backup=child_path(root,backup);require(backup.is_file(),'Only a NEW owned sealed backup may supply configs')
    with contextlib.closing(sqlite3.connect(backup.as_uri()+'?mode=ro&immutable=1',uri=True)) as db:
        db.row_factory=sqlite3.Row
        configs=[dict(row) for row in db.execute('SELECT * FROM KoboConfig')]
        labs=[dict(row) for row in db.execute('SELECT id,code,name,isActive FROM Lab')]
        projects=[dict(row) for row in db.execute('SELECT code FROM Project')]
    active={r['id']:{k:r[k] for k in ['id','labId','projectCode','syncIntervalMins','lastSubmissionId']}
            for r in configs if r['isActive'] and r['projectCode']}
    refusals=expected_refusals(configs,labs,projects)
    require(len(refusals)==4,'All four exact original refusal configs must remain bound')
    require(TARGET_CONFIG in active and active[TARGET_CONFIG]['labId']==TARGET_LAB and
            active[TARGET_CONFIG]['projectCode']==TARGET_PROJECT,'Original crash-path config required')
    require(sum(r['labId']==TARGET_LAB for r in active.values())==1,'Ambiguous completion lab')
    interval=active[TARGET_CONFIG]['syncIntervalMins'] or 15
    observation_end(utc_now(),utc_now(),interval)
    require(type(interval) is int and 0<interval<=30,'Unedited natural interval cannot fit this bounded90-minute graph')
    return active,refusals,interval

def consistent_backup(root,source,destination,disk,monitor):
    source=child_path(root,source);destination=child_path(root,destination)
    require(not destination.exists(),'Consistent backup path consumed')
    disk.claim('backup');began=time.monotonic()
    def progress(*_):
        require(time.monotonic()-began<180,'Live OWNED consistent backup deadline');disk.check();monitor.sample('consistent-backup')
    with contextlib.closing(sqlite3.connect(source.as_uri()+'?mode=ro',uri=True,timeout=10)) as a:
        a.execute('PRAGMA query_only=ON')
        with contextlib.closing(sqlite3.connect(str(destination))) as b:a.backup(b,pages=256,progress=progress,sleep=0.05)
    destination.chmod(0o400);return file_state(destination)

def observed_logs(root,label,id,docker,expected):
    raw,err=docker.command(['docker','logs','--timestamps',id],label,30)
    stdout=raw.decode('utf-8','strict');stderr=err.decode('utf-8','strict')
    require('[KOBO_SCHEDULER] Initial sync error' not in stdout+stderr,'Initial scheduler error')
    refusals=scheduler_refusals(stdout,stderr,expected)
    return stdout,refusals

def natural_complete(first,second,ready_utc,finished,interval,restarts):
    # The historical parser's peak argument is evidence only in this NEW graph.
    # Every actual container already passed host memory.events/sampled-sum gates.
    require_final_observation(first,second,ready_utc,finished,interval,restarts,None,
                              utc_seconds(finished)-utc_seconds(ready_utc))

def jobs_on(root,backup,assets,docker,disk,events,verifiers,input_guard):
    configs,expected,interval=configs_from_new_backup(root,backup)
    label='startup-2';disk.begin_stage(label)
    data=clone_backup(root,label+'-database',backup,disk.check)
    copied=root/(label+'-assets');copy_tree(assets,copied,disk.check);input_guard();asset_state=tree_state(copied)
    # Read-only upstream GET evidence uses the original copied cursors. No sync API.
    write_new(root/'upstream-before-start.json',capture(backup,list(configs)))
    write_new(root/'scheduler-bound-configs.json',{'activeConfigsWithoutSecrets':configs,'expectedRefusals':expected,
              'copySyncIntervalMins':interval,'cursorIntervalTimestampOverrides':0})
    tmp=root/(label+'-retained-temp');id,owner=docker.create(label,data,tmp,assets=copied,jobs=True)
    began=time.monotonic();monitor=Monitor(root,label,id,owner,docker,data,tmp)
    write_new(root/(label+'-default-entrypoint-attempt.json'),{'id':id,'jobsEnabled':True,'neverRetry':True})
    first_state=None;first_fetch=None;first=None;second=None;observations=[]
    try:
        docker.command(['docker','start',id],label+'-start',30);docker.observer=monitor.sample
        readiness=ready(root,label,id,owner,data,tmp,docker,events,verifiers,True,began,monitor)
        first_deadline=time.monotonic()+600;end=None
        while True:
            disk.time_guard(180);disk.check();monitor.sample('natural-intake',True)
            v=docker.validate(id,owner,data,tmp,True)
            require(readiness_status(v['State'])=='healthy','Owned jobs-ON lost health')
            docker.command(['docker','exec',id,'node','-e',HTTP_CODE],label+'-watch-http-'+str(len(observations)+1),30)
            log,refusals=observed_logs(root,label+'-watch-logs-'+str(len(observations)+1),id,docker,expected)
            completions=completed_syncs(log)
            observation={'utc':utc_now(),'monotonicElapsedSeconds':time.monotonic()-began,
                'observedCompletions':completions,'observedRefusals':refusals,'healthy':True}
            write_new(root/('natural-observation-'+str(len(observations)+1).zfill(6)+'.json'),observation);observations.append(observation)
            require(len(observations)<=256,'Natural observation bound')
            if first is None and completions:
                require(len(completions)==1,'Multiple first completions before first consistent seal; no replay')
                first=completions[0];end=observation_end(first['utc'],readiness['readyUtc'],interval)
                first_fetch=capture(backup,list(configs),progress=monitor.sample);write_new(root/'upstream-first-completion.json',first_fetch)
                consistent_backup(root,data/'dev.db',root/'first-sync.db',disk,monitor)
                first_ids={key:row['submissionIds'] for key,row in first_fetch.items()}
                first_state=verify_copy(backup,root/'first-sync.db',expected_table_count=112,
                    fetched_ids=first_ids,refusal_configs=[r['configId'] for r in expected])
                write_new(root/'first-sync-preservation.json',first_state)
                intake_summary(first_state,first)
                prior_ids={key:first_ids[key] if completed_syncs(log,r['labId']) else first_state['newSubmissionIds'].get(key,[]) for key,r in configs.items()}
                require(prior_ids[TARGET_CONFIG]==first_ids[TARGET_CONFIG],'First crash-path fetch not sealed')
            if first is None:require(time.monotonic()<first_deadline,'First natural sync completion deadline')
            elif time.time()>=end and len(completions)>=2:
                second=completions[1];finished=utc_now();natural_complete(first,second,readiness['readyUtc'],finished,interval,v['RestartCount'])
                require(all(sum(r['configId']==x['configId'] for x in refusals)>=2 for r in expected),
                        'Two exact paired natural refusals for every bound config required')
                break
            else:require(time.time()<=end+180,'Second natural completion deadline')
            time.sleep(10)
        memory=monitor.final(ready_max_rss(readiness['checks']['readyEvents']))
    finally:
        docker.observer=None;docker.stop(id,owner,label)
    stopped_owned(id,owner,docker,data,tmp)
    require(tree_state(copied)==asset_state,'Natural intake changed copied asset files')
    final,_=seal(root,'jobs-on-stopped-seal',data/'dev.db',disk.check);input_guard()
    final_fetch=capture(backup,list(configs));write_new(root/'upstream-second-completion.json',final_fetch)
    ids={key:row['submissionIds'] for key,row in final_fetch.items()};refused=[r['configId'] for r in expected]
    second_state=verify_copy(root/'first-sync.db',final,expected_table_count=112,
        fetched_ids=ids,prior_fetched_ids=prior_ids,refusal_configs=refused)
    full=verify_copy(backup,final,expected_table_count=112,fetched_ids=ids,refusal_configs=refused)
    write_new(root/'second-sync-preservation.json',second_state);write_new(root/'full-intake-preservation.json',full)
    result={'id':id,'readiness':readiness,'firstScheduledSync':first,'secondScheduledSync':second,
        'firstIntake':intake_summary(first_state,first),'secondIntake':intake_summary(second_state,second),
        'memory':memory,'originalConfigsCursorsIntervalsAndClocksNotOverridden':True,
        'all112TablesOriginalRowsSchemaAnd42ReceiptsPreserved':True,'onlyEnumeratedNaturalIntakeChanges':True,
        'observationCount':len(observations),'stoppedContainerRetained':True,'stoppedBackup':str(final),
        'naturalObservationEndUtc':finished,'exactKitAndFreshSingleUseGateStillRequired':True}
    write_new(root/(label+'-result.json'),result);disk.finish_stage(label);return result

def qualification(root,backup,state,assets,docker,disk,events,verifiers,input_guard):
    baseline,off=jobs_off(root,backup,state,assets,docker,disk,events,verifiers,input_guard)
    return {'jobsOffBroadPostflights':off,'jobsOnNaturalIntake':jobs_on(root,baseline,assets,docker,disk,events,verifiers,input_guard)}
