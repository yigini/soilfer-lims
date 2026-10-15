"""Parse pinned Compose health bytes; derive exact Docker CLI representation."""
import json,pathlib,re,shlex
from proof_contract import COMPOSE_PIN,require,sha

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
    require(status!='unhealthy','Unhealthy: immediate readiness STOP')
    return status
