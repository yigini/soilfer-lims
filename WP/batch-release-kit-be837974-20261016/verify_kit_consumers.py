"""Inventory observations need exact review; fake transports never touch a host."""
import copy
import json
import unittest
from kit_contract import canonical,sha
from kit_consumer_inventory import (collect,unit_catalogue,loaded_catalogue,docker_projection,process_commands,
    require_reviewed_inventory,unit_behavior,exec_configuration,passive_scope,own_controller,
    EXEC_PROPERTIES,BEHAVIOR_PROPERTIES)
from kit_docker import ContainerReader

CID='a'*64
def behavior(unit,command=None):
    value={name:'' for name in BEHAVIOR_PROPERTIES}
    value.update(Id=unit,LoadState='loaded',Transient='no',WatchdogUSec='0',Restart='no',
        FailureAction='none',SuccessAction='none',StartLimitAction='none',StopWhenUnneeded='no',
        RefuseManualStart='no',RefuseManualStop='no')
    if command:value['ExecStart']=exec_record(command)
    return value
def exec_record(command,pid=1):
    return '{ path='+command.split()[0]+' ; argv[]='+command+' ; ignore_errors=no ; start_time=[Fri 2026-10-16 12:00:00 UTC] ; stop_time=[n/a] ; pid='+str(pid)+' ; code=(null) ; status=0/0 }'
def show_bytes(value):return ''.join(name+'='+value[name]+'\n' for name in BEHAVIOR_PROPERTIES).encode()

class Runner:
    def __init__(self):self.calls=[]
    def run(self,argv,label,timeout):
        self.calls.append((argv,label))
        if argv[0]=='ps':raw=b'1 0 init /sbin/init\n'
        elif 'list-unit-files' in argv:raw=b'benign.service enabled enabled\nbenign.timer enabled enabled\n'
        elif 'list-units' in argv:raw=b'benign.service loaded active running Synthetic service\nbenign.timer loaded active waiting Synthetic timer\ntransient.service loaded active running Synthetic transient\nsession-1.scope loaded active running Synthetic scope\n'
        elif 'show' in argv:raw=show_bytes(behavior(argv[2],'/bin/true' if argv[2].endswith('.service') else None))
        elif 'list-timers' in argv:raw=b'SYNTHETIC_TIMER_TIMES benign.timer benign.service\n'
        else:raw=b'# SYNTHETIC BENIGN UNIT\n[Service]\nExecStart=/bin/true\n'
        return raw,b'',{'stdout':{'bytes':len(raw)}}
class Reader:
    def inventory(self):return {CID:{'Id':CID,'Name':'/synthetic','Image':'sha256:'+'b'*64,'Config':{'Labels':{},'Env':['SYNTHETIC_ONLY=true']},'HostConfig':{'RestartPolicy':{'Name':'no'}}}}

class ConsumerGuards(unittest.TestCase):
    def observed(self):return collect(Reader(),Runner(),cron_reader=lambda **_: {})
    def review(self,current):return {'exactKitReviewPassed':True,'reviewedConsumerConfigurationSha256':current['configurationSha256'],
        'noHostConsumerActsOnUnhealthyWindow':True,'reviewedAllowedProcessCommandSha256':current['observedProcessCommandSha256'],
        'reviewedAllowedActiveTimerNames':current['activeTimerNames']}

    def test_collection_never_claims_monitor_absence_without_exact_review(self):
        current=self.observed();self.assertIsNone(current['noConsumerVerdict'])
        with self.assertRaises(RuntimeError):require_reviewed_inventory(current,{})
        require_reviewed_inventory(current,self.review(current))

    def test_changed_config_or_unreviewed_command_refuses_gate(self):
        current=self.observed();review=self.review(current)
        changed=copy.deepcopy(current);changed['configuration']['cron']['unknown']={'exists':True}
        with self.assertRaises(RuntimeError):require_reviewed_inventory(changed,review)
        changed=copy.deepcopy(current);changed['observedProcessCommandSha256'].append('c'*64)
        with self.assertRaises(RuntimeError):require_reviewed_inventory(changed,review)
        changed=copy.deepcopy(current);changed['activeTimerNames'].append('unknown.timer')
        with self.assertRaises(RuntimeError):require_reviewed_inventory(changed,review)

    def test_duplicate_truncated_and_unknown_unit_catalogues_refuse(self):
        for raw in (b'',b'a.service enabled\na.service disabled\n',b'UNKNOWN FOOTER',b'a.service enabled extra truncated'):
            with self.assertRaises(RuntimeError):unit_catalogue(raw)
        self.assertIn('dev-disk-by\\x2duuid.scope',unit_catalogue(b'dev-disk-by\\x2duuid.scope static -\n'))

    def test_common_autoheal_label_requires_separate_direction(self):
        rows=Reader().inventory();rows[CID]['Config']['Labels']['autoheal']='true'
        with self.assertRaises(RuntimeError):docker_projection(rows)

    def test_process_classes_ignore_pid_noise_without_sorting_command_arguments(self):
        a=process_commands(b'10 1 worker python worker.py --a --b\n',999)
        self.assertEqual(a,process_commands(b'11 1 worker python worker.py --a --b\n',999))
        self.assertNotEqual(a,process_commands(b'11 1 worker python worker.py --b --a\n',999))

    def test_complete_docker_inventory_requires_exact_ids_not_error_strings(self):
        class Transport:
            def __init__(self,raw):self.raw=raw
            def run(self,argv,label,timeout,output_limits=None):
                assert output_limits=={'stdout':4*1024**2,'stderr':64*1024**2}
                raw=self.raw if argv[1]=='ps' else json.dumps([{'Id':CID,'Name':'/synthetic'}]).encode()
                return raw,b'',{'stdout':{'bytes':len(raw)}}
        reader=ContainerReader(Transport((CID+'\n').encode()),CID)
        self.assertEqual(set(reader.inventory()),{CID})
        for raw in (b'',b'No such object\n',(CID+'\n'+CID+'\n').encode()):
            with self.assertRaises(RuntimeError):ContainerReader(Transport(raw),CID).inventory()

    def test_loaded_transient_service_is_included_and_both_rounds_are_complete(self):
        runner=Runner();current=collect(Reader(),runner,cron_reader=lambda **_: {})
        self.assertIn('transient.service',current['configuration']['units'])
        self.assertEqual(len(current['configuration']['passiveScopeClasses']),1)
        self.assertEqual(len(current['passObservations']),2)
        self.assertTrue(current['loadedAndTransientUnitsIncluded'])
        self.assertEqual(sum('list-units' in argv for argv,_ in runner.calls),4)
        self.assertEqual(sum('list-unit-files' in argv for argv,_ in runner.calls),4)
        self.assertEqual(sum('list-timers' in argv for argv,_ in runner.calls),4)
        self.assertEqual(len({label for _,label in runner.calls}),len(runner.calls))

    def test_unit_addition_midpass_and_changed_exec_between_passes_refuse(self):
        class Drift(Runner):
            def __init__(self,kind):super().__init__();self.kind=kind
            def run(self,argv,label,timeout):
                raw,err,meta=super().run(argv,label,timeout)
                if self.kind=='catalogue' and 'pass-1-end-loaded-catalogue' in label:
                    raw+=b'new.service loaded active running Changed\n'
                if self.kind=='exec' and 'pass-2-' in label and 'show' in argv and argv[2]=='transient.service':
                    raw=show_bytes(behavior(argv[2],'/bin/false'))
                return raw,err,meta
        for kind in ('catalogue','exec'):
            with self.assertRaises(RuntimeError):collect(Reader(),Drift(kind),cron_reader=lambda **_: {})

    def test_changed_cron_or_docker_configuration_between_passes_refuses(self):
        cron_calls=[]
        def cron(**kwargs):cron_calls.append(1);return {'files':len(cron_calls)}
        with self.assertRaises(RuntimeError):collect(Reader(),Runner(),cron_reader=cron)
        class ChangedReader(Reader):
            def __init__(self):self.n=0
            def inventory(self):
                value=super().inventory();self.n+=1
                value[CID]['Config']['Env']=['SYNTHETIC='+str(self.n)];return value
        with self.assertRaises(RuntimeError):collect(ChangedReader(),Runner(),cron_reader=lambda **_: {})

    def test_only_enumerated_exec_runtime_results_are_normalized(self):
        a=exec_configuration(exec_record('/bin/true --first --second',1))
        self.assertEqual(a,exec_configuration(exec_record('/bin/true --first --second',999)))
        self.assertNotEqual(a,exec_configuration(exec_record('/bin/true --second --first')))
        for invalid in ('/bin/true',exec_record('/bin/true')+' UNKNOWN',exec_record('/bin/true').replace(' ; pid=1',' ; other=1'),
            exec_record('/bin/true ; status=HIDDEN')):
            with self.assertRaises(RuntimeError):exec_configuration(invalid)
        raw=show_bytes(behavior('a.service','/bin/true'))
        with self.assertRaises(RuntimeError):unit_behavior(raw+b'ExecStart=unexpected\n','a.service')
        with self.assertRaises(RuntimeError):unit_behavior(raw.replace(b'Restart=no\n',b''),'a.service')

    def test_scope_class_never_hides_executable_or_lifecycle_action(self):
        value=unit_behavior(show_bytes(behavior('session-1.scope')),'session-1.scope')
        passive_scope(value)
        for key,content in [('ExecStart',['/bin/autoheal']),('OnFailure','heal.service'),('Triggers','heal.timer'),
            ('Restart','always'),('WatchdogUSec','30s'),('StopWhenUnneeded','yes'),('DropInPaths','/run/changed.conf')]:
            changed=copy.deepcopy(value);changed[key]=content
            with self.assertRaises(RuntimeError):passive_scope(changed)

    def test_compiled_controller_requires_exact_start_and_nonignored_stop_post(self):
        from retained_contract import ROOT,ROOT_NAME
        name='lims-'+ROOT_NAME.lower()+'.service';value=behavior(name)
        value['Transient']='yes';value['ExecStart']=exec_record('/usr/bin/python3 -B '+str(ROOT/'tooling/run_release.py')+' --root '+str(ROOT))
        value['ExecStopPost']=exec_record('/usr/bin/python3 -B '+str(ROOT/'tooling/stop_post.py'))
        current=unit_behavior(show_bytes(value),name);own_controller(current)
        for key,content in [('ExecStart',[]),('ExecStopPost',[]),('ExecStartPost',['unexpected']),
            ('Transient','no'),('Restart','always'),('OnFailure','autoheal.service')]:
            changed=copy.deepcopy(current);changed[key]=content
            with self.assertRaises(RuntimeError):own_controller(changed)

    def test_old_persistent_only_or_single_pass_claim_refuses_even_with_old_review(self):
        current=self.observed();review=self.review(current)
        for key in ('loadedAndTransientUnitsIncluded','configurationEqualAcrossBothPasses',
            'independentCompletePasses','cataloguesReenumeratedAfterEachPass'):
            changed=copy.deepcopy(current);del changed[key]
            with self.assertRaises(RuntimeError):require_reviewed_inventory(changed,review)
        for raw in (b'',b'a.service not-found inactive dead Missing\n',b'a.service loaded active running\na.service loaded active running\n'):
            with self.assertRaises(RuntimeError):loaded_catalogue(raw)

    def test_only_exact_new_controller_can_appear_between_review_and_runtime_inventory(self):
        from retained_contract import ROOT,ROOT_NAME
        own='lims-'+ROOT_NAME.lower()+'.service'
        baseline=self.observed()
        class ControllerRunner(Runner):
            def __init__(self,bad=False):super().__init__();self.bad=bad
            def run(self,argv,label,timeout):
                raw,err,meta=super().run(argv,label,timeout)
                if 'list-units' in argv:raw+=(own+' loaded active running Synthetic reviewed controller\n').encode()
                if 'show' in argv and argv[2]==own:
                    value=behavior(own);value['Transient']='yes'
                    value['ExecStart']=exec_record('/usr/bin/python3 -B '+str(ROOT/'tooling/run_release.py')+' --root '+str(ROOT))
                    value['ExecStopPost']=exec_record('/usr/bin/python3 -B '+str(ROOT/'tooling/stop_post.py')) if not self.bad else ''
                    raw=show_bytes(value)
                return raw,err,meta
        current=collect(Reader(),ControllerRunner(),cron_reader=lambda **_: {})
        self.assertEqual(current['configurationSha256'],baseline['configurationSha256'])
        self.assertTrue(all(p['compiledControllerObserved'] for p in current['passObservations']))
        with self.assertRaises(RuntimeError):collect(Reader(),ControllerRunner(True),cron_reader=lambda **_: {})

if __name__=='__main__':unittest.main()
