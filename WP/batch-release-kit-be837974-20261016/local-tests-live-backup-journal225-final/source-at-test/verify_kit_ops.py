"""Integrated phase/budget and independent standalone failure-path fixtures."""
import copy
import importlib.util
import json
import pathlib
import tempfile
import types
import unittest
from unittest.mock import patch
from kit_contract import MEMORY_MAX,SAMPLED_NONRECLAIMABLE_MAX,sha
from kit_budget import Budget,TABLE
from kit_ops import ProductionOps,BudgetedCli
from kit_owned import cli_spec
from kit_integrity import DATA_MOUNT
from kit_preservation import inventory_preserved,serving_memory_summary
from kit_runtime import (PREDECESSOR_ID,RETAINED_PREDECESSOR_NAME,CANDIDATE_OWNER,candidate_spec)
from kit_emergency_ingress import EmergencyIngress
from retained_health import load_health
from kit_recovery import recovery_gate,OLD_SWAP_MAX
from retained_memory import STAT_REQUIRED,EVENT_REQUIRED
from build_stop_post import render,SPECS,nodes
from verify_kit_runtime import old,new,IDENTITY
from verify_kit_owned import obj

HERE=pathlib.Path(__file__).resolve().parent
FIXTURES=HERE/'controller-local-retained-fixtures'

def directory():
    FIXTURES.mkdir(exist_ok=True);return pathlib.Path(tempfile.mkdtemp(prefix='owned-',dir=FIXTURES)).resolve()


class IntegratedBudget(unittest.TestCase):
    def test_real_copy_budget_closes_actual_ops_installer_boundaries_and_refuses_skipped_cli_claim(self):
        budget=Budget(4096,4096,1);completed=[]
        class Disk:
            def __init__(self):self.budget=budget
            def check(self,*args):return 10**12
            def begin(self,label):budget.begin(label,10**12)
            def finish(self,label):completed.append(budget.finish(label,0)['stage'])
        disk=Disk();ops=ProductionOps.__new__(ProductionOps);ops.disk=disk
        class Cli:
            def __init__(self):self.calls=[]
            def run(self,spec):self.calls.append(spec['label']);return b'{}',{}
        cli=Cli();wrapped=BudgetedCli(cli,disk)
        # Refuse an undeclared copy producer before starting its actual CLI.
        disk.begin('stopped-backup')
        with self.assertRaises(RuntimeError):wrapped.run(cli_spec('canonical-policy',DATA_MOUNT))
        self.assertFalse(cli.calls)
        for site in ('seal-directory','triple','triple','reader-index','backup','assets'):budget.claim(site);budget.copy_ceiling(site)
        disk.finish('stopped-backup')
        class Installs:
            def canonical_policy(self):return wrapped.run(cli_spec('canonical-policy',DATA_MOUNT))
            def impact(self,issue):
                if issue=='209':wrapped.run(cli_spec('order-impact',DATA_MOUNT))
                return {'issue':issue}
            def dry(self,issue):
                budget.claim('clone');budget.copy_ceiling('clone');return wrapped.run(cli_spec(issue+'-dry',DATA_MOUNT))
            def apply_once(self,issue):return wrapped.run(cli_spec(issue+'-apply',DATA_MOUNT))
            def preserve(self,issue):
                for site in ('seal-directory','triple','triple','reader-index','backup'):budget.claim(site);budget.copy_ceiling(site)
                return {'retained':True}
            def repeat(self,issue):return wrapped.run(cli_spec(issue+'-repeat',DATA_MOUNT))
        ops.installs=Installs();ops.require_canonical_policy_noop()
        for issue in ('206','214','209'):
            ops.verify_reviewed_impact(issue);ops.installer_dry(issue);ops.installer_apply_once(issue)
            ops.preserve_installer_full_state(issue);ops.installer_repeat_noop(issue)
        self.assertEqual(completed,[r['stage'] for r in TABLE[:7]])
        self.assertEqual(len(cli.calls),11)
        self.assertIsNone(budget.active)

    def test_cli_stop_failure_does_not_skip_candidate_lost_return_stop(self):
        ops=ProductionOps.__new__(ProductionOps);calls=[]
        def failed():calls.append('cli');raise OSError('SYNTHETIC_EVIDENCE_FAILURE')
        ops.stop_clis=failed;ops.predecessor=types.SimpleNamespace(emergency=object())
        ops.candidate=types.SimpleNamespace(stop_for_intent=lambda call:calls.append('candidate') or {'stoppedAndRetained':True})
        with self.assertRaises(RuntimeError):ops.stop_exact_candidate_for_intent(None,None,10)
        self.assertEqual(calls,['cli','candidate'])


class Preservation(unittest.TestCase):
    def test_all_historical_full_objects_preserved_and_new_unknown_or_running_cli_refused(self):
        before={PREDECESSOR_ID:old()};spec=candidate_spec(old(),load_health(HERE));candidate=new(spec)
        after=copy.deepcopy(before);after[PREDECESSOR_ID]['Name']='/'+RETAINED_PREDECESSOR_NAME
        after[PREDECESSOR_ID]['State']['Running']=False;after[IDENTITY]=candidate
        self.assertTrue(inventory_preserved(before,after,IDENTITY)['allOriginalContainersPreserved'])
        for field in ('source','startedAt','config','missing','unknown'):
            changed=copy.deepcopy(after)
            if field=='source':changed[PREDECESSOR_ID]['Mounts'][0]['Source']='/foreign'
            elif field=='startedAt':changed[PREDECESSOR_ID]['State']['StartedAt']='CHANGED'
            elif field=='config':changed[PREDECESSOR_ID]['Config']['Env'].append('CHANGED=true')
            elif field=='missing':del changed[PREDECESSOR_ID]
            else:changed['f'*64]=copy.deepcopy(candidate);changed['f'*64]['Config']['Labels']={}
            with self.subTest(field=field),self.assertRaises(RuntimeError):inventory_preserved(before,changed,IDENTITY)

    def test_running_final_memory_is_not_labelled_before_stop(self):
        sample={'phase':'before-controller-exit','memoryEvents':{'oom':0,'oom_kill':0},
            'nonReclaimableBytes':1,'memoryPeakBytesObservation':MEMORY_MAX+1}
        class History:
            samples=[sample];descriptor={'identity':'SYNTHETIC'};evidence_allocated=0
            def reserve_evidence(self,n):self.evidence_allocated+=n
        history=History();value=serving_memory_summary(history,123)
        self.assertTrue(value['hostBeforeControllerExitEventsChecked']);self.assertFalse(value['candidateStoppedForThisSummary'])
        self.assertNotIn('hostBeforeStopEventsChecked',value)
        sample['phase']='before-stop'
        with self.assertRaises(RuntimeError):serving_memory_summary(history,123)

    def test_early_recovery_uses_existing_old_swap_without_claiming_new_candidate_swap0(self):
        sample={'events':dict.fromkeys(EVENT_REQUIRED,0),'stat':dict.fromkeys(STAT_REQUIRED,0),
            'memoryMax':MEMORY_MAX,'swapMax':OLD_SWAP_MAX}
        self.assertEqual(recovery_gate(sample),0)
        sample['swapMax']=0
        with self.assertRaises(RuntimeError):recovery_gate(sample)
        sample['swapMax']=OLD_SWAP_MAX;sample['events']['oom_kill']=1
        with self.assertRaises(RuntimeError):recovery_gate(sample)


class StandaloneStop(unittest.TestCase):
    def hook(self):
        raw=(HERE/'stop_post.py').read_text(encoding='utf-8');self.assertEqual(raw,render())
        scope={'__name__':'synthetic_standalone_hook'}
        # No kit or retained module import is available to this generated code.
        builtin=__import__('builtins');original=builtin.__import__
        def importing(name,*args,**kwargs):
            if name.startswith(('kit_','retained_')):raise ImportError('SYNTHETIC_MISSING_ALL_LOCAL_MODULES')
            return original(name,*args,**kwargs)
        with patch('builtins.__import__',side_effect=importing):exec(compile(raw,'standalone-fixture','exec'),scope)
        return scope

    def scenario(self,scope,controller_fail=False,hold_fail=False,retention_fail=False,leave=False):
        root=directory();(root/'production-gate-consumed.json').write_bytes(b'SYNTHETIC_GATE_PRESENT')
        cli_specification=cli_spec('209-apply',DATA_MOUNT);cli=obj(cli_specification)
        candidate=new(candidate_spec(old(),load_health(HERE)));calls=[];retained=[]
        class Call:
            retention_errors=[]
            def __call__(self,argv):
                calls.append(argv)
                if argv[1]=='ps':
                    owner=argv[-1].split('=',2)[-1]
                    if owner==cli_specification['owner']:return (cli['Id']+'\n').encode()
                    if owner==CANDIDATE_OWNER:return (candidate['Id']+'\n').encode()
                    return b''
                if argv[1]=='inspect':return json.dumps([cli if argv[-1]==cli['Id'] else candidate]).encode()
                if argv[1]=='stop':
                    value=cli if argv[-1]==cli['Id'] else candidate;value['State']['Running']=False
                    value['State']['ExitCode']=137;return value['Id'].encode()
                raise AssertionError(argv)
        call=Call()
        def controller():
            calls.append(['SYNTHETIC_CONTROLLER'])
            if controller_fail:raise RuntimeError('SYNTHETIC_CONTROLLER_OOM')
            return {'events':{'oom':0,'oom_kill':0}}
        def hold():
            calls.append(['SYNTHETIC_HOLD'])
            if hold_fail:raise OSError('SYNTHETIC_FULL_FILESYSTEM')
            return {'holding503':True}
        def permit():
            if retention_fail:call.retention_errors=[{'errorType':'SYNTHETIC_RETENTION_FAILURE'}]
            if not leave:raise ImportError('SYNTHETIC_BROKEN_FROZEN_SOURCE')
            return {'leaveCandidateServing':True,'id':candidate['Id']}
        result=scope['stop_post_lifecycle'](root,call,permit,hold,controller,retained.append)
        return result,calls,cli,candidate,retained

    def test_missing_all_controller_modules_source_failure_still_stops_cli_and_candidate(self):
        scope=self.hook();result,calls,cli,candidate,retained=self.scenario(scope)
        self.assertFalse(cli['State']['Running']);self.assertFalse(candidate['State']['Running'])
        self.assertLess(calls.index(['docker','stop','-t','10',cli['Id']]),calls.index(['SYNTHETIC_CONTROLLER']))
        self.assertTrue(result['errors']);self.assertEqual(len(retained),1)

    def test_controller_oom_or_failed_rehold_or_raw_retention_cannot_suppress_stops(self):
        scope=self.hook()
        for options in ({'controller_fail':True},{'hold_fail':True},{'retention_fail':True,'leave':True}):
            result,calls,cli,candidate,retained=self.scenario(scope,**options)
            self.assertFalse(cli['State']['Running']);self.assertFalse(candidate['State']['Running'])
            self.assertTrue(result['errors']);self.assertIsNone(result['candidateLeavePermission'])

    def test_valid_terminal_callback_leaves_candidate_running_after_all_cli_stops(self):
        result,calls,cli,candidate,retained=self.scenario(self.hook(),leave=True)
        self.assertFalse(cli['State']['Running']);self.assertTrue(candidate['State']['Running'])
        self.assertFalse(result['errors']);self.assertFalse(any(c[0]=='SYNTHETIC_HOLD' for c in calls))

    def test_foreign_candidate_mount_refuses_stop_but_cli_stops_still_complete(self):
        scope=self.hook();candidate=new(candidate_spec(old(),load_health(HERE)));candidate['Mounts'][0]['Source']='/foreign'
        calls=[]
        def call(argv):
            calls.append(argv)
            return IDENTITY.encode() if argv[1]=='ps' else json.dumps([candidate]).encode()
        with self.assertRaises(RuntimeError):scope['stop_candidate_compiled'](call)
        self.assertFalse(any(argv[1]=='stop' for argv in calls))

    def test_independent_emergency_ingress_uses_local_reviewed_bytes_without_any_journal(self):
        root=directory();conf=root/'synthetic-apache.conf';conf.write_bytes(b'SYNTHETIC_ORIGINAL');calls=[]
        def call(argv):calls.append(argv);return b'503' if argv[0]=='curl' else b''
        hold=EmergencyIngress(root,call,b'SYNTHETIC_ORIGINAL',b'SYNTHETIC_503',sha(b'SYNTHETIC_ORIGINAL'),
            sha(b'SYNTHETIC_503'),conf=conf,production=False)
        result=hold();self.assertTrue(result['holding503']);self.assertEqual(conf.read_bytes(),b'SYNTHETIC_503')
        self.assertEqual(len(calls),4);self.assertFalse(list(root.glob('*intent*')))
        conf.write_bytes(b'UNKNOWN')
        with self.assertRaises(RuntimeError):hold()

