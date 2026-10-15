"""Pure negative authority/accounting/container guards. Never run an operator in these tests."""
import copy,os,pathlib,sqlite3,unittest
from unittest import mock
from proof_contract import *
from proof_disk import growth,mount_guard,ALLOCATION,BOUND
from proof_docker import arguments,preserved_containers,Docker,mount_objects
from proof_startup import startup_log
from proof_files import seal,triple,logical,delta,write_new,byte_identity,file_state
from proof_install import install

def fixture_graph():return {'head':'a'*40,'files':{n:{'sha256':'b'*64,'blob':'c'*40,'bytes':1} for n in FILES}}
def fixture_review():
    i=fixture_graph();return {'id':6181999999,'performed_via_github_app':{'slug':'claude'},'html_url':'https://github.com/yigini/soilfer-lims/issues/162#issuecomment-6181999999','created_at':'2026-10-15T01:00:00Z','updated_at':'2026-10-15T01:00:00Z','body':'Source review: PASS\n'+'\n'.join(tokens(i))}
class Guards(unittest.TestCase):
    def test_review_full(self):approval(fixture_review(),fixture_graph())
    def test_old_pass(self):
        v=fixture_review();v['id']=BUILD_PASS
        with self.assertRaises(RuntimeError):approval(v,fixture_graph())
    def test_missing_graph(self):
        i=fixture_graph();i['files'].pop('proof_files.py')
        with self.assertRaises(RuntimeError):graph(i)
    def test_scope_omitted(self):
        v=fixture_review();v['body']=v['body'].replace(SCOPE,'OTHER')
        with self.assertRaises(RuntimeError):approval(v,fixture_graph())
    def test_changed_image(self):
        v=fixture_review();v['body']=v['body'].replace(IMAGE,PREDECESSOR_IMAGE)
        with self.assertRaises(RuntimeError):approval(v,fixture_graph())
    def test_missing_jobs_gate(self):
        v=fixture_review();v['body']=v['body'].replace('jobsOnQualificationStillRequired=true','')
        with self.assertRaises(RuntimeError):approval(v,fixture_graph())
    def test_edited_pass(self):
        v=fixture_review();v['updated_at']='2026-10-15T01:01:00Z'
        with self.assertRaises(RuntimeError):approval(v,fixture_graph())
    def test_fake_actor(self):
        v=fixture_review();v['performed_via_github_app']['slug']='someone'
        with self.assertRaises(RuntimeError):approval(v,fixture_graph())
    def test_later_failed(self):
        v=fixture_review()
        with self.assertRaises(RuntimeError):no_later_failure([{'created_at':'2026-10-15T01:02:00Z','body':'Source review: FAILED '+fixture_graph()['head']}],v,fixture_graph())
    def test_wrong_root(self):
        with self.assertRaises(RuntimeError):exact_root(BUILD_ROOT)
    def test_production_mount(self):
        with self.assertRaises(RuntimeError):arguments(ROOT,'dry',LIVE_DATA,pathlib.Path(ROOT)/'tmp','install_order_revisions.js','--apply')
    def test_parent_escape(self):
        with self.assertRaises(RuntimeError):child_path(ROOT,pathlib.Path(ROOT)/'../other')
    def test_arbitrary_installer(self):
        with self.assertRaises(RuntimeError):arguments(ROOT,'dry',pathlib.Path(ROOT)/'data',pathlib.Path(ROOT)/'tmp','link_recorded_acceptance.js','--apply')
    def test_unapproved_mode(self):
        with self.assertRaises(RuntimeError):arguments(ROOT,'dry',pathlib.Path(ROOT)/'data',pathlib.Path(ROOT)/'tmp','install_order_revisions.js','--override')
    def test_retained_argv(self):
        n,o,a=arguments(ROOT,'dry',pathlib.Path(ROOT)/'data',pathlib.Path(ROOT)/'tmp','install_order_revisions.js','--apply')
        self.assertNotIn('--rm',a);self.assertIn(IMAGE,a);self.assertNotIn(PREDECESSOR_IMAGE,a);self.assertIn('DISABLE_BACKGROUND_JOBS=true',a);self.assertIn(str(MEMORY),a);self.assertNotIn('--ulimit',a)
    def test_stopped_container_start(self):
        old={'id':{'name':'old','image':'old','running':False,'startedAt':'before','labels':{},'mounts':[]}};new=copy.deepcopy(old);new['id']['running']=True
        with self.assertRaises(RuntimeError):preserved_containers(old,new)
    def test_historical_container_delete(self):
        with self.assertRaises(RuntimeError):preserved_containers({'id':{}},{})
    def test_preserve_stopped(self):
        old={'id':{'name':'old','image':'old','running':False,'startedAt':'before','labels':{},'mounts':[]}};preserved_containers(old,copy.deepcopy(old))
    def test_scaled_reserve(self):self.assertEqual(reserve(4096,8192),FLOOR+128*4096+3*8192+LOG_RESERVE)
    def observations(self):
        a={'allocations':{p:{'bytes':100,'device':1} for p in ALLOCATION},'devices':{p:1 for p in BOUND},'free':{p:FLOOR+LOG_RESERVE for p in BOUND}};return a,copy.deepcopy(a)
    def test_growth_zero(self):
        a,b=self.observations();b['allocations'][ALLOCATION[2]]['bytes']+=12
        for p in BOUND:b['free'][p]-=12
        self.assertTrue(all(v['unexplainedGrowthBytes']==0 for v in growth(a,b).values()))
    def test_500mb_abort(self):
        a,b=self.observations();b['free'][BOUND[0]]-=GROWTH_ABORT
        with self.assertRaises(RuntimeError):growth(a,b)
    def test_missing_containerd(self):
        a,b=self.observations();b['allocations'].pop('/var/lib/containerd')
        with self.assertRaises(RuntimeError):growth(a,b)
    def test_cross_device_credit(self):
        a,b=self.observations();a['allocations'][ALLOCATION[2]]['device']=b['allocations'][ALLOCATION[2]]['device']=2;b['allocations'][ALLOCATION[2]]['bytes']+=GROWTH_ABORT;b['free'][BOUND[0]]-=GROWTH_ABORT
        with self.assertRaises(RuntimeError):growth(a,b)
    def test_descendant_mount(self):
        with self.assertRaises(RuntimeError):mount_guard('10 9 0:1 / /var/lib/containerd/hidden rw - x x rw',ALLOCATION)
    def test_approved_nonzero_stop(self):
        v={'impact':{'prospectiveApprovedAmendmentSampleCount':1,'invalidStoredAnalysisSampleCount':0,'invalidStoredAnalyses':[],'noActiveRevisionCount':0,'noMatchingLineCount':0,'approvedAmendmentSampleIds':['sample'],'approvedAmendmentKitGate':'STOP_APPROVED_AMENDMENT_REMEDIATION_REQUIRED'}}
        with self.assertRaises(RuntimeError):impact_gate(v)
    def test_malformed_analysis_missing_ids(self):
        v={'impact':{'prospectiveApprovedAmendmentSampleCount':0,'invalidStoredAnalysisSampleCount':1,'invalidStoredAnalyses':[],'noActiveRevisionCount':0,'noMatchingLineCount':0,'approvedAmendmentSampleIds':[],'approvedAmendmentKitGate':'NO_APPROVED_AMENDMENT_REFUSALS'}}
        with self.assertRaises(RuntimeError):impact_gate(v)
    def test_impact_zero(self):impact_gate({'impact':{'prospectiveApprovedAmendmentSampleCount':0,'invalidStoredAnalysisSampleCount':0,'invalidStoredAnalyses':[],'noActiveRevisionCount':0,'noMatchingLineCount':0,'approvedAmendmentSampleIds':[],'approvedAmendmentKitGate':'NO_APPROVED_AMENDMENT_REFUSALS'}})
    def test_backfill_refused(self):
        with self.assertRaises(RuntimeError):plan({'classification':'PRE_209','mode':'DRY_RUN','totalChanges':0,'backfilledCount':1},'209','DRY_RUN')
    def test_startup_duplicate(self):
        with self.assertRaises(RuntimeError):startup_log('{"mode":"NO_OP","totalChanges":0}\nStarting SoilFER-LIMS...\n{"event":"X_STARTUP_READY","totalChanges":0}\n{"event":"X_STARTUP_READY","totalChanges":0}', ['X_STARTUP_READY'],1)
    def test_startup_write(self):
        with self.assertRaises(RuntimeError):startup_log('{"mode":"APPLIED","totalChanges":1}\nStarting SoilFER-LIMS...\n{"event":"X_STARTUP_READY","totalChanges":0}', ['X_STARTUP_READY'],1)
    def test_startup_exact(self):startup_log('{"mode":"NO_OP","totalChanges":0}\nStarting SoilFER-LIMS...\n{"event":"X_STARTUP_READY","totalChanges":0}', ['X_STARTUP_READY'],1)
    def policy(self):return {'classification':'PRESENT','shape':'CANONICAL','mode':'NO_OP','totalChanges':0,'dataWrites':0,'readonlySnapshot':{'originalFilesPreserved':True}}
    def test_policy_canonical(self):policy_gate(self.policy())
    def test_policy_prisma_shape_stop(self):
        p=self.policy();p['shape']='PRISMA_EQUIVALENT'
        with self.assertRaises(RuntimeError):policy_gate(p)
    def test_policy_absent_stop(self):
        p=self.policy();p['classification']='ABSENT';p['mode']='DRY_RUN'
        with self.assertRaises(RuntimeError):policy_gate(p)
    def view_line(self):
        return '816 67 0:44 / /var/lib/docker/rootfs/overlayfs/'+('a'*64)+' rw,relatime shared:276 - overlay overlay rw,lowerdir=/var/lib/containerd/io.containerd.snapshotter.v1.overlayfs/snapshots/20/fs:/var/lib/containerd/io.containerd.snapshotter.v1.overlayfs/snapshots/19/fs,upperdir=/var/lib/containerd/io.containerd.snapshotter.v1.overlayfs/snapshots/21/fs,workdir=/var/lib/containerd/io.containerd.snapshotter.v1.overlayfs/snapshots/21/work'
    def test_verified_overlay_views_not_credited_twice(self):
        v=mount_guard(self.view_line(),ALLOCATION,['a'*64]);self.assertEqual(len(v),1);self.assertEqual(v[0]['upperdir'],'/var/lib/containerd/io.containerd.snapshotter.v1.overlayfs/snapshots/21/fs');self.assertIn('EXCLUDED_BY_DU_X',v[0]['accounting'])
    def test_unknown_view_owner_refused(self):
        with self.assertRaises(RuntimeError):mount_guard(self.view_line(),ALLOCATION,['b'*64])
    def test_backing_outside_counted_store_refused(self):
        with self.assertRaises(RuntimeError):mount_guard(self.view_line().replace('/var/lib/containerd/','/unaccounted/'),ALLOCATION,['a'*64])
    def test_overlay_upper_work_differ_refused(self):
        with self.assertRaises(RuntimeError):mount_guard(self.view_line().replace('/21/work','/22/work'),ALLOCATION,['a'*64])
    def test_duplicate_view_refused(self):
        with self.assertRaises(RuntimeError):mount_guard(self.view_line()+'\n'+self.view_line(),ALLOCATION,['a'*64])
    def test_unknown_overlay_option_refused(self):
        with self.assertRaises(RuntimeError):mount_guard(self.view_line()+',unexpected=on',ALLOCATION,['a'*64])
    def test_foreign_mounted_filesystem_refused(self):
        with self.assertRaises(RuntimeError):mount_guard(self.view_line().replace('- overlay overlay','- nfs4 remote'),ALLOCATION,['a'*64])
    def test_backing_parent_escape_refused(self):
        with self.assertRaises(RuntimeError):mount_guard(self.view_line().replace('/20/fs','/20/../fs'),ALLOCATION,['a'*64])
    def mounts(self):return [{'Type':'bind','Source':'/owned/data','Destination':'/data','RW':True},{'Type':'bind','Source':'/owned/assets','Destination':'/assets','RW':True}]
    def test_exact_mount_permutations_preserved(self):
        old={'id':{'name':'old','image':'old','running':False,'startedAt':'before','labels':{},'mounts':self.mounts()}};new=copy.deepcopy(old);new['id']['mounts'].reverse();preserved_containers(old,new)
    def test_changed_mount_flag_refused(self):
        a=self.mounts();b=copy.deepcopy(a);b[0]['RW']=False
        self.assertNotEqual(mount_objects(a),mount_objects(b))
    def test_missing_mount_refused(self):
        old={'id':{'name':'old','image':'old','running':False,'startedAt':'before','labels':{},'mounts':self.mounts()}};new=copy.deepcopy(old);new['id']['mounts'].pop()
        with self.assertRaises(RuntimeError):preserved_containers(old,new)
    def test_duplicate_mount_destination_refused(self):
        with self.assertRaises(RuntimeError):mount_objects(self.mounts()+[self.mounts()[0]])
class OwnedFixtureTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        given=os.environ.get('LIMS_PROOF_GUARD_FIXTURE_DIR')
        require(given and pathlib.Path(given).is_absolute(),'Explicit NEW synthetic fixture directory required')
        cls.root=pathlib.Path(given);require(not cls.root.exists() and not cls.root.is_symlink(),'Fixture boundary consumed');cls.root.mkdir(mode=0o700,parents=True)
    def setUp(self):self.owner=self.root/sha(self._testMethodName.encode())[:12];self.owner.mkdir(mode=0o700)
    def database(self,name='before.db'):
        p=self.owner/name;db=sqlite3.connect(p);db.execute('CREATE TABLE evidence (id TEXT,value BLOB)');db.execute('CREATE TABLE _schema_migrations (id TEXT PRIMARY KEY,details TEXT)');db.execute('INSERT INTO evidence VALUES (?,?)',('one',b'original'));db.execute('INSERT INTO _schema_migrations VALUES (?,?)',('old','original receipt'));db.commit();db.close();return p
    def test_nonempty_wal_fold_master_preserved(self):
        p=self.database();writer=sqlite3.connect(p);writer.execute('PRAGMA journal_mode=WAL');writer.execute('PRAGMA wal_autocheckpoint=0');writer.execute('INSERT INTO evidence VALUES (?,?)',('two',b'in WAL'));writer.commit()
        try:
            old=triple(p);self.assertGreater(old['-wal']['bytes'],0)
            backup,state=seal(self.owner,'detached',p,lambda:None);self.assertEqual(state['tables']['evidence']['count'],2);self.assertEqual(logical(backup),state);self.assertEqual(triple(p),old)
            raw=self.owner/'detached/raw/dev.db';self.assertEqual(byte_identity(triple(raw)),byte_identity(old));write_new(self.owner/'fixture-result.json',{'countsIncludeNonemptyWal':True,'rawMasterPreserved':True,'productionConnections':0})
        finally:writer.close()
    def add_delta(self,source,tamper=False,column=False):
        after=self.owner/'after.db';after.write_bytes(source.read_bytes());db=sqlite3.connect(after);db.execute('CREATE TABLE NewEvidence (id TEXT)');db.execute('INSERT INTO _schema_migrations VALUES (?,?)',('new','new receipt'))
        if tamper:db.execute('UPDATE evidence SET value=?',(b'changed',))
        if column:db.execute('ALTER TABLE evidence ADD COLUMN unauthorized TEXT')
        db.commit();db.close();return after
    def test_valid_additive_rows_receipts(self):
        p=self.database();a=self.add_delta(p);r=delta(p,a,{'NewEvidence'},'new');self.assertTrue(r['allOriginalRowsAndReceiptsPreserved'])
    def test_original_row_change_refused(self):
        p=self.database();a=self.add_delta(p,tamper=True)
        with self.assertRaises(RuntimeError):delta(p,a,{'NewEvidence'},'new')
    def test_unapproved_column_refused(self):
        p=self.database();a=self.add_delta(p,column=True)
        with self.assertRaises(RuntimeError):delta(p,a,{'NewEvidence'},'new')
    def test_nonempty_added_table_refused(self):
        p=self.database();a=self.add_delta(p);db=sqlite3.connect(a);db.execute('INSERT INTO NewEvidence VALUES (?)',('backfill',));db.commit();db.close()
        with self.assertRaises(RuntimeError):delta(p,a,{'NewEvidence'},'new')
    def test_old_receipt_change_refused(self):
        p=self.database();a=self.add_delta(p);db=sqlite3.connect(a);db.execute('UPDATE _schema_migrations SET details=? WHERE id=?',('tampered','old'));db.commit();db.close()
        with self.assertRaises(RuntimeError):delta(p,a,{'NewEvidence'},'new')
    def test_absent_policy_preflight_cannot_apply(self):
        baseline=self.database();calls=[]
        class FakeDisk:
            def check(self):pass
        class FakeDocker:
            def cli(self,label,data,script,mode=None):
                calls.append((script,mode))
                if mode=='--apply':
                    db=sqlite3.connect(data/'dev.db');db.execute('CREATE TABLE unauthorized_policy_write (id TEXT)');db.commit();db.close()
                    return {'classification':'PRESENT','shape':'CANONICAL','mode':'APPLIED','totalChanges':0,'dataWrites':0}
                return {'classification':'ABSENT','mode':'DRY_RUN','totalChanges':0,'dataWrites':0,'readonlySnapshot':{'originalFilesPreserved':True}}
        with self.assertRaises(RuntimeError):install(self.owner,baseline,FakeDocker(),FakeDisk())
        self.assertEqual(calls,[('install_lab_policy_schema.js','--dry-run')]);self.assertEqual(logical(self.owner/'installation-target/dev.db'),logical(baseline))
    def test_owned_stop_works_after_reserve_and_headroom_failure(self):
        class RefusedDisk:
            def check(self):raise RuntimeError('Reserve refused')
            def time_guard(self,seconds):raise RuntimeError('Headroom refused')
        d=Docker(self.owner,RefusedDisk());id='d'*64;owner=str(self.owner)+':only-new';d.created=[(id,owner)]
        first={'Image':IMAGE,'Config':{'Labels':{'io.soilfer.release-owned':owner}},'State':{'Running':True}};closed=copy.deepcopy(first);closed['State']['Running']=False
        result=type('StopResult',(),{'returncode':0,'stdout':id.encode()+b'\n','stderr':b''})()
        with mock.patch('proof_docker.inspect',side_effect=[first,closed,closed]),mock.patch('proof_docker.subprocess.run',return_value=result) as stop:
            d.stop(id,owner,'owned-stop');stop.assert_called_once_with(['docker','stop','-t','10',id],capture_output=True,timeout=30)
    def test_stop_untracked_container_refused(self):
        d=Docker(self.owner,None)
        with mock.patch('proof_docker.inspect') as inspect_mock:
            with self.assertRaises(RuntimeError):d.stop('id','owner','label')
            inspect_mock.assert_not_called()
    def test_source_parent_alias_refused_before_open(self):
        p=self.owner/'aliased'/'dev.db'
        with mock.patch.object(pathlib.Path,'is_symlink',lambda q:q.name=='aliased'):
            with self.assertRaises(RuntimeError):file_state(p)
if __name__=='__main__':unittest.main(verbosity=2)
