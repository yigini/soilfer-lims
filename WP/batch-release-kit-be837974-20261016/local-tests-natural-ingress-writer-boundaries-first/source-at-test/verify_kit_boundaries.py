"""New local files and controlled interfaces; no host/HTTP/Docker operation."""
import copy
import json
import os
import pathlib
import tempfile
import unittest
from unittest.mock import patch
from kit_no_writers import access_flags,assert_no_volume_writers
from kit_ingress import Ingress
from kit_contract import sha,FIVE_COUNTS
from kit_natural import NaturalIntake
from kit_readiness import EXPECTED_HTTP

HERE=pathlib.Path(__file__).resolve().parent
FIXTURES=HERE/'boundary-local-retained-fixtures'

def directory():
    FIXTURES.mkdir(exist_ok=True)
    return pathlib.Path(tempfile.mkdtemp(prefix='owned-',dir=FIXTURES)).resolve()

class Boundaries(unittest.TestCase):
    def test_descriptor_modes_and_any_related_rw_mount_refuse(self):
        self.assertEqual(access_flags(b'pos:\t0\nflags:\t0100000\n'),os.O_RDONLY)
        self.assertEqual(access_flags(b'flags:\t0100002\n'),os.O_RDWR)
        for raw in (b'',b'flags:\t08\n',b'flags:\t0\nflags:\t0\n'):
            with self.assertRaises(RuntimeError):access_flags(raw)
        root=directory();data=root/'data';assets=root/'assets';data.mkdir();assets.mkdir();(data/'dev.db').write_bytes(b'SYNTHETIC')
        row={'Id':'a'*64,'State':{'Running':True},'Mounts':[{'Source':str(data),'RW':True}]}
        class Reader:
            def inventory(self):return {'a'*64:copy.deepcopy(row)}
        with self.assertRaises(RuntimeError):assert_no_volume_writers(Reader(),lambda p:{},(str(data),str(assets)))
        row['Mounts'][0]['RW']=False
        value=assert_no_volume_writers(Reader(),lambda p:{'complete':True,'writableProtectedDescriptors':0},(str(data),str(assets)))
        self.assertTrue(value['noRunningProtectedVolumeWriter'])
        with self.assertRaises(RuntimeError):assert_no_volume_writers(Reader(),lambda p:{'complete':False},(str(data),str(assets)))

    def test_real_local_ingress_bytes_hold_and_reopen_only_exact_reviewed_config(self):
        root=directory();conf=root/'synthetic-apache.conf';original=b'SYNTHETIC_ORIGINAL\n';held=b'SYNTHETIC_503\n';conf.write_bytes(original)
        calls=[]
        class Runner:
            def run(self,argv,*args,**kwargs):calls.append(argv);return b'',b'',{}
        class Http:
            def external(self,path,method,want):return {'path':path,'method':method,'status':want}
        ingress=Ingress(root,Runner(),Http(),original,held,sha(original),sha(held),conf,False)
        self.assertTrue(ingress.transition(True)['holding503']);self.assertEqual(conf.read_bytes(),held)
        self.assertFalse(ingress.transition(False)['holding503']);self.assertEqual(conf.read_bytes(),original)
        self.assertEqual(len(calls),4)
        conf.write_bytes(b'UNREVIEWED_SYNTHETIC_CONFIG')
        with self.assertRaises(RuntimeError):ingress.transition(True)
        self.assertEqual(len(calls),4)

    def test_failed_configtest_never_reports_a_verified_hold(self):
        root=directory();conf=root/'synthetic-apache.conf';conf.write_bytes(b'BEFORE')
        class Runner:
            def run(self,*args,**kwargs):raise RuntimeError('SYNTHETIC_CONFIGTEST_FAILURE')
        ingress=Ingress(root,Runner(),None,b'BEFORE',b'HELD',sha(b'BEFORE'),sha(b'HELD'),conf,False)
        with self.assertRaises(RuntimeError):ingress.transition(True)
        self.assertEqual(conf.read_bytes(),b'HELD');self.assertFalse(list(root.glob('*complete.json')))

class NaturalBoundary(unittest.TestCase):
    def test_first_counts_are_backed_by_full_comparator_and_second_does_not_read_human_rows(self):
        root=directory();baseline=root/'baseline.db';baseline.write_bytes(b'SYNTHETIC_BASELINE_NOT_SQLITE')
        before={name:{'count':10} for name in FIVE_COUNTS};after=copy.deepcopy(before)
        after['Sample']['count']=12;after['AuditLog']['count']=13
        fetched={'config':{'submissionIds':['1']}};compares=[];records=[]
        from retained_runtime_policy import TARGET_CONFIG
        active={TARGET_CONFIG:{'id':TARGET_CONFIG,'labId':'ZMB-LAB1','projectCode':'SOILFER-US','syncIntervalMins':15,'lastSubmissionId':'0'}}
        refused=[{'configId':'refused-'+str(i)} for i in range(4)]
        class Journal:
            def append(self,phase,value):records.append(phase)
        class Monitor:
            def observe(self,*args):pass
        class Cli:
            def run(self,spec):
                d=root/'first-sync-backup-retained-temp';d.mkdir();path=d/'backup.db';path.write_bytes(b'SYNTHETIC_CONSISTENT_BACKUP')
                value={'backupPath':'/tmp/backup.db','bytes':path.stat().st_size,'sha256':sha(path.read_bytes()),'sourceReadonly':True,
                    'kernelReadOnlyDataMountRequired':True,'consistentBackup':True,'neverRetry':True}
                return json.dumps(value).encode(),{'synthetic':True}
        def compare(*args,**kwargs):
            compares.append((args,kwargs))
            return {'additions':{'Sample':[{'id':'new1'},{'id':'new2'}],'AuditLog':[{'id':str(i)} for i in range(3)]}}
        first={'utc':'2026-10-16T11:00:00Z','epochSeconds':1792148400,'labId':'ZMB-LAB1','newSamples':2,'skipped':0}
        second={**first,'utc':'2026-10-16T11:15:00Z','epochSeconds':first['epochSeconds']+900,'newSamples':0}
        def observed(completed):
            return {'utc':'2026-10-16T11:17:00Z','completedTargetSyncs':completed,
                'perConfigCompletions':{TARGET_CONFIG:completed},'perLabCompletions':{'ZMB-LAB1':completed},
                'exactPairedRefusals':[{'configId':r['configId']} for r in refused for i in range(2)]}
        with patch('kit_natural.configs',return_value=(active,refused,15)):
            natural=NaturalIntake(root,baseline,{'tables':before},Cli(),None,lambda:{'RestartCount':0},Monitor(),Journal(),
                capture_fetch=lambda *a,**k:fetched,compare=compare,clock=lambda:0,wall=lambda:9999999999)
        natural.capture_before_start()
        with patch.object(natural,'observation',return_value=observed([first])),patch('kit_natural.logical',return_value={'tables':after}),
             patch('kit_natural.intake_summary',return_value={'syntheticIntake':True}):
            result=natural.first_full_preservation({'readyUtc':'2026-10-16T10:59:59Z'})
        self.assertTrue(result['sealedBeforeIngressReopens']);self.assertEqual(result['fiveCounts']['intakeDelta']['AuditLog'],3)
        with patch.object(natural,'observation',return_value=observed([first,second])),patch('kit_natural.logical',side_effect=AssertionError('Do not inspect post-reopen human rows')):
            result=natural.second_receipt_after_reopen()
        self.assertTrue(result['interveningHumanWritesNotAttributedToKobo']);self.assertFalse(result['newFullDatabaseIdempotenceProofClaimed'])
        self.assertEqual(len(compares),1)

if __name__=='__main__':unittest.main()
