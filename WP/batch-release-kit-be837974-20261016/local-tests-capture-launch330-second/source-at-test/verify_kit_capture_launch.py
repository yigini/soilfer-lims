"""Real LOCAL package files; host, primary provider and dispatch are stand-ins."""
import ast
import builtins
import contextlib
import copy
import io
import os
import pathlib
import symtable
import sys
import types
import unittest
from unittest.mock import patch
import kit_capture_inputs as inputs
import kit_capture_launch as programs
import launch_capture as launcher
import prepare_capture as preparer
import verify_kit_capture_controller as controller_fixtures
import verify_kit_package as package_fixtures
from kit_capture_budget import CaptureBudget,CAPTURE_TABLE_SHA,CAPTURE_DB_EQUIVALENTS
from kit_capture_owned import CAPTURE_ROOT,CAPTURE_UNIT
from kit_contract import IMAGE_BYTES,canonical
from kit_package import read_package,write_new_file
from kit_disk import BOUND
from retained_contract import ROOT,exact_json

HERE=pathlib.Path(__file__).resolve().parent


def fixture():
    files,index,source,*_=package_fixtures.package_fixture()
    files={n:r for n,r in files.items() if n in ('source-index.json','source-review.json') or n.startswith('tooling/')}
    manifest=inputs.capture_input_manifest(files);files[inputs.MANIFEST]=canonical(manifest)+b'\n'
    return files,inputs.verify_capture_inputs(files)


def capacity(phase,future):
    budget=CaptureBudget(4096,0,IMAGE_BYTES)
    rows={p:{'path':p,'device':7,'blockBytes':4096,'fragmentBytes':4096,
        'availableBlocks':10**8,'freeBytes':10**8*4096} for p in BOUND}
    return {'phase':phase,'root':CAPTURE_ROOT.as_posix(),'metadataOnly':True,'productionSqliteConnections':0,
        'neverRetry':True,'futurePackageAllocationBytes':future,'tableSha256':CAPTURE_TABLE_SHA,
        'databaseEquivalents':CAPTURE_DB_EQUIVALENTS,'inputs':{'databaseAllocatedBytes':4096,'assetsAllocatedBytes':0},
        'remainingCopyBytes':budget.remaining(),'requiredBytes':budget.required()+future,'hardware':rows}


class CaptureLaunch(unittest.TestCase):
    def test_input_package_binds_all_raw_tooling_and_refuses_release_or_expanded_payload(self):
        files,checked=fixture();self.assertEqual(checked['manifest']['unit'],CAPTURE_UNIT)
        for kind in ('source','tooling','extra','root','bool-version'):
            changed=copy.deepcopy(files)
            if kind=='source':changed['source-review.json']=b'{}'
            elif kind=='tooling':changed['tooling/run_capture.py']+=b'CHANGED'
            elif kind=='extra':changed['production-gate.json']=b'{}'
            else:
                value=exact_json(changed[inputs.MANIFEST]);value['root' if kind=='root' else 'version']=str(ROOT) if kind=='root' else True
                changed[inputs.MANIFEST]=canonical(value)+b'\n'
            with self.subTest(kind=kind),self.assertRaises((RuntimeError,KeyError)):inputs.verify_capture_inputs(changed)

    def test_every_remote_program_compiles_and_capture_preflight_uses_exact_budget_and_stat_reader(self):
        _,checked=fixture();rendered=programs.remote_capture_programs(checked['filePins'])
        self.assertEqual(set(rendered),{'beforeRoot','create','beforeUnit','unit'})
        for name,raw in rendered.items():
            compile(raw,name,'exec')
            symbols=symtable.symtable(raw.decode(),name,'exec')
            defined={s.get_name() for s in symbols.get_symbols() if s.is_assigned() or s.is_imported() or s.is_namespace()}
            def references(scope):
                names={s.get_name() for s in scope.get_symbols() if s.is_referenced() and s.is_global()}
                for child in scope.get_children():names|=references(child)
                return names
            self.assertEqual(references(symbols)-defined-set(dir(builtins)),set())
        for filename,names in (('kit_capture_budget.py',('CaptureBudget',)),('kit_disk.py',('measure_inputs','free_gate','hardware'))):
            expected={n.name:ast.dump(n,include_attributes=False) for n in ast.parse((HERE/filename).read_bytes()).body if isinstance(n,(ast.ClassDef,ast.FunctionDef))}
            actual={n.name:ast.dump(n,include_attributes=False) for n in ast.parse(rendered['beforeRoot']).body if isinstance(n,(ast.ClassDef,ast.FunctionDef))}
            for name in names:self.assertEqual(actual[name],expected[name])
        unit=rendered['unit'].decode()
        self.assertIn('capture_stop_post.py',unit);self.assertIn('capture_controller_output.py',unit)
        self.assertNotIn('/tooling/controller_output.py',unit);self.assertNotIn('run_release.py',unit)
        self.assertNotIn('production-gate-consumed',unit)

    def test_capacity_record_reconstructs_capture_table_and_refuses_boolean_foreign_or_short_capacity(self):
        value=capacity('BEFORE_ROOT',8192);launcher.capacity_record(canonical(value),'BEFORE_ROOT',8192)
        for name,changed_value in (('root',str(ROOT)),('tableSha256','a'*64),('databaseEquivalents',True),
                                  ('productionSqliteConnections',False),('requiredBytes',1)):
            changed=copy.deepcopy(value);changed[name]=changed_value
            with self.subTest(name=name),self.assertRaises(RuntimeError):launcher.capacity_record(canonical(changed),'BEFORE_ROOT',8192)
        value['hardware'][BOUND[0]]['freeBytes']=0
        with self.assertRaises(RuntimeError):launcher.capacity_record(canonical(value),'BEFORE_ROOT',8192)

    def test_actual_unit_program_verifies_real_local_input_files_before_one_standin_dispatch(self):
        files,checked=fixture();root=controller_fixtures.directory()
        for name,raw in files.items():write_new_file(root,name,raw,False)
        code=programs.remote_capture_programs(checked['filePins'])['unit'];calls=[]
        def run(argv,**kwargs):
            calls.append(argv);return types.SimpleNamespace(returncode=0,stdout=b'not-found\n' if argv[0]=='systemctl' else b'LOCAL DISPATCH',stderr=b'')
        fake_os=types.SimpleNamespace(name='posix',O_RDONLY=os.O_RDONLY,O_DIRECTORY=0,open=lambda *a:123,fsync=lambda fd:None,close=lambda fd:None)
        def execute():
            with patch.dict(sys.modules,{'pathlib':types.SimpleNamespace(Path=lambda v:root),'os':fake_os,
                    'subprocess':types.SimpleNamespace(run=run)}),patch('sys.path',list(sys.path)),\
                 patch('kit_package.read_package',return_value=files),contextlib.redirect_stdout(io.StringIO()):exec(code,{})
        execute();self.assertEqual(len(calls),2)
        self.assertIn('--property=ExecStopPost=/usr/bin/python3 -B '+str(root/'tooling/capture_stop_post.py'),calls[-1])
        self.assertEqual(calls[-1][-3:],[str(root/'tooling/capture_controller_output.py'),'--root',str(root)])
        (root/'unreviewed-empty-directory').mkdir()
        with self.assertRaises(RuntimeError):execute()
        self.assertEqual(len(calls),2)

    def test_failed_fresh_source_prevents_any_host_call_and_consumes_local_launch_evidence(self):
        files,checked=fixture();base=controller_fixtures.directory();package=base/'package';package.mkdir();evidence=base/'evidence'
        for name,raw in files.items():write_new_file(package,name,raw,False)
        with patch.object(launcher,'PACKAGE',package),patch.object(launcher,'EVIDENCE',evidence),\
             patch.object(launcher,'executing_source_matches'),patch.object(launcher,'fresh_authority',side_effect=RuntimeError('LOCAL primary refused')),\
             patch.object(launcher,'CommandRunner') as runner:
            with self.assertRaises(RuntimeError):launcher.launch(package,evidence)
            self.assertFalse(runner.called);self.assertTrue((evidence/'capture-launch-intent.json').exists())
            with self.assertRaises(FileExistsError):launcher.launch(package,evidence)
            self.assertFalse(runner.called)

    def test_lost_unit_dispatch_return_cannot_redispatch_or_create_gate(self):
        files,checked=fixture();base=controller_fixtures.directory();package=base/'package';package.mkdir();evidence=base/'evidence'
        for name,raw in files.items():write_new_file(package,name,raw,False)
        calls=[]
        class Runner:
            def __init__(self,*args,**kwargs):pass
            def run(self,argv,label,timeout,**kwargs):
                calls.append(label)
                if label=='unit':raise RuntimeError('LOCAL actual dispatch lost return')
                phase='BEFORE_ROOT' if label=='beforeroot' else 'BEFORE_UNIT'
                return canonical(capacity(phase,checked['futurePackageAllocationBytes'] if label=='beforeroot' else 0)),b'',{}
        with patch.object(launcher,'PACKAGE',package),patch.object(launcher,'EVIDENCE',evidence),\
             patch.object(launcher,'executing_source_matches'),patch.object(launcher,'fresh_authority'),\
             patch.object(launcher,'CommandRunner',Runner):
            with self.assertRaises(RuntimeError):launcher.launch(package,evidence)
            self.assertEqual(calls,['beforeroot','create','upload','beforeunit','unit'])
            with self.assertRaises(FileExistsError):launcher.launch(package,evidence)
            self.assertEqual(calls.count('unit'),1);self.assertFalse((package/'production-gate-consumed.json').exists())


if __name__=='__main__':unittest.main()
