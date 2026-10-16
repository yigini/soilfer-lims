"""Typed capture owners on NEW LOCAL files and Docker/kernel stand-ins only."""
import ast
import copy
import itertools
import json
import os
import pathlib
import shutil
import subprocess
import tempfile
import unittest
from unittest.mock import patch
import kit_capture_owned as capture
import kit_evidence
from kit_owned import cli_spec,validate_spec,selected,OwnedCli
from kit_integrity import DATA_MOUNT
from kit_journal import Journal
from kit_capture_memory import capture_container_identity,capture_host_sample
from retained_memory import container_identity,gate,NON_RECLAIMABLE_FIELDS
from verify_kit_owned import obj,StandIn,ID

HERE=pathlib.Path(__file__).resolve().parent
FIXTURES=HERE/'capture-owner-local-retained-fixtures'

def directory():
    FIXTURES.mkdir(exist_ok=True)
    return pathlib.Path(tempfile.mkdtemp(prefix='owned-',dir=FIXTURES)).resolve()

def capture_object(spec,running=True):
    value=obj(spec,running)
    value['Config']['Labels']={capture.CAPTURE_LABEL:spec['owner']}
    value['Config']['Cmd']=['/release/capture_cli_guard.cjs','/tmp',spec['label'],*spec['child']]
    value['State']['Pid']=41234
    return value

class CaptureOwners(unittest.TestCase):
    def test_exact_mounts_prevent_live_volume_release_root_and_209_apply(self):
        self.assertEqual(len(capture.CAPTURE_COMMANDS),6)
        for label in capture.CAPTURE_COMMANDS:
            spec=capture.capture_spec(label)
            capture.capture_selected(capture_object(spec),spec,True)
            self.assertEqual(spec['dataWritable'],label in ('capture-206-prepare','capture-214-prepare'))
            self.assertTrue(all(m['Type']=='bind' and m['Source'].startswith(capture.CAPTURE_ROOT.as_posix()+'/')
                for m in spec['mounts']))
            self.assertEqual(spec['mounts'][0]['Source'],(capture.CAPTURE_ROOT/'scientific-database').as_posix())
            self.assertFalse(spec['mounts'][1]['RW'])
            self.assertEqual(spec['argv'][spec['argv'].index('--log-driver')+1],'none')
            self.assertNotIn('lims_lims-data',str(spec));self.assertNotIn('--rm',spec['argv'])
            self.assertNotIn('workflow-batch-release-',str(spec))
            with self.assertRaises(RuntimeError):validate_spec(spec)
        for label in ('209-apply','capture-209-prepare','206-apply','first-sync-backup','candidate'):
            with self.assertRaises(RuntimeError):capture.capture_spec(label)
        with self.assertRaises(RuntimeError):capture.validate_capture_spec(cli_spec('206-apply',DATA_MOUNT))

    def test_foreign_spec_and_every_mount_field_refuse_both_normal_and_emergency(self):
        spec=capture.capture_spec('capture-214-prepare');value=capture_object(spec)
        for mounts in itertools.permutations(value['Mounts']):
            changed=copy.deepcopy(value);changed['Mounts']=list(mounts)
            self.assertEqual(capture.capture_selected(changed,spec),capture.capture_selected(value,spec))
        for index,mount in enumerate(value['Mounts']):
            for key in mount:
                changed=copy.deepcopy(value);changed['Mounts'][index][key]='FOREIGN'
                for emergency in (False,True):
                    with self.subTest(index=index,key=key,emergency=emergency),self.assertRaises(RuntimeError):
                        capture.capture_selected(changed,spec,emergency=emergency)
        for field in ('name','owner','child','argv','dataWritable'):
            changed=copy.deepcopy(spec);changed[field]='FOREIGN'
            with self.subTest(field=field),self.assertRaises(RuntimeError):capture.validate_capture_spec(changed)
        changed=capture_object(spec);changed['Config']['Cmd']=['/release/cli_guard.cjs','/tmp',*spec['child']]
        with self.assertRaises(RuntimeError):capture.capture_selected(changed,spec,emergency=True)
        with self.assertRaises(RuntimeError):selected(value,spec,emergency=True)

    def manager(self,spec,stand,root):
        stand.value=capture_object(spec,False)
        return capture.CaptureOwnedCli(stand,stand,Journal(root,str(root),'f'*64,False),stand.history,
            lambda s:stand.events.append('prepare'),stand.read,stand.permit,stand.stop,stand.clock,stand.sleep,
            output_reader=stand.output)

    def test_stateful_capture_uses_full_existing_lifecycle_and_never_daemon_logs(self):
        root=directory();spec=capture.capture_spec('capture-214-prepare');stand=StandIn(spec)
        raw,result=self.manager(spec,stand,root).run(spec)
        self.assertTrue(result['stoppedAndRetained']);self.assertTrue(result['dataWritable'])
        self.assertEqual(stand.events.count('create'),1);self.assertEqual(stand.events.count('wait'),1)
        self.assertLess(stand.events.index('output-before-memory'),stand.events.index('memory:before-stop'))
        self.assertLess(stand.events.index('wait'),stand.events.index('output-final'))
        self.assertNotIn('logs',stand.events)
        with self.assertRaises(RuntimeError):self.manager(cli_spec('206-apply',DATA_MOUNT),StandIn(spec),directory()).run(cli_spec('206-apply',DATA_MOUNT))
        release_root=directory()
        release=StandIn(cli_spec('206-apply',DATA_MOUNT)).manager(Journal(release_root,str(release_root),'f'*64,False))
        with self.assertRaises(RuntimeError):release.run(spec)

    def test_each_lost_return_still_stops_exact_capture_owner_and_cannot_retry(self):
        for phase in ('create','start','wait'):
            spec=capture.capture_spec('capture-206-prepare');stand=StandIn(spec);stand.failure=phase
            manager=self.manager(spec,stand,directory())
            with self.subTest(phase=phase),self.assertRaises(RuntimeError):manager.run(spec)
            self.assertEqual(stand.stop_calls,[[spec['label']]])
            with self.assertRaises(RuntimeError):manager.run(spec)
            self.assertEqual(stand.events.count(phase),1)

    def test_unusable_capture_originals_cannot_receive_final_memory_permission(self):
        spec=capture.capture_spec('capture-chart-impact');stand=StandIn(spec)
        manager=self.manager(spec,stand,directory())
        manager.output_reader=lambda *args:(_ for _ in ()).throw(RuntimeError('LOCAL incomplete originals'))
        with self.assertRaises(RuntimeError):manager.run(spec)
        self.assertNotIn('permit',stand.events);self.assertEqual(stand.stop_calls,[[spec['label']]])

    def test_independent_capture_stop_preserves_exact_mount_identity_and_ignores_resource_violation(self):
        for foreign in ('none','label','live-volume','release-command'):
            spec=capture.capture_spec('capture-214-prepare');value=capture_object(spec);stops=[]
            value['HostConfig']['MemorySwap']=999;value['HostConfig']['LogConfig']={'Type':'json-file','Config':{}}
            value['State']['OOMKilled']=True
            if foreign=='label':value['Config']['Labels']={'io.soilfer.release-owned':spec['owner']}
            if foreign=='live-volume':value['Mounts'][0].update(DATA_MOUNT)
            if foreign=='release-command':value['Config']['Cmd']=['/release/cli_guard.cjs','/tmp',*spec['child']]
            def call(argv):
                if argv[1]=='ps':return ID.encode()
                if argv[1]=='inspect':
                    observed=copy.deepcopy(value);observed['Mounts'].reverse()
                    return json.dumps([observed]).encode()
                self.assertEqual(argv,['docker','stop','-t','10',ID]);stops.append(argv)
                value['State']['Running']=False;value['State']['ExitCode']=137;return ID.encode()
            result=capture.stop_capture_owners(call,[spec['label']])
            self.assertEqual(len(stops),1 if foreign=='none' else 0)
            self.assertEqual(bool(result['errors']),foreign!='none')
            if foreign=='none':
                self.assertTrue(result['stoppedAndRetained'][0]['runtimeViolationObservedBeforeStop'])
                self.assertEqual(result['stoppedAndRetained'][0]['actualExitCode'],137)

    def test_failed_inventory_or_stop_does_not_suppress_other_capture_owner_attempts(self):
        calls=[]
        def call(argv):
            calls.append(argv)
            if 'capture-206-prepare' in argv[-1]:raise OSError('LOCAL retention/interface refusal')
            return b''
        result=capture.stop_capture_owners(call,['capture-206-prepare','capture-214-prepare'])
        self.assertEqual(len(calls),2);self.assertEqual(len(result['errors']),1)
        self.assertEqual(len(result['observedAbsentOwners']),1);self.assertEqual(result['nonvacuousStoppedOwnerCount'],0)
        self.assertTrue(all('review-capture' in argv[-1] for argv in calls))
        def duplicate(argv):return (ID+'\n'+ID+'\n').encode()
        result=capture.stop_capture_owners(duplicate,['capture-chart-impact'])
        self.assertEqual(len(result['errors']),1);self.assertFalse(result['stoppedAndRetained'])

    def test_real_node_guard_accepts_only_python_compiled_capture_commands(self):
        root=directory();specs=[capture.capture_spec(label) for label in capture.CAPTURE_COMMANDS]
        argv=[['/tmp',s['label'],*s['child']] for s in specs]
        code='const v=require(process.argv[1]);const rows='+json.dumps(argv)+';for(const r of rows)v.validateMain(r);process.stdout.write(JSON.stringify(rows.length));'
        result=subprocess.run([shutil.which('node'),'-e',code,str(HERE/'capture_cli_guard.cjs')],capture_output=True,timeout=10)
        (root/'validation.stdout').write_bytes(result.stdout);(root/'validation.stderr').write_bytes(result.stderr)
        self.assertEqual(result.returncode,0);self.assertEqual(result.stdout,b'6');self.assertEqual(result.stderr,b'')
        cases=[['/tmp','capture-209-prepare','/app/server/scripts/install_order_revisions.js','--db','/app/server/prisma/dev.db','--apply'],
            ['/tmp','capture-206-prepare','/app/server/scripts/install_sample_containers.js','--db','/foreign.db','--apply'],
            ['/foreign','capture-206-prepare',*specs[2]['child']],['/tmp','206-apply',*specs[2]['child']]]
        for i,argv in enumerate(cases):
            result=subprocess.run([shutil.which('node'),str(HERE/'capture_cli_guard.cjs'),*argv],capture_output=True,timeout=10)
            (root/(str(i)+'.stdout')).write_bytes(result.stdout);(root/(str(i)+'.stderr')).write_bytes(result.stderr)
            self.assertEqual(result.returncode,1);self.assertEqual(result.stdout+result.stderr,b'')

    def test_full_capture_stream_admissions_and_snapshot_site_precede_mkdir(self):
        for failure in ('none','capacity','writer','source'):
            root=directory();db=root/'scientific-database';db.mkdir();(db/'dev.db').write_bytes(b'm'*4096)
            book=kit_evidence.EvidenceLedger(root);events=[]
            class LocalDisk:
                def admit_copy(self,site,dest,layout):
                    events.append(('admit',site));self.layout=layout
                    self.assert_before=not pathlib.Path(dest).exists()
                    if failure=='capacity':raise RuntimeError('LOCAL capacity')
            disk=LocalDisk()
            def no_writers():
                events.append('writers')
                if failure=='writer':raise RuntimeError('LOCAL writer')
                if failure=='source' and events.count('writers')==3:(db/'dev.db').write_bytes(b'changed')
            with patch.object(capture,'CAPTURE_ROOT',pathlib.PurePosixPath(root.as_posix())),\
                 patch.object(capture,'APACHE_CAPTURE_ROOT',root.as_posix()),patch.object(kit_evidence,'_runtime',book),\
                 patch('kit_capture_copy.verify_capture_clone',lambda root:None),\
                 patch.object(capture,'capture_mountinfo',lambda:b'23 0 0:1 / / rw - ext4 /dev/sda rw\n'):
                spec=capture.capture_spec('capture-canonical-policy');temp=pathlib.Path(spec['tmp'])
                prepare,read,permit=capture.capture_filesystem_controls(root,False,disk,no_writers)
                if failure=='none':
                    prepare(spec);self.assertTrue(disk.assert_before)
                    self.assertEqual(events,['writers','writers',('admit','capture-policy-snapshot'),'writers'])
                    self.assertTrue((temp/'cli-output-admission.json').exists())
                    self.assertTrue((temp/'snapshot-admission.json').exists())
                    self.assertGreater(sum(book.used.values()),64*1024**2)
                    with self.assertRaises(RuntimeError):prepare(spec)
                else:
                    with self.assertRaises(RuntimeError):prepare(spec)
                    self.assertFalse(temp.exists())

    def test_capture_bind_mount_and_real_hardlink_or_extra_file_refuse_before_any_cli_files(self):
        base=b'23 0 0:1 / / rw - ext4 /dev/sda rw\n'
        for fault in ('mount','hardlink','journal','foreign','missing-writers'):
            root=directory();db=root/'scientific-database';db.mkdir();main=db/'dev.db';main.write_bytes(b'm'*4096)
            if fault=='hardlink':os.link(main,root/'retained-linked-original')
            if fault=='journal':(db/'dev.db-journal').write_bytes(b'')
            if fault=='foreign':(db/'other.db').write_bytes(b'')
            raw=base
            if fault=='mount':raw+=('24 23 0:1 /production '+db.as_posix()+' rw - ext4 /dev/sda rw\n').encode()
            with patch.object(capture,'CAPTURE_ROOT',pathlib.PurePosixPath(root.as_posix())),\
                 patch.object(capture,'APACHE_CAPTURE_ROOT',root.as_posix()),patch.object(capture,'capture_mountinfo',lambda:raw),\
                 patch.object(kit_evidence,'_runtime',kit_evidence.EvidenceLedger(root)):
                spec=capture.capture_spec('capture-206-prepare')
                prepare,_,_=capture.capture_filesystem_controls(root,False,None,None if fault=='missing-writers' else lambda:None)
                with self.subTest(fault=fault),self.assertRaises(RuntimeError):prepare(spec)
                self.assertFalse(pathlib.Path(spec['tmp']).exists())
            self.assertEqual(main.read_bytes(),b'm'*4096)
        for raw in (b'',base+base,base.replace(b'/ / ',b'/ /foreign ')):
            with self.assertRaises(RuntimeError):capture.capture_mount_guard(raw,capture.CAPTURE_ROOT)
        linux_root=pathlib.Path('/opt/lims/releases/workflow-batch-review-capture-be837974-20261016T170000Z')
        for suffix in ('','/scientific-database','/scientific-database/nested'):
            raw=base+('24 23 0:1 /production '+linux_root.as_posix()+suffix+' rw - ext4 /dev/sda rw\n').encode()
            with self.assertRaisesRegex(RuntimeError,'Mounted capture'):capture.capture_mount_guard(raw,linux_root)
        root=directory();db=root/'scientific-database';db.mkdir();(db/'dev.db').write_bytes(b'm'*4096)
        original_is_symlink=pathlib.Path.is_symlink
        def dangling_sidecar(path):return path.name=='dev.db-shm' or original_is_symlink(path)
        with patch.object(capture,'CAPTURE_ROOT',pathlib.PurePosixPath(root.as_posix())),\
             patch.object(pathlib.Path,'is_symlink',dangling_sidecar):
            with self.assertRaisesRegex(RuntimeError,'dangling sidecar'):capture.capture_clone_state(root,lambda:base)

    def test_capture_stop_failure_after_valid_identity_still_attempts_next_owner(self):
        first=capture.capture_spec('capture-206-prepare');second=capture.capture_spec('capture-214-prepare')
        value=capture_object(first);calls=[]
        def call(argv):
            calls.append(argv)
            if argv[1]=='ps':return b'' if second['owner'] in argv[-1] else ID.encode()
            if argv[1]=='inspect':return json.dumps([value]).encode()
            raise OSError('LOCAL lost stop return/failed raw retention')
        result=capture.stop_capture_owners(call,[first['label'],second['label']])
        self.assertEqual(result['errors'][0]['phase'],'stop')
        self.assertEqual(result['observedAbsentOwners'][0]['owner'],second['owner'])
        self.assertEqual(calls[-1][-1],'label='+capture.CAPTURE_LABEL+'='+second['owner'])

    def test_capture_memory_identity_and_numeric_cgroup_reread_reject_release_or_changed_pid(self):
        spec=capture.capture_spec('capture-206-prepare');value=capture_object(spec)
        capture_container_identity(value,ID,spec['owner'])
        with self.assertRaises(RuntimeError):container_identity(value,ID,spec['owner'])
        release_spec=cli_spec('206-apply',DATA_MOUNT)
        with self.assertRaises(RuntimeError):capture_container_identity(obj(release_spec),ID,release_spec['owner'])
        membership=('0::/system.slice/docker-'+ID+'.scope\n').encode()
        mount=b'29 23 0:26 / /sys/fs/cgroup rw,nosuid,nodev,noexec,relatime - cgroup2 cgroup rw\n'
        counters={name:1 for name in NON_RECLAIMABLE_FIELDS}
        counters.update({'file':100,'slab_reclaimable':1,'pgscan':0,'pgsteal':0})
        raws={'memory.stat':''.join(k+' '+str(v)+'\n' for k,v in counters.items()).encode(),
            'memory.events':b'oom 0\noom_kill 0\nmax 0\nhigh 0\n','memory.peak':b'256\n',
            'memory.max':b'805306368\n','memory.swap.max':b'0\n'}
        reads=[]
        def read(path,limit):
            reads.append(str(path))
            if str(path).endswith('/cgroup'):return membership
            if str(path).endswith('/mountinfo'):return mount
            return raws[pathlib.Path(path).name]
        sample=capture_host_sample(ID,spec['owner'],read,lambda ident:copy.deepcopy(value),lambda p:{'path':str(p),'device':1,'inode':2})
        self.assertEqual(gate(sample),len(NON_RECLAIMABLE_FIELDS));self.assertEqual(len(reads),8)
        changed=copy.deepcopy(value);changed['State']['Pid']+=1;seen=[]
        def inspect(ident):seen.append(ident);return value if len(seen)==1 else changed
        with self.assertRaises(RuntimeError):capture_host_sample(ID,spec['owner'],read,inspect,lambda p:{'path':str(p),'device':1,'inode':2})

    def test_standalone_capture_hook_is_exact_source_without_release_serving_or_local_imports(self):
        from build_capture_stop_post import render,SPECS,nodes
        generated=render();self.assertEqual((HERE/'capture_stop_post.py').read_text(encoding='utf-8'),generated)
        tree=ast.parse(generated);self.assertFalse(any(isinstance(n,ast.ImportFrom) for n in tree.body))
        definitions={n.name:n for n in tree.body if isinstance(n,(ast.FunctionDef,ast.ClassDef))}
        for filename,names in SPECS.items():
            for node in nodes((HERE/filename).read_text(encoding='utf-8'),names):
                if isinstance(node,(ast.FunctionDef,ast.ClassDef)):
                    self.assertEqual(ast.dump(node,include_attributes=False),ast.dump(definitions[node.name],include_attributes=False))
        main=ast.unparse(definitions['main'])
        self.assertLess(main.index('stop_capture_owners(call)'),main.index('exclusive_record('))
        for forbidden in ('stop_candidate','serving_permit','systemctl','restart','EmergencyIngress','source_review'):
            self.assertNotIn(forbidden,main)
        # Do not execute the generated hook, even with stand-in commands.

if __name__=='__main__':unittest.main()
