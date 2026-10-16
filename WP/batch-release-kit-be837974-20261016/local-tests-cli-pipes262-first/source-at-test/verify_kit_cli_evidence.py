"""Pre-create admission and exact raw retention, NEW LOCAL files/stand-ins only."""
import ast
import hashlib
import json
import os
import pathlib
import sys
import tempfile
import unittest
from unittest.mock import patch
import kit_evidence as evidence
import retained_controller as controller
from kit_cli_evidence import CLI_ENVELOPE,CLI_INSPECTIONS,CLI_COMMANDS,bounds,begin_cli_evidence
from kit_io import CommandRunner
from kit_journal import Journal
from kit_integrity import DATA_MOUNT
from kit_owned import cli_spec
from retained_files import write_new
from verify_kit_owned import StandIn

HERE=pathlib.Path(__file__).resolve().parent
FIXTURES=HERE/'cli-envelope-local-retained-fixtures'


def directory():
    FIXTURES.mkdir(exist_ok=True)
    return pathlib.Path(tempfile.mkdtemp(prefix='owned-',dir=FIXTURES)).resolve()


class CliEvidence(unittest.TestCase):
    def test_full_source_bounds_fit_one_shared_pool_without_claiming_all_future_clis_fit(self):
        physical=bounds()
        self.assertEqual(CLI_INSPECTIONS,608);self.assertEqual(CLI_COMMANDS,612)
        self.assertEqual(sum(CLI_ENVELOPE.values()),2980*1024**2)
        self.assertTrue(all(physical[k]<=CLI_ENVELOPE[k] for k in physical))
        self.assertLess(sum(CLI_ENVELOPE.values()),sum(evidence.SHARES.values()))
        book=evidence.EvidenceLedger(directory())
        with patch('kit_evidence._runtime',book):
            window=begin_cli_evidence('206-apply')
            self.assertEqual(book.used,CLI_ENVELOPE)
            self.assertFalse(book.summary()['fullGlobalEvidenceClosure'])
            window.close()
        self.assertEqual(sum(book.used.values()),0)

    def test_complete_pool_refusal_precedes_create_and_keeps_existing_stop_order(self):
        root=directory();book=evidence.EvidenceLedger(root)
        # Existing retained originals consume slightly more than this window's
        # remaining156MiB headroom. No file is allocated by this synthetic claim.
        ticket=book.reserve((root/'earlier.stdout',),157*1024**2,'commands')
        book.settle(ticket,157*1024**2)
        spec=cli_spec('206-apply',DATA_MOUNT);stand=StandIn(spec)
        with patch('kit_evidence._runtime',book):
            journal=Journal(root,str(root),'f'*64,False)
            with self.assertRaisesRegex(RuntimeError,'before container creation'):
                stand.manager(journal).run(spec)
        self.assertNotIn('create',stand.events);self.assertNotIn('start',stand.events)
        self.assertEqual(stand.stop_calls,[['206-apply']])
        self.assertIsNone(book.active_window)

    def test_window_is_held_at_create_and_returned_after_stopped_success(self):
        root=directory();book=evidence.EvidenceLedger(root);spec=cli_spec('206-apply',DATA_MOUNT)
        class Held(StandIn):
            def run(self,argv,label,timeout,**kw):
                if argv[1]=='create':
                    self.assert_held=book.active_window.receipt()
                    assert sum(book.used.values())>=sum(CLI_ENVELOPE.values())
                return super().run(argv,label,timeout,**kw)
        stand=Held(spec)
        with patch('kit_evidence._runtime',book):
            journal=Journal(root,str(root),'f'*64,False)
            _,result=stand.manager(journal).run(spec)
        self.assertTrue(stand.assert_held['heldBeforeContainerCreate'])
        self.assertTrue(result['stoppedAndRetained']);self.assertIsNone(book.active_window)
        self.assertLess(sum(book.used.values()),1024**2)
        self.assertEqual(result['preStartEvidenceEnvelope']['maximumBytes'],CLI_ENVELOPE)

    def test_window_borrows_unused_categories_atomically_but_never_exceeds_the_joint_pool(self):
        root=directory();book=evidence.EvidenceLedger(root,dict.fromkeys(evidence.SHARES,5*4096))
        maximum={'commands':12*4096,'memory':2*4096,'controller':2*4096,'journal':4*4096}
        window=book.begin_window('synthetic',maximum)
        with patch('kit_evidence._runtime',book):
            ticket=book.reserve((root/'synthetic.stdout',),8*4096,'commands')
            with self.assertRaises(RuntimeError):book.begin_window('nested',maximum)
            with self.assertRaises(RuntimeError):book.reserve((root/'too-large.stdout',),4*4096,'commands')
            book.settle(ticket,1)
            write_new(root/'synthetic.json',{'retained':True})
        window.close()
        self.assertEqual(book.used['commands'],2*4096)
        self.assertEqual(book.used['journal'],2*4096)
        with self.assertRaises(RuntimeError):window.close()
        with self.assertRaises(RuntimeError):book.reserve((root/'synthetic.stdout',),1,'commands')
        with self.assertRaises(RuntimeError):book.begin_window('does-not-fit',maximum)
        self.assertIsNone(book.active_window)

    def test_real_child_and_observer_spend_only_the_already_held_allowances(self):
        root=directory();book=evidence.EvidenceLedger(root,dict.fromkeys(evidence.SHARES,1024**2))
        maximum=dict.fromkeys(evidence.SHARES,512*1024);window=book.begin_window('synthetic',maximum)
        calls=[]
        def check(_):
            calls.append(book.summary()['activePreStartWindow']['label'])
            if len(calls)==1:write_new(root/'controller-memory-synthetic.json',{'observed':True})
        runner=CommandRunner(root,check,False,{sys.executable})
        with patch('kit_evidence._runtime',book):
            out,err,metadata=runner.run([sys.executable,'-c',"import os;os.write(1,bytes(range(256)))"],
                'synthetic',5,output_limits={'stdout':8192,'stderr':4096})
        self.assertEqual(out,bytes(range(256)));self.assertFalse(err)
        self.assertTrue(metadata['streamCapture']['allOriginalBytesRetained'])
        self.assertTrue(calls);self.assertEqual(set(calls),{'synthetic'})
        window.close();self.assertLess(sum(book.used.values()),sum(maximum.values()))
        self.assertEqual(book.summary()['openReservations'],0)

    def test_failed_open_ticket_stays_charged_and_cannot_resume_after_window_closes(self):
        root=directory();book=evidence.EvidenceLedger(root)
        window=book.begin_window('synthetic',dict.fromkeys(evidence.SHARES,1024**2))
        ticket=book.reserve((root/'never-written.stdout',),8192,'commands')
        window.close()
        self.assertEqual(book.used['commands'],3*4096)
        with self.assertRaises(RuntimeError):book.settle(ticket,0)
        self.assertFalse((root/'never-written.stdout').exists())

    def test_failure_attempts_exact_stop_while_full_window_is_still_held(self):
        root=directory();book=evidence.EvidenceLedger(root);spec=cli_spec('206-apply',DATA_MOUNT)
        class Failed(StandIn):
            def stop(self,owners):
                assert book.active_window is not None
                return super().stop(owners)
        stand=Failed(spec);stand.failure='start'
        with patch('kit_evidence._runtime',book):
            journal=Journal(root,str(root),'f'*64,False)
            with self.assertRaises(RuntimeError):stand.manager(journal).run(spec)
        self.assertEqual(stand.stop_calls,[['206-apply']]);self.assertIsNone(book.active_window)

    def test_controller_original_bytes_are_complete_and_predicate_ast_is_identical(self):
        node=next(n for n in ast.parse((HERE/'retained_controller.py').read_bytes()).body
            if isinstance(n,ast.FunctionDef) and n.name=='own_snapshot')
        self.assertEqual(hashlib.sha256(ast.dump(node,include_attributes=False).encode()).hexdigest(),
            '090e141063a8e1954161f348678bd37eb2d09ca97acf2b37de4703c09be81923')
        root=directory();book=evidence.EvidenceLedger(root);original=controller.own_snapshot
        def padded(raw):
            spaces=b' '*(16384-len(raw))
            return raw[:-2]+spaces+raw[-2:] if raw.endswith(b'\n') else raw+spaces
        values={'memory.events':padded(b'oom 0\noom_kill 0\nmax 9\nhigh 7\n'+b'odd\x01key 0\n'),
            'memory.stat':padded(b'anon 12\nfile 34\n'+b'other\x01key 0\n'),
            'memory.current':padded(b'123'),'memory.peak':padded(b'456'),
            'memory.max':padded(b'805306368'),'memory.swap.max':padded(b'0')}
        membership=padded(('0::/system.slice/'+controller.UNIT).encode())
        def read(path):return membership if str(path).endswith('/cgroup') else values[pathlib.PurePosixPath(path).name]
        def observe(evidence=None):return original(read=read,evidence=evidence)
        with patch('kit_evidence._runtime',book),patch('retained_controller.own_snapshot',observe):
            guard=controller.ControllerGuard(root);value=guard.observe('watch-000001')
        record=json.loads((root/'controller-memory-watch-000001.json').read_bytes())
        self.assertEqual(record['validatedSnapshotSha256'],hashlib.sha256(controller.canonical(value)).hexdigest())
        self.assertNotIn('raw',record);self.assertLessEqual((root/'controller-memory-watch-000001.json').stat().st_size,8192)
        self.assertEqual(len(record['originalKernelReads']),8)
        for row in record['originalKernelReads']:
            raw=(root/row['original']).read_bytes()
            self.assertEqual(raw,read(row['path']));self.assertEqual(len(raw),16384)
            self.assertEqual(hashlib.sha256(raw).hexdigest(),row['sha256'])
        self.assertEqual(value['events']['high'],7);self.assertEqual(value['memoryStat']['file'],34)
        self.assertLessEqual(book.used['controller'],8*evidence.allocation(16384)+evidence.allocation(8192))

if __name__=='__main__':unittest.main()
