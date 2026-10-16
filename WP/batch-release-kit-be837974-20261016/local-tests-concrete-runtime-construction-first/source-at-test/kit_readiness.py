"""One 600-second default startup clock, including HTTP, logs and memory.

The startup_log predicate is copied unchanged from the accepted qualification
source; its expected event inventory is derived from the bound application.
There is no operator entry point and no process/container action on import.
"""
import datetime
import json
import time
from kit_contract import READY_SECONDS,require
from retained_contract import exact_json
from retained_health import HealthHistory,readiness_status
from retained_memory import ready_max_rss

HTTP_CODE="""(async()=>{const checks=[];for(const [p,method,want] of [['/api/health','GET',200],['/login','GET',200],['/api/v2/sis/receipts','POST',401]]){const r=await fetch('http://127.0.0.1:3000'+p,{method,signal:AbortSignal.timeout(10000)});if(r.status!==want)throw Error('Release HTTP status refused');checks.push({path:p,method,status:r.status})}console.log(JSON.stringify(checks))})().catch(()=>{console.error('Release HTTP probes refused');process.exitCode=1})"""
EXPECTED_HTTP=[{'path':'/api/health','method':'GET','status':200},{'path':'/login','method':'GET','status':200},
    {'path':'/api/v2/sis/receipts','method':'POST','status':401}]

def startup_log(log,expected_events,expected_verifiers,jobs=False):
    decoder=json.JSONDecoder();values=[];offset=0
    while offset<len(log):
        at=log.find('{',offset)
        if at<0:break
        try:v,end=decoder.raw_decode(log[at:]);offset=at+end
        except ValueError:offset=at+1;continue
        if isinstance(v,dict):values.append(v)
    ready=[v for v in values if isinstance(v.get('event'),str) and v['event'].endswith('_STARTUP_READY')]
    require(len(ready)==len(expected_events) and {v['event'] for v in ready}==set(expected_events),'Complete exact startup READY inventory missing/duplicated')
    require(all(type(v.get('totalChanges')) is int and v.get('totalChanges')==0 for v in ready),'Startup READY changed database')
    prefix=log.split('Starting SoilFER-LIMS...')[0];entry=[];offset=0
    while offset<len(prefix):
        at=prefix.find('{',offset)
        if at<0:break
        try:v,end=decoder.raw_decode(prefix[at:]);offset=at+end
        except ValueError:offset=at+1;continue
        if isinstance(v,dict) and 'totalChanges' in v:entry.append(v)
    require(len(entry)==expected_verifiers and all(v.get('mode')=='NO_OP' and type(v.get('totalChanges')) is int and v.get('totalChanges')==0 for v in entry),'Default entrypoint verifier is not exact NO_OP0')
    require(not any(t in log for t in ['FATAL ERROR','Halting startup','Seeding initial','Initializing database schema']+([] if jobs else ['[KOBO_SCHEDULER] Triggering'])),'Unexpected initialization/scheduler/error during jobs-OFF startup')
    return {'readyEvents':ready,'entrypointVerifiers':entry,'databaseChanges':0,'jobsEnabled':jobs}

class Readiness:
    def __init__(self,root,runner,inspect_candidate,memory,expected_events,began,clock=time.monotonic,sleep=time.sleep,
                 health_factory=HealthHistory):
        require(len(expected_events)==len(set(expected_events))==26,'Exact candidate26 READY inventory required')
        self.root=root;self.runner=runner;self.inspect_candidate=inspect_candidate;self.memory=memory
        self.events=expected_events;self.began=began;self.clock=clock;self.sleep=sleep
        self.health=health_factory(root,'candidate',began);self.last_memory=None;self.command_number=0

    def observe(self,phase='running-command',force=False):
        now=self.clock()
        if force or self.last_memory is None or now-self.last_memory>=1:
            self.inspect_candidate();self.memory.observe(phase);self.last_memory=now

    def command(self,argv,label,timeout=30):
        self.command_number+=1
        return self.runner.run(argv,'candidate-'+label+'-'+str(self.command_number).zfill(4),timeout,
            allow_stderr=argv[1]=='logs',observer=self.observe)

    def wait(self,identity):
        while self.clock()-self.began<READY_SECONDS:
            self.runner.check(0)
            value=self.inspect_candidate();self.health.observe(value,self.clock());self.observe('health-poll',True)
            if readiness_status(value['State'])=='healthy':
                http,_,_=self.command(['docker','exec',identity,'node','-e',HTTP_CODE],'http')
                require(exact_json(http)==EXPECTED_HTTP,'Complete exact readiness HTTP200/200/401 required')
                out,err,_=self.command(['docker','logs',identity],'startup-logs')
                checks=startup_log((out+b'\n'+err).decode('utf-8','strict'),self.events,27,jobs=True)
                rss=ready_max_rss(checks['readyEvents']);self.observe('ready-final',True)
                seconds=self.clock()-self.began
                require(0<=seconds<READY_SECONDS,'600-second readiness deadline includes HTTP/log/final memory checks')
                return {'seconds':seconds,'readyUtc':datetime.datetime.now(datetime.timezone.utc).isoformat(),
                    'checks':checks,'maxReadyRssBytes':rss,'http':exact_json(http),
                    **self.health.summary(self.clock()),'hostFinalReadyMemoryEventsChecked':True}
            self.sleep(1)
        raise RuntimeError('600-second default-entrypoint readiness refused')
