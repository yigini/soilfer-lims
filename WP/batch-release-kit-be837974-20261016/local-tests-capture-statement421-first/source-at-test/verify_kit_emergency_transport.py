"""Bounded real local emergency children; no Docker, Apache or hook execution."""
import json
import os
import pathlib
import subprocess
import sys
import tempfile
import unittest
from unittest.mock import patch
import kit_evidence as evidence
from kit_stop import EmergencyCommands

FIXTURES=pathlib.Path(__file__).parent/'emergency-local-retained-fixtures'
ID='a'*64

class EmergencyTransportTests(unittest.TestCase):
    def command(self,code,namespace='controller'):
        FIXTURES.mkdir(exist_ok=True)
        root=pathlib.Path(tempfile.mkdtemp(prefix='owned-',dir=FIXTURES)).resolve()
        launched=[]
        def spawn(argv,**kwargs):
            launched.append(argv)
            return subprocess.Popen([sys.executable,'-c',code],**kwargs)
        return root,EmergencyCommands(root,os.name=='posix',spawn,namespace),launched

    def test_complete_binary_originals_need_both_eofs_even_after_fast_child_exit(self):
        root,call,launched=self.command('import os;os.write(1,bytes(range(256))*32);os.write(2,b"E"*17)')
        with patch('kit_stop.EMERGENCY_STREAM_LIMITS',{'stdout':8192,'stderr':17}):
            self.assertEqual(call(['apachectl','configtest']),bytes(range(256))*32)
        result=json.loads((root/'emergency-controller-000001.json').read_bytes())
        self.assertTrue(result['completeNotTruncated'])
        self.assertEqual(result['eofObserved'],{'stdout':True,'stderr':True})
        self.assertEqual((root/'emergency-controller-000001.stderr').read_bytes(),b'E'*17)
        self.assertEqual(len(launched),1)

    def test_both_fast_exit_and_between_poll_bursts_have_only_one_overflow_byte(self):
        for code in ['import os;os.write(1,b"A"*8193)',
                     'import os;os.write(1,b"A"*262144);os.write(2,b"E"*262144)']:
            root,call,launched=self.command(code,'stop-post')
            with patch('kit_stop.EMERGENCY_STREAM_LIMITS',{'stdout':8192,'stderr':17}),self.assertRaises(RuntimeError):
                call(['docker','inspect',ID])
            result=json.loads((root/'emergency-stop-post-000001.json').read_bytes())
            self.assertFalse(result['completeNotTruncated'])
            self.assertLessEqual(result['stdout']['bytes'],8193);self.assertLessEqual(result['stderr']['bytes'],18)
            self.assertTrue(any(result['outputLimitExceeded'].values()))

    def test_shared_quota_failure_does_not_charge_or_prevent_independent_stops(self):
        root,call,launched=self.command('print("SYNTHETIC_STOP")')
        book=evidence.EvidenceLedger(root,dict.fromkeys(evidence.SHARES,4096))
        with patch('kit_evidence._runtime',book):
            self.assertEqual(call(['docker','stop','-t','10',ID]),b'SYNTHETIC_STOP\r\n' if os.name=='nt' else b'SYNTHETIC_STOP\n')
        self.assertFalse(call.retention_errors);self.assertEqual(sum(book.used.values()),0)
        self.assertTrue((root/'emergency-controller-000001.json').is_file())

    def test_exhausted_retention_envelope_still_launches_every_following_stop(self):
        root,call,launched=self.command('import os;os.write(1,b"SYNTHETIC_STOP")')
        call.sequence=evidence.EMERGENCY_CALL_LIMIT
        self.assertEqual(call(['docker','stop','-t','10',ID]),b'SYNTHETIC_STOP')
        self.assertEqual(call(['docker','stop','-t','10','b'*64]),b'SYNTHETIC_STOP')
        self.assertEqual(len(launched),2);self.assertEqual(len(call.retention_errors),2)
        self.assertFalse(list(root.iterdir()))

    def test_each_namespace_worst_case_counts_data_hardlinks_and_entries_within_400mib(self):
        per_call=sum(evidence.allocation(n+1) for n in evidence.EMERGENCY_STREAM_LIMITS.values())
        per_call+=evidence.allocation(evidence.EMERGENCY_METADATA_LIMIT,2)
        self.assertLessEqual(per_call*evidence.EMERGENCY_CALL_LIMIT,evidence.EMERGENCY_NAMESPACE_BYTES)
        self.assertEqual(evidence.EMERGENCY_CALL_LIMIT,96)
        self.assertEqual(evidence.INDEPENDENT_EMERGENCY_BYTES,800*1024**2)

if __name__=='__main__':unittest.main()
