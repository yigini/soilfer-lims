"""Parse pinned Compose health bytes; derive exact Docker CLI representation."""
import json,pathlib,re,shlex
from retained_contract import COMPOSE_PIN,require,sha

def derive_healthcheck(raw,pin=COMPOSE_PIN):
    require(isinstance(raw,bytes) and len(raw)==pin['bytes'] and sha(raw)==pin['sha256'],'Pinned Compose bytes changed')
    import hashlib
    require(hashlib.sha1(('blob '+str(len(raw))+'\0').encode()+raw).hexdigest()==pin['blob'],'Pinned Compose Git blob changed')
    text=raw.decode('utf-8').replace('\r\n','\n');matches=list(re.finditer(r'^    healthcheck:\n((?:      [^\n]*\n)+)',text,re.M))
    require(len(matches)==1 and 'services:\n  lims:\n' in text,'Single bound lims healthcheck block required')
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
    return status


class HealthHistory:
    """Every poll is immutable evidence; timestamps are not readiness authority."""
    def __init__(self,root,label,began):
        self.root=pathlib.Path(root);self.label=label;self.began=began
        self.last_time=began;self.last_status=None;self.unhealthy_seconds=0.0
        self.first_healthy=None;self.polls=[];self.transitions=[]
    def observe(self,obj,now):
        from retained_files import write_new
        import datetime
        require(now>=self.last_time,'Health monotonic clock moved backwards')
        if self.last_status=='unhealthy':self.unhealthy_seconds+=now-self.last_time
        state=obj.get('State',{});health=state.get('Health');status=health.get('Status') if isinstance(health,dict) else None
        record={'observedUtc':datetime.datetime.now(datetime.timezone.utc).isoformat(),'elapsedSeconds':now-self.began,'status':status,'state':state,'healthcheck':obj.get('Config',{}).get('Healthcheck'),'previousStatus':self.last_status,'transition':status!=self.last_status,'unhealthySecondsObservedSoFar':self.unhealthy_seconds}
        path=self.label+'-health-poll-'+str(len(self.polls)+1).zfill(6)+'.json'
        write_new(self.root/path,record);self.polls.append(path)
        if record['transition']:self.transitions.append({'path':path,**record})
        self.last_time=now;self.last_status=status
        if status=='healthy' and self.first_healthy is None:self.first_healthy=now-self.began
        require(state.get('Running') is True and not state.get('Restarting',False) and not state.get('OOMKilled',False) and not state.get('Dead',False),'Health poll container exited/restarting/OOM/dead: immediate STOP')
        return readiness_status(state)
    def summary(self,now):
        require(now>=self.last_time,'Health monotonic clock moved backwards')
        unhealthy=self.unhealthy_seconds+(now-self.last_time if self.last_status=='unhealthy' else 0)
        return {'timeToFirstHealthySeconds':self.first_healthy,'totalUnhealthySeconds':unhealthy,'healthPollCount':len(self.polls),'healthPollEvidence':list(self.polls),'healthTransitions':list(self.transitions),'unhealthyTimeMeasurement':'MONOTONIC_INTERVALS_BETWEEN_OBSERVED_POLLS_NOT_UNOBSERVED_EXACT_DOCKER_TRANSITION_TIME'}
