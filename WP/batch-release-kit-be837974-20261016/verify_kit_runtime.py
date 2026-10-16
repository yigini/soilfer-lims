"""Exact normal/candidate identity and readiness fault injection. No host calls."""
import copy
import json
import pathlib
import unittest
from kit_contract import HEAD,MEMORY_MAX,IMAGE
from kit_runtime import (PREDECESSOR_ID,PREDECESSOR_IMAGE,PREDECESSOR_HEAD,CANDIDATE_OWNER,LABEL,
    candidate_spec,candidate_projection,ExactPredecessor,Candidate)
from retained_health import load_health
from kit_readiness import Readiness,EXPECTED_HTTP,startup_log

HERE=pathlib.Path(__file__).resolve().parent
IDENTITY='d'*64
EVENTS=['SYNTHETIC_'+str(i)+'_STARTUP_READY' for i in range(26)]

def old():
    from retained_contract import LIVE_DATA,LIVE_ASSETS
    return {'Id':PREDECESSOR_ID,'Name':'/soilfer-lims','Image':PREDECESSOR_IMAGE,'RestartCount':0,
        'State':{'Running':True,'StartedAt':'2026-10-12T22:00:00Z','OOMKilled':False,'Dead':False,'Restarting':False,
            'Health':{'Status':'healthy'},'ExitCode':0},
        'Config':{'Env':['NODE_OPTIONS=','ALLOW_PRISMA_DB_PUSH=false','ALLOW_AUTO_SEED=false',
            'DISABLE_BACKGROUND_JOBS=false','SYNTHETIC_SECRET=PRIVATE_VALUE'],
            'Labels':{'org.opencontainers.image.revision':PREDECESSOR_HEAD}},
        'HostConfig':{'Memory':MEMORY_MAX,'MemorySwap':1610612736,'NetworkMode':'lims_default',
            'PortBindings':{'3000/tcp':[{'HostIp':'127.0.0.1','HostPort':'3000'}]},'NanoCpus':1500000000,
            'LogConfig':{'Type':'json-file','Config':{'max-size':'50m','max-file':'3'}}},
        'Mounts':[{'Type':'volume','Name':name,'Source':source,'Destination':destination,'RW':True}
            for name,source,destination in [('lims_lims-data',LIVE_DATA,'/app/server/prisma'),
            ('lims_lims-assets',LIVE_ASSETS,'/app/server/uploads')]]}

def new(spec,running=True):
    return {'Id':IDENTITY,'Name':'/soilfer-lims','Image':IMAGE,'RestartCount':0,
        'Config':{'Env':[k+'='+v for k,v in spec['environment'].items()],
            'Labels':{LABEL:CANDIDATE_OWNER,'org.opencontainers.image.revision':HEAD},
            'Entrypoint':['/app/docker-entrypoint.sh'],'Cmd':None,'Healthcheck':spec['health']['expectedDockerHealthcheck']},
        'HostConfig':{'Memory':MEMORY_MAX,'MemorySwap':MEMORY_MAX,'NetworkMode':spec['network'],
            'PortBindings':spec['ports'],'RestartPolicy':{'Name':'no'},'AutoRemove':False,'NanoCpus':1500000000,
            'LogConfig':{'Type':'json-file','Config':{'max-size':'50m','max-file':'3'}}},
        'Mounts':copy.deepcopy(spec['mounts']),
        'State':{'Running':running,'StartedAt':'2026-10-16T11:00:00Z','OOMKilled':False,'Dead':False,'Restarting':False,
            'Health':{'Status':'healthy'},'ExitCode':0}}

class Journal:
    def __init__(self):self.records=[]
    def append(self,phase,value):self.records.append((phase,value))

class RuntimeTests(unittest.TestCase):
    def test_blank_observed_host_ip_is_normalized_to_actual_create_binding(self):
        predecessor=old();predecessor['HostConfig']['PortBindings']['3000/tcp'][0]['HostIp']=''
        spec=candidate_spec(predecessor,load_health(HERE))
        self.assertEqual(spec['ports']['3000/tcp'],[{'HostIp':'0.0.0.0','HostPort':'3000'}])
        self.assertEqual(predecessor['HostConfig']['PortBindings']['3000/tcp'][0]['HostIp'],'')
        candidate_projection(new(spec),spec,True)

    def test_candidate_derives_observed_network_ports_environment_and_mounts_default_start(self):
        predecessor=old();spec=candidate_spec(predecessor,load_health(HERE));value=new(spec)
        candidate_projection(value,spec,True)
        self.assertEqual(spec['ports'],predecessor['HostConfig']['PortBindings'])
        self.assertEqual(spec['network'],'lims_default');self.assertEqual(spec['environment']['SYNTHETIC_SECRET'],'PRIVATE_VALUE')
        self.assertNotIn('--entrypoint',spec['argv']);self.assertNotIn('--rm',spec['argv'])
        self.assertEqual(spec['argv'][-1],IMAGE)
        for mutate in ('port','memory','entrypoint','health','mount','env'):
            changed=copy.deepcopy(value)
            if mutate=='port':changed['HostConfig']['PortBindings']={}
            elif mutate=='memory':changed['HostConfig']['MemorySwap']+=1
            elif mutate=='entrypoint':changed['Config']['Entrypoint']=['node']
            elif mutate=='health':changed['Config']['Healthcheck']['Retries']+=1
            elif mutate=='mount':changed['Mounts'][0]['Source']='/foreign'
            else:changed['Config']['Env']=['NODE_OPTIONS=--max-old-space-size=900']
            with self.subTest(mutate=mutate),self.assertRaises(RuntimeError):candidate_projection(changed,spec)

    def test_predecessor_stop_records_actual_exit_and_restart_cannot_repeat(self):
        value=old();journal=Journal();calls=[]
        class Reader:
            def inspect(self,identity):return copy.deepcopy(value)
        class Runner:
            def run(self,argv,*args):
                calls.append(argv);value['State']['Running']=True;value['State']['StartedAt']='2026-10-16T11:01:00Z'
        def call(argv):
            calls.append(argv)
            if argv[1]=='inspect':return json.dumps([value]).encode()
            value['State']['Running']=False;value['State']['ExitCode']=137;return PREDECESSOR_ID.encode()
        manager=ExactPredecessor(value,Runner(),Reader(),call,journal)
        self.assertEqual(manager.stop()['exitCode'],137)
        manager.restart_preapply_once()
        with self.assertRaises(RuntimeError):manager.restart_preapply_once()
        manager.stop();self.assertFalse(value['State']['Running'])
        self.assertEqual(sum(x[1]=='start' for x in calls),1)

    def test_lost_candidate_create_return_can_be_stopped_by_exact_intent_without_cid(self):
        spec=candidate_spec(old(),load_health(HERE));value=new(spec);calls=[]
        class Reader:
            def inventory(self):return {PREDECESSOR_ID:{'Name':'/retained-old','Config':{'Labels':{}}}}
        class Runner:
            def run(self,*args,**kwargs):raise RuntimeError('SYNTHETIC_LOST_CREATE_RETURN')
        manager=Candidate(spec,Runner(),Reader(),Journal(),lambda:None)
        with self.assertRaises(RuntimeError):manager.start_once()
        self.assertIsNone(manager.id)
        def call(argv):
            calls.append(argv)
            if argv[1]=='ps':return IDENTITY.encode()
            if argv[1]=='inspect':return json.dumps([value]).encode()
            value['State']['Running']=False;value['State']['ExitCode']=137;return IDENTITY.encode()
        self.assertTrue(manager.stop_for_intent(call)['stoppedAndRetained'])
        self.assertIn(['docker','stop','-t','10',IDENTITY],calls)
        with self.assertRaises(RuntimeError):manager.start_once()

def logs(events=EVENTS,change=0):
    return '\n'.join([json.dumps({'mode':'NO_OP','totalChanges':0}) for i in range(27)]+['Starting SoilFER-LIMS...']+
        [json.dumps({'event':event,'totalChanges':change,'rss_bytes':12345}) for event in events])

class ReadinessTests(unittest.TestCase):
    def exercise(self,late=False,unhealthy=False):
        tick=[0];memory=[];calls=[]
        class Runner:
            def check(self,seconds):pass
            def run(self,argv,*args,**kwargs):
                calls.append(argv)
                if argv[1]=='exec':return json.dumps(EXPECTED_HTTP).encode(),b'',{}
                if late:tick[0]=600
                return logs().encode(),b'',{}
        class Health:
            def __init__(self,*args):pass
            def observe(self,*args):pass
            def summary(self,*args):return {'syntheticHealthPolls':True}
        class Memory:
            def observe(self,phase):memory.append(phase)
        def clock():return tick[0]
        def sleep(seconds):tick[0]+=seconds
        def inspect():return {'State':{'Running':True,'Health':{'Status':'unhealthy' if unhealthy else 'healthy'}}}
        monitor=Readiness(HERE,Runner(),inspect,Memory(),EVENTS,0,clock,sleep,Health)
        if late or unhealthy:
            with self.assertRaises(RuntimeError):monitor.wait(IDENTITY)
        else:
            result=monitor.wait(IDENTITY);self.assertTrue(result['hostFinalReadyMemoryEventsChecked'])
            self.assertEqual(result['maxReadyRssBytes'],12345);self.assertEqual(result['http'],EXPECTED_HTTP)
        return tick,memory,calls

    def test_http_logs_and_final_memory_share_one_readiness_clock(self):self.exercise()
    def test_http_or_log_completion_at_exact_600_seconds_refuses(self):self.exercise(late=True)
    def test_five_minutes_unhealthy_never_changes_600_second_limit(self):
        tick,memory,calls=self.exercise(unhealthy=True);self.assertEqual(tick[0],600);self.assertFalse(calls)
    def test_full_27_noop_and_26_ready_reject_duplicates_bool_changes_or_missing_events(self):
        for text in (logs(EVENTS[:-1]),logs(EVENTS[:-1]+[EVENTS[0]]),logs(change=True),logs().replace('"NO_OP"','"APPLIED"',1)):
            with self.assertRaises(RuntimeError):startup_log(text,EVENTS,27,True)

if __name__=='__main__':unittest.main()
