"""Two independent ordinary default startups, jobs OFF; stop and seal every owned copy."""
import pathlib,time
from proof_contract import *
from proof_files import *
from proof_docker import inspect
from proof_health import readiness_status,load_health,assert_healthcheck

def startup_log(log,expected_events,expected_verifiers):
    decoder=json.JSONDecoder();values=[];offset=0
    while offset<len(log):
        at=log.find('{',offset)
        if at<0:break
        try:v,end=decoder.raw_decode(log[at:]);offset=at+end
        except ValueError:offset=at+1;continue
        if isinstance(v,dict):values.append(v)
    ready=[v for v in values if isinstance(v.get('event'),str) and v['event'].endswith('_STARTUP_READY')]
    require(len(ready)==len(expected_events) and {v['event'] for v in ready}==set(expected_events),'Complete exact startup READY inventory missing/duplicated')
    require(all(v.get('totalChanges')==0 for v in ready),'Startup READY changed database')
    prefix=log.split('Starting SoilFER-LIMS...')[0];entry=[];offset=0
    while offset<len(prefix):
        at=prefix.find('{',offset)
        if at<0:break
        try:v,end=decoder.raw_decode(prefix[at:]);offset=at+end
        except ValueError:offset=at+1;continue
        if isinstance(v,dict) and 'totalChanges' in v:entry.append(v)
    require(len(entry)==expected_verifiers and all(v.get('mode')=='NO_OP' and v.get('totalChanges')==0 for v in entry),'Default entrypoint verifier is not exact NO_OP0')
    require(not any(t in log for t in ['FATAL ERROR','Halting startup','Seeding initial','Initializing database schema','[KOBO_SCHEDULER] Triggering']),'Unexpected initialization/scheduler/error during jobs-OFF startup')
    return {'readyEvents':ready,'entrypointVerifiers':entry,'databaseChanges':0,'jobsEnabled':False}
def startup(root,backup,state,assets,docker,disk,events,verifiers):
    outcomes=[]
    for number in [1,2]:
        label='startup-'+str(number);disk.begin_stage(label);data=clone_backup(root,label+'-database',backup,disk.check)
        runtime_assets=root/(label+'-assets');copy_tree(assets,runtime_assets,disk.check)
        tmp=root/(label+'-retained-temp');id,owner=docker.create(label,data,tmp,assets=runtime_assets);began=time.monotonic()
        assert_healthcheck(inspect(id)['Config'].get('Healthcheck'),load_health(root))
        write_new(root/(label+'-default-entrypoint-attempt.json'),{'id':id,'forwardOnly':True,'neverRetry':True,'jobsEnabled':False})
        try:
            docker.command(['docker','start',id],label+'-start',30)
            health=None
            while time.monotonic()-began<READY_SECONDS:
                disk.check();v=docker.validate(id,owner,data,tmp,True)
                if v['State'].get('Health',{}).get('Status') not in ['starting','healthy']:
                    write_new(root/(label+'-readiness-refusal-health-state.json'),{'state':v['State'],'healthcheck':v['Config'].get('Healthcheck'),'immediateStop':True,'neverRetry':True})
                status=readiness_status(v['State'])
                if status=='healthy':
                    raw,_=docker.command(['docker','exec',id,'node','-e',"fetch('http://127.0.0.1:3000/api/health').then(async r=>{const v=await r.json();if(r.status!==200||v.status!=='ok')throw Error('health');console.log(JSON.stringify(v))}).catch(e=>{console.error(e.message);process.exitCode=1})"],label+'-health',15)
                    health=exact_json(raw);break
                time.sleep(1)
            require(health is not None and time.monotonic()-began<READY_SECONDS,'600-second readiness STOP')
            raw,err=docker.command(['docker','logs',id],label+'-startup-logs',30);checks=startup_log((raw+b'\n'+err).decode('utf-8','strict'),events,verifiers)
            probes,_=docker.command(['docker','exec',id,'node','-e',"(async()=>{const checks=[];for(const [p,method,want] of [['/api/health','GET',200],['/login','GET',200],['/api/v2/sis/receipts','POST',401]]){const r=await fetch('http://127.0.0.1:3000'+p,{method});if(r.status!==want)throw Error(p+':'+r.status);checks.push({path:p,method,status:r.status})}console.log(JSON.stringify(checks))})().catch(e=>{console.error(e.message);process.exitCode=1})"],label+'-http-probes',30)
            memory,_=docker.command(['docker','exec',id,'node','-e',"console.log(Number(require('node:fs').readFileSync('/sys/fs/cgroup/memory.peak','utf8')))"],label+'-peak',15)
            peak=int(memory);require(0<peak<=MEMORY,'Startup memory STOP')
        finally:docker.stop(id,owner,label)
        docker.validate(id,owner,data,tmp,False)
        sealed,actual=seal(root,label+'-stopped-seal',data/'dev.db',disk.check);require(actual==state,'Default startup changed the full stopped installed state')
        outcome={'id':id,'stoppedContainerRetained':True,'elapsedSeconds':time.monotonic()-began,'readinessDeadlineSeconds':READY_SECONDS,'health':health,'checks':checks,'httpProbes':exact_json(probes),'memoryPeakBytes':peak,'stoppedBackup':str(sealed),'fullInstalledStatePreserved':True,'jobsOnQualificationStillRequired':True}
        write_new(root/(label+'-result.json'),outcome);outcomes.append(outcome);disk.finish_stage(label)
    return outcomes
