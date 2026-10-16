"""Real local journal/control files plus a stateful Docker stand-in. No daemon."""
import copy
import hashlib
import itertools
import json
import os
import pathlib
import subprocess
import sys
import tempfile
import unittest
from unittest.mock import patch
from kit_contract import canonical,sha
from kit_journal import Journal
from kit_owned import ALLOWED,LABEL,cli_spec,selected,completion,OwnedCli
from kit_integrity import DATA_MOUNT,EXPECTED,stopped_integrity
from kit_stop import EmergencyCommands,stop_cli_owners

HERE=pathlib.Path(__file__).resolve().parent
FIXTURES=HERE/'owned-cli-local-retained-fixtures'
ID='a'*64

def directory():
    FIXTURES.mkdir(exist_ok=True)
    return pathlib.Path(tempfile.mkdtemp(prefix='owned-',dir=FIXTURES)).resolve()

def obj(spec,running=True):
    return {'Id':ID,'Name':'/'+spec['name'],'Image':spec['image'],'RestartCount':0,
        'Config':{'Entrypoint':['node'],'Cmd':['/release/cli_guard.cjs','/tmp',*spec['child']],
          'WorkingDir':'/app/server','Env':[k+'='+v for k,v in spec['environment'].items()],
          'Labels':{LABEL:spec['owner']},'Healthcheck':{'Test':['NONE']}},
        'HostConfig':{'Memory':805306368,'MemorySwap':805306368,'NetworkMode':'none',
          'RestartPolicy':{'Name':'no'},'AutoRemove':False},
        'Mounts':copy.deepcopy(spec['mounts']),
        'State':{'Running':running,'OOMKilled':False,'Restarting':False,'Dead':False,
          'StartedAt':'2026-10-16T11:00:00Z','ExitCode':0}}

def done(spec,status=0):
    return json.dumps({'childStatus':status,'childSignal':None,'childErrorType':None,'childSeconds':0.01,
        'argvSha256':sha(json.dumps(spec['child'],separators=(',',':')).encode()),'neverRetry':True}).encode()+b'\n'

class StandIn:
    def __init__(self,spec):
        self.spec=spec;self.value=obj(spec,False);self.permitted=False;self.events=[];self.now=0
        self.failure=None;self.status=0;self.reads=0;self.memory=[];self.stop_calls=[]
    def check(self,seconds):self.events.append('check')
    def inventory(self):self.events.append('inventory');return {'b'*64:{'Name':'/predecessor','Config':{'Labels':{}}}}
    def inspect(self,identity):
        self.events.append('inspect');self.value['State']['Running']=self.value['State']['Running'] and not self.permitted
        return copy.deepcopy(self.value)
    def run(self,argv,label,timeout,**kw):
        self.events.append(argv[1])
        if self.failure==argv[1]:raise RuntimeError('SYNTHETIC_LOST_RETURN')
        if argv[1]=='create':return (ID+'\n').encode(),b'',{}
        if argv[1]=='start':self.value['State']['Running']=True;return ID.encode(),b'',{}
        if argv[1]=='logs':return b'{"synthetic":true}\n',b'',{'private':True}
        raise AssertionError(argv)
    def clock(self):self.now+=0.1;return self.now
    def sleep(self,seconds):self.now+=seconds
    def history(self,*args):
        parent=self
        class History:
            def observe(self,phase):parent.memory.append(phase);parent.events.append('memory:'+phase)
            def summary(self,rss):
                assert parent.memory[-1]=='before-stop'
                return {'hostBeforeStopEventsChecked':True}
        return History()
    def read(self,spec):
        self.reads+=1
        return None if self.reads==1 else done(spec,self.status)
    def permit(self,spec,value):
        assert self.memory[-1]=='before-stop';assert value['childCompletionSha256']==sha(done(spec,self.status))
        self.events.append('permit');self.permitted=True
    def stop(self,owners):self.stop_calls.append(owners);return {'allObservedExactCliOwnersStopped':True}
    def manager(self,journal):
        return OwnedCli(self,self,journal,self.history,lambda s:self.events.append('prepare'),self.read,self.permit,
            self.stop,self.clock,self.sleep)

class OwnedTests(unittest.TestCase):
    def test_all_thirteen_compiled_commands_have_exact_limits_mounts_and_modes(self):
        self.assertEqual(len(ALLOWED),13)
        for label in ALLOWED:
            spec=cli_spec(label,DATA_MOUNT);value=obj(spec)
            self.assertEqual(spec['dataWritable'],label.endswith(('-dry','-apply','-repeat')))
            self.assertNotIn('--rm',spec['argv']);selected(value,spec,True)
            for mounts in itertools.permutations(value['Mounts']):
                changed=copy.deepcopy(value);changed['Mounts']=list(mounts)
                self.assertEqual(selected(changed,spec),selected(value,spec))

    def test_each_operational_field_mutation_refuses(self):
        spec=cli_spec('stopped-integrity',DATA_MOUNT);value=obj(spec)
        mutations=[('Name','/foreign'),('Image','sha256:'+'b'*64),('Id','short'),('RestartCount',1),
            ('Config.Labels.'+LABEL,'foreign'),('Config.Cmd',['/app/docker-entrypoint.sh']),
            ('Config.Entrypoint',['sh']),('Config.WorkingDir','/tmp'),('Config.Env',['NODE_OPTIONS=--max-old-space-size=900']),
            ('Config.Healthcheck',{'Test':['CMD','true']}),('HostConfig.Memory',999),('HostConfig.MemorySwap',999),
            ('HostConfig.AutoRemove',True),('HostConfig.NetworkMode','bridge'),('HostConfig.RestartPolicy.Name','always'),
            ('State.Running',None),('State.OOMKilled',True),('State.Restarting',True),('State.Dead',True)]
        for dotted,replacement in mutations:
            changed=copy.deepcopy(value);parts=dotted.split('.')
            if dotted=='Config.Labels.'+LABEL:changed['Config']['Labels'][LABEL]=replacement
            else:
                target=changed
                for part in parts[:-1]:target=target[part]
                target[parts[-1]]=replacement
            with self.subTest(dotted=dotted),self.assertRaises(RuntimeError):selected(changed,spec)
        for index,mount in enumerate(value['Mounts']):
            for key in mount:
                changed=copy.deepcopy(value);changed['Mounts'][index][key]='SYNTHETIC_MUTATION'
                with self.subTest(mount=index,key=key),self.assertRaises(RuntimeError):selected(changed,spec)
        for mounts in [value['Mounts'][:2],value['Mounts']+[value['Mounts'][0]],value['Mounts'][:2]+[value['Mounts'][0]]]:
            changed=copy.deepcopy(value);changed['Mounts']=mounts
            with self.assertRaises(RuntimeError):selected(changed,spec)

    def test_actual_journal_intent_precedes_create_and_final_memory_precedes_exit(self):
        spec=cli_spec('206-apply',DATA_MOUNT);stand=StandIn(spec);d=directory()
        journal=Journal(d,str(d),'f'*64,require_directory_sync=False)
        raw,result=stand.manager(journal).run(spec)
        self.assertTrue(result['stoppedAndRetained']);self.assertFalse(stand.stop_calls)
        phases=[json.loads(p.read_bytes()) for p in sorted(d.glob('phase-*.json'))]
        self.assertEqual(phases[0]['phase'],'ownedCliIntent')
        self.assertEqual(phases[0]['value']['specification'],spec)
        self.assertLess(stand.events.index('memory:before-stop'),stand.events.index('permit'))
        self.assertEqual(phases[-1]['phase'],'ownedCliComplete')

    def test_lost_create_or_start_return_stops_by_intended_owner_and_never_retries(self):
        for failure in ('create','start'):
            spec=cli_spec('209-apply',DATA_MOUNT);stand=StandIn(spec);stand.failure=failure;d=directory()
            journal=Journal(d,str(d),'f'*64,require_directory_sync=False);manager=stand.manager(journal)
            with self.assertRaises(RuntimeError):manager.run(spec)
            self.assertEqual(stand.stop_calls,[[spec['label']]])
            with self.assertRaises(RuntimeError):manager.run(spec)
            self.assertEqual(stand.events.count(failure),1)

    def test_child_failure_still_gets_final_memory_and_retained_exit_then_stop_attempt(self):
        spec=cli_spec('214-dry',DATA_MOUNT);stand=StandIn(spec);stand.status=3;d=directory()
        journal=Journal(d,str(d),'f'*64,require_directory_sync=False)
        with self.assertRaises(RuntimeError):stand.manager(journal).run(spec)
        self.assertTrue(stand.permitted);self.assertEqual(stand.memory[-1],'before-stop')
        self.assertEqual(stand.stop_calls,[[spec['label']]])

    def test_completion_wrong_argv_duplicate_key_boolean_exit_and_nonfinite_clock_refuse(self):
        spec=cli_spec('canonical-policy',DATA_MOUNT)
        for key,replacement in [('argvSha256','0'*64),('childStatus',True),('childSeconds',float('nan')),('neverRetry',False)]:
            value=json.loads(done(spec));value[key]=replacement
            with self.assertRaises(RuntimeError):completion(json.dumps(value).encode(),spec)
        with self.assertRaises(RuntimeError):completion(done(spec).rstrip()[:-1]+b',"childStatus":0}',spec)

class StopTests(unittest.TestCase):
    def test_exact_stop_uses_full_mount_objects_independent_of_all_permutations(self):
        spec=cli_spec('206-apply',DATA_MOUNT)
        for before_order in itertools.permutations(range(3)):
            for after_order in itertools.permutations(range(3)):
                value=obj(spec);stops=[];inspects=[]
                def call(argv):
                    if argv[1]=='ps':return (ID+'\n').encode()
                    if argv[1]=='stop':stops.append(argv);value['State']['Running']=False;value['State']['ExitCode']=137;return ID.encode()
                    if argv[1]=='inspect':
                        copy_value=copy.deepcopy(value);order=before_order if not inspects else after_order
                        copy_value['Mounts']=[copy_value['Mounts'][i] for i in order];inspects.append(True)
                        return json.dumps([copy_value]).encode()
                    raise AssertionError(argv)
                result=stop_cli_owners(call,['206-apply'])
                self.assertFalse(result['errors']);self.assertEqual(result['nonvacuousStoppedOwnerCount'],1)
                self.assertEqual(stops,[['docker','stop','-t','10',ID]])
                self.assertEqual(result['stoppedAndRetained'][0]['actualExitCode'],137)

    def test_foreign_identity_is_never_stopped_but_resource_failure_cannot_block_owned_stop(self):
        spec=cli_spec('209-apply',DATA_MOUNT)
        for foreign in (True,False):
            value=obj(spec);stops=[]
            if foreign:value['Config']['Labels'][LABEL]='foreign'
            else:value['HostConfig']['MemorySwap']=999;value['State']['OOMKilled']=True
            def call(argv):
                if argv[1]=='ps':return ID.encode()
                if argv[1]=='inspect':return json.dumps([value]).encode()
                stops.append(argv);value['State']['Running']=False;return ID.encode()
            result=stop_cli_owners(call,['209-apply'])
            self.assertEqual(len(stops),0 if foreign else 1)
            self.assertEqual(bool(result['errors']),foreign)
            if not foreign:self.assertTrue(result['stoppedAndRetained'][0]['runtimeViolationObservedBeforeStop'])

    def test_one_failed_owner_does_not_prevent_next_owner_and_empty_is_not_nonvacuous(self):
        calls=[]
        def call(argv):
            calls.append(argv)
            if '206-apply' in argv[-1]:raise RuntimeError('SYNTHETIC_INTERFACE_FAILURE')
            return b''
        result=stop_cli_owners(call,['206-apply','214-apply'])
        self.assertEqual(len(calls),2);self.assertEqual(len(result['errors']),1)
        self.assertEqual(len(result['observedAbsentOwners']),1);self.assertEqual(result['nonvacuousStoppedOwnerCount'],0)

    def test_real_local_emergency_transport_launches_before_failed_retention(self):
        d=directory();launched=[]
        def spawn(argv,**kwargs):
            launched.append(argv)
            return subprocess.Popen([sys.executable,'-c','import sys;sys.stdout.write("SYNTHETIC_EMERGENCY_ONLY")'],**kwargs)
        command=EmergencyCommands(d,False,spawn)
        with patch.object(command,'retain',side_effect=OSError('SYNTHETIC_FULL_EVIDENCE_DISK')):
            self.assertEqual(command(['docker','stop','-t','10',ID]),b'SYNTHETIC_EMERGENCY_ONLY')
        self.assertEqual(len(launched),1);self.assertEqual(len(command.retention_errors),1)
        self.assertTrue(command.retention_errors[0]['metadata']['completeNotTruncated'])

class IntegrityTests(unittest.TestCase):
    def test_readonly_container_check_is_before_backup_and_preserves_full_original_shm(self):
        events=[];state={'':{'sha256':'a'*64,'bytes':20},'-wal':None,'-shm':{'sha256':'b'*64,'bytes':32}}
        class Cli:
            def run(self,spec):events.append('cli');self.spec=spec;return json.dumps(EXPECTED).encode(),{'synthetic':True}
        class Journal:
            def append(self,*args):events.append(args[0])
        def snapshot(path):events.append('hash');return copy.deepcopy(state)
        cli=Cli();result=stopped_integrity(cli,Journal(),lambda:events.append('no-writers'),snapshot)
        self.assertFalse(cli.spec['dataWritable']);self.assertTrue(result['originalFullTripleExactlyEqual'])
        self.assertEqual(events,['no-writers','hash','stoppedIntegrityBefore','cli','no-writers','hash','stoppedIntegrityAfter'])

    def test_changed_shm_or_fk_failure_cannot_be_integrity_pass(self):
        for failure in ('shm','fk'):
            state={'':{'sha256':'a'*64,'bytes':20},'-wal':None,'-shm':None};snapshots=[]
            class Cli:
                def run(self,spec):
                    value=dict(EXPECTED)
                    if failure=='fk':value['foreignKeyViolations']=1
                    else:state['-shm']={'sha256':sha(b''),'bytes':0}
                    return json.dumps(value).encode(),{}
            class Journal:
                def append(self,*args):pass
            with self.assertRaises(RuntimeError):stopped_integrity(Cli(),Journal(),lambda:None,lambda p:copy.deepcopy(state))

if __name__=='__main__':unittest.main()
