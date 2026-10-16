"""Inventory observations need exact review; fake transports never touch a host."""
import copy
import json
import unittest
from kit_contract import canonical,sha
from kit_consumer_inventory import collect,unit_catalogue,docker_projection,process_commands,require_reviewed_inventory
from kit_docker import ContainerReader

CID='a'*64
class Runner:
    def run(self,argv,label,timeout):
        if argv[0]=='ps':raw=b'1 0 init /sbin/init\n'
        elif 'list-unit-files' in argv:raw=b'benign.service enabled enabled\nbenign.timer enabled enabled\n'
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
            def run(self,argv,label,timeout):
                raw=self.raw if argv[1]=='ps' else json.dumps([{'Id':CID,'Name':'/synthetic'}]).encode()
                return raw,b'',{'stdout':{'bytes':len(raw)}}
        reader=ContainerReader(Transport((CID+'\n').encode()),CID)
        self.assertEqual(set(reader.inventory()),{CID})
        for raw in (b'',b'No such object\n',(CID+'\n'+CID+'\n').encode()):
            with self.assertRaises(RuntimeError):ContainerReader(Transport(raw),CID).inventory()

if __name__=='__main__':unittest.main()
