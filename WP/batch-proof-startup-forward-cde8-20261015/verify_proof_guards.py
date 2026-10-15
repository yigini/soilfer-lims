"""Pure negative authority/accounting/container guards. Never run an operator in these tests."""
import copy,os,pathlib,sqlite3,unittest
from unittest import mock
from proof_contract import *
from proof_disk import growth,mount_guard,ALLOCATION,BOUND
from proof_docker import arguments,preserved_containers,Docker,mount_objects,container_ids,unused_name,all_containers
from proof_startup import startup_log
from proof_files import seal,triple,logical,delta,write_new,byte_identity,file_state,dry_identity,repeat_identity
from proof_budget import Budget,TABLE,TABLE_SHA,TOTAL_DB_COPIES,TOTAL_ASSET_COPIES,DB_EQUIVALENTS,REFERENCE_DB_BYTES,REFERENCE_ASSET_BYTES,declared_budget,copy_site_guard,EXPECTED_SITES,FLOOR_BYTES,LOG_BYTES,capacity_gate

def fixture_graph():return {'head':'a'*40,'files':{n:{'sha256':'b'*64,'blob':'c'*40,'bytes':1} for n in FILES}}
def fixture_review():
    i=fixture_graph();return {'id':6188000001,'performed_via_github_app':{'slug':'claude'},'html_url':'https://github.com/yigini/soilfer-lims/issues/162#issuecomment-6188000001','created_at':'2026-10-15T08:00:00Z','updated_at':'2026-10-15T08:00:00Z','body':'Source review: PASS\n'+'\n'.join(tokens(i))}
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
        v=fixture_review();v['updated_at']='2026-10-15T08:01:00Z'
        with self.assertRaises(RuntimeError):approval(v,fixture_graph())
    def test_fake_actor(self):
        v=fixture_review();v['performed_via_github_app']['slug']='someone'
        with self.assertRaises(RuntimeError):approval(v,fixture_graph())
    def test_later_failed(self):
        v=fixture_review()
        with self.assertRaises(RuntimeError):no_later_failure([{'created_at':'2026-10-15T08:02:00Z','body':'Source review: FAILED '+fixture_graph()['head']}],v,fixture_graph())
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
    def test_stopped_container_start(self):
        old={'id':{'name':'old','image':'old','running':False,'startedAt':'before','labels':{},'mounts':[]}};new=copy.deepcopy(old);new['id']['running']=True
        with self.assertRaises(RuntimeError):preserved_containers(old,new)
    def test_historical_container_delete(self):
        with self.assertRaises(RuntimeError):preserved_containers({'id':{}},{})
    def test_preserve_stopped(self):
        old={'id':{'name':'old','image':'old','running':False,'startedAt':'before','labels':{},'mounts':[]}};preserved_containers(old,copy.deepcopy(old))
    def test_scaled_reserve(self):self.assertEqual(reserve(4096,8192),FLOOR+DB_EQUIVALENTS*4096+3*8192+LOG_RESERVE)
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
    def relative_view(self):return self.view_line().replace('lowerdir=/var/lib/containerd/io.containerd.snapshotter.v1.overlayfs/snapshots/20/fs:/var/lib/containerd/io.containerd.snapshotter.v1.overlayfs/snapshots/19/fs','lowerdir=20/fs:19/fs')
    def test_compact_numeric_lowerdirs_resolve_counted_store(self):
        a=mount_guard(self.view_line(),ALLOCATION,['a'*64])[0];b=mount_guard(self.relative_view(),ALLOCATION,['a'*64])[0]
        self.assertEqual(a['lowerdirs'],b['lowerdirs']);self.assertEqual(b['lowerdirEncoding'],'CONTAINERD_COMPACT_NUMERIC_RELATIVE')
    def test_mixed_absolute_relative_lowerdirs_refused(self):
        with self.assertRaises(RuntimeError):mount_guard(self.relative_view().replace(':19/fs',':/var/lib/containerd/io.containerd.snapshotter.v1.overlayfs/snapshots/19/fs'),ALLOCATION,['a'*64])
    def test_relative_lowerdir_escape_refused(self):
        with self.assertRaises(RuntimeError):mount_guard(self.relative_view().replace('20/fs','../20/fs'),ALLOCATION,['a'*64])
    def test_relative_lowerdir_zero_or_leading_zero_refused(self):
        for n in ['0/fs','020/fs']:
            with self.assertRaises(RuntimeError):mount_guard(self.relative_view().replace('20/fs',n),ALLOCATION,['a'*64])
    def test_relative_lowerdir_foreign_upper_root_refused(self):
        with self.assertRaises(RuntimeError):mount_guard(self.relative_view().replace('upperdir=/var/lib/containerd/','upperdir=/unaccounted/'),ALLOCATION,['a'*64])
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
    def test_dry_actual_file_changed_main_refused(self):
        p=self.database();before=triple(p);raw=p.read_bytes();p.write_bytes(raw[:-1]+bytes([raw[-1]^1]))
        with self.assertRaises(RuntimeError):dry_identity(before,triple(p))
    def test_dry_actual_file_nonempty_wal_refused(self):
        p=self.database();before=triple(p);pathlib.Path(str(p)+'-wal').write_bytes(b'retained unexpected WAL')
        with self.assertRaises(RuntimeError):dry_identity(before,triple(p))
    def test_repeat_actual_file_changed_main_refused(self):
        p=self.database();before=triple(p);raw=p.read_bytes();p.write_bytes(raw[:-1]+bytes([raw[-1]^1]))
        result={'classification':'COMPLETE_206','mode':'NO_OP','totalChanges':0,'backfilledCount':0}
        with self.assertRaises(RuntimeError):repeat_identity(before,triple(p),result,'206')
    def test_repeat_actual_file_changed_wal_refused(self):
        p=self.database();wal=pathlib.Path(str(p)+'-wal');wal.write_bytes(b'original WAL');before=triple(p);wal.write_bytes(b'tampered WAL')
        result={'classification':'COMPLETE_206','mode':'NO_OP','totalChanges':0,'backfilledCount':0}
        with self.assertRaises(RuntimeError):repeat_identity(before,triple(p),result,'206')
    def test_refused_budget_bind_retains_exact_measured_inputs(self):
        from proof_disk import Disk
        disk=Disk(self.owner)
        with mock.patch.object(disk,'check',side_effect=RuntimeError('Reserve refused')):
            with self.assertRaises(RuntimeError):disk.bind(REFERENCE_DB_BYTES,REFERENCE_ASSET_BYTES)
        record=exact_json((self.owner/'measured-copy-reserve.json').read_bytes())
        self.assertEqual(record['requiredBytes'],31895225454);self.assertEqual(record['declaredDbCopies'],24)
class BudgetTests(unittest.TestCase):
    def capacity(self):return {'metadataOnly':True,'databaseReserveBytes':REFERENCE_DB_BYTES,'assetReserveBytes':REFERENCE_ASSET_BYTES,'requiredBytes':31895225454,'dbEquivalents':30,'stageTableSha256':TABLE_SHA,'freeBytes':{p:31895225454 for p in BOUND}}
    def test_capacity_enough_passes(self):capacity_gate(self.capacity())
    def test_insufficient_capacity_refuses_before_root(self):
        v=self.capacity();v['freeBytes']['/opt/lims']=31895225453
        with self.assertRaisesRegex(RuntimeError,'BEFORE_ROOT_CREATION_OR_UNIT_LAUNCH'):capacity_gate(v)
    def test_forged_smaller_capacity_graph_refused(self):
        v=self.capacity();v['dbEquivalents']=29
        with self.assertRaises(RuntimeError):capacity_gate(v)
    def model(self):return Budget(REFERENCE_DB_BYTES,REFERENCE_ASSET_BYTES)
    def claims(self,b):
        for site,count in TABLE[b.completed]['sites'].items():
            for _ in range(count):b.claim(site)
    def test_complete_graph_counts_include_nested_startup_snapshots(self):
        self.assertEqual((TOTAL_DB_COPIES,TOTAL_ASSET_COPIES,DB_EQUIVALENTS),(24,2,30));self.assertEqual(TABLE[-1]['dbTriples'],12)
    def test_reference_capacity_honestly_fits(self):
        b=self.model();self.assertEqual(b.required(),31895225454)
        b.begin('startup-1',58601160704);self.assertEqual(b.active,'startup-1')
    def test_remaining_reserve_does_not_double_count_own_copies(self):
        b=self.model();free=b.required()+REFERENCE_DB_BYTES
        for row in TABLE:
            b.begin(row['stage'],free);self.claims(b)
            actual=row['dbTriples']*b.db+row['assetCopies']*b.assets;free-=actual
            self.assertGreaterEqual(free,b.required());b.finish(row['stage'],actual);self.assertGreaterEqual(free,b.required())
        self.assertEqual(b.remaining(),0);self.assertEqual(b.required(),FLOOR_BYTES+LOG_BYTES)
    def test_stage_growth_beyond_margin_refused(self):
        b=self.model();b.begin('startup-1',b.required());self.claims(b)
        with self.assertRaises(RuntimeError):b.finish('startup-1',b.allowances[0]+1)
    def test_unknown_copy_producer_refused(self):
        b=self.model();b.begin('startup-1',b.required())
        with self.assertRaises(RuntimeError):b.claim('undeclared')
    def test_copy_count_overrun_refused(self):
        b=self.model();b.begin('startup-1',b.required());b.claim('triple');b.claim('triple')
        with self.assertRaises(RuntimeError):b.claim('triple')
    def test_missing_copy_claim_refused(self):
        b=self.model();b.begin('startup-1',b.required())
        with self.assertRaises(RuntimeError):b.finish('startup-1',0)
    def test_copy_before_stage_refused(self):
        with self.assertRaises(RuntimeError):self.model().claim('triple')
    def test_stage_order_refused(self):
        b=self.model()
        with self.assertRaises(RuntimeError):b.begin('issue-206',b.required())
    def test_stage_replay_refused(self):
        b=self.model();b.begin('startup-1',b.required());self.claims(b);b.finish('startup-1',0)
        with self.assertRaises(RuntimeError):b.begin('startup-1',b.required())
    def test_existing_active_stage_refused(self):
        b=self.model();b.begin('startup-1',b.required())
        with self.assertRaises(RuntimeError):b.begin('startup-1',b.required())
    def test_floor_and_logs_never_released(self):
        b=self.model();b.begin('startup-1',b.required());self.assertGreaterEqual(b.required(),FLOOR_BYTES+LOG_BYTES)
    def test_nonphysical_allocation_refused(self):
        for db,assets in [(0,0),(513,0),(512,-1),(True,0),(512,1)]:
            with self.assertRaises(RuntimeError):declared_budget(db,assets)
    def sources(self):
        encoded=os.environ.get('LIMS_PROOF_COPY_SITE_SOURCES')
        if encoded:
            import base64,json
            return {n:base64.b64decode(v) for n,v in json.loads(encoded).items()}
        return {n:(pathlib.Path(__file__).parent/n).read_bytes() for n in EXPECTED_SITES}
    def test_all_python_copy_sites_declared(self):copy_site_guard(self.sources())
    def test_new_copy_site_refused(self):
        sources=self.sources();sources['proof_inputs.py']+=b'\ndef extra_copy():\n    copy_file(a,b,c,d)\n'
        with self.assertRaises(RuntimeError):copy_site_guard(sources)
    def test_copy_site_inventory_incomplete_refused(self):
        sources=self.sources();sources.pop('proof_startup.py')
        with self.assertRaises(RuntimeError):copy_site_guard(sources)
    def test_budget_binding_cannot_use_old_128_token(self):
        review=fixture_review();review['body']=review['body'].replace('dbBudgetEquivalents=30','retainedDatabaseReserveMultiplier=128')
        with self.assertRaises(RuntimeError):approval(review,fixture_graph())
class NoOpIdentityTests(unittest.TestCase):
    def rows(self,main=b'original',wal=None,shm=b'shm'):
        def row(raw):return None if raw is None else {'sha256':sha(raw),'bytes':len(raw)}
        return {'':row(main),'-wal':row(wal),'-shm':row(shm)}
    def result(self):return {'classification':'COMPLETE_209','mode':'NO_OP','totalChanges':0,'backfilledCount':0}
    def test_dry_unchanged_main_absent_wal_passes(self):dry_identity(self.rows(),self.rows(shm=b'changed'))
    def test_dry_zero_length_wal_passes(self):dry_identity(self.rows(),self.rows(wal=b''))
    def test_dry_changed_main_same_length_refused(self):
        with self.assertRaises(RuntimeError):dry_identity(self.rows(),self.rows(main=b'changed!'))
    def test_dry_changed_main_length_refused(self):
        with self.assertRaises(RuntimeError):dry_identity(self.rows(),self.rows(main=b'longer original'))
    def test_dry_nonempty_wal_refused(self):
        with self.assertRaises(RuntimeError):dry_identity(self.rows(),self.rows(wal=b'pending changes'))
    def test_repeat_main_and_wal_equal_shm_excluded(self):repeat_identity(self.rows(wal=b'wal'),self.rows(wal=b'wal',shm=b'new'),self.result(),'209')
    def test_repeat_changed_main_refused(self):
        with self.assertRaises(RuntimeError):repeat_identity(self.rows(),self.rows(main=b'changed!'),self.result(),'209')
    def test_repeat_changed_wal_refused(self):
        with self.assertRaises(RuntimeError):repeat_identity(self.rows(wal=b'wal'),self.rows(wal=b'bad'),self.result(),'209')
    def test_repeat_wal_absent_to_empty_corrected_pass(self):
        repeat_identity(self.rows(),self.rows(wal=b''),self.result(),'209')
    def test_repeat_other_than_noop_zero_refused(self):
        for key,value in [('mode','APPLIED'),('totalChanges',1),('totalChanges',False),('classification','PRE_209'),('backfilledCount',1)]:
            result=self.result();result[key]=value
            with self.assertRaises(RuntimeError):repeat_identity(self.rows(),self.rows(),result,'209')
class StructuralNameTests(unittest.TestCase):
    def target(self):return 'lims-owned-batch-'+'a'*24
    def inventory(self):return {PREDECESSOR_ID:{'name':'/soilfer-lims'}}
    def test_exact_absent_name_proved_from_complete_inventory(self):
        self.assertTrue(unused_name(self.target(),self.inventory())['exactNameAbsent'])
    def test_present_exact_name_refused(self):
        rows=self.inventory();rows['b'*64]={'name':'/'+self.target()}
        with self.assertRaises(RuntimeError):unused_name(self.target(),rows)
    def test_similar_name_is_not_an_exact_collision(self):
        rows=self.inventory();rows['b'*64]={'name':'/'+self.target()+'-suffix'};unused_name(self.target(),rows)
    def test_missing_known_predecessor_refused(self):
        with self.assertRaises(RuntimeError):unused_name(self.target(),{})
    def test_missing_inspected_name_refused(self):
        rows=self.inventory();rows['b'*64]={}
        with self.assertRaises(RuntimeError):unused_name(self.target(),rows)
    def test_duplicate_inspected_name_refused(self):
        rows=self.inventory();rows['b'*64]={'name':'/soilfer-lims'}
        with self.assertRaises(RuntimeError):unused_name(self.target(),rows)
    def test_alias_or_noncanonical_name_refused(self):
        for name in ['soilfer-lims','/one/two','/','/bad name']:
            with self.assertRaises(RuntimeError):unused_name(self.target(),{PREDECESSOR_ID:{'name':name}})
    def test_arbitrary_requested_name_refused(self):
        with self.assertRaises(RuntimeError):unused_name('unowned',self.inventory())
    def test_complete_raw_id_inventory(self):self.assertEqual(container_ids(0,(PREDECESSOR_ID+'\n').encode(),b''),[PREDECESSOR_ID])
    def test_inventory_transport_failure_never_means_absence(self):
        for code,err in [(1,b'error: no such object: target'),(1,b'Cannot connect to the Docker daemon'),(0,b'warning: incomplete')]:
            with self.assertRaises(RuntimeError):container_ids(code,b'',err)
    def test_malformed_truncated_duplicate_ids_refused(self):
        for raw in [b'short\n',b'g'*64+b'\n',(PREDECESSOR_ID+'\n'+PREDECESSOR_ID+'\n').encode(),b'\n']:
            with self.assertRaises(RuntimeError):container_ids(0,raw,b'')
    def test_oversized_inventory_refused(self):
        with self.assertRaises(RuntimeError):container_ids(0,b'a'*(512*1024+1),b'')
    def test_known_predecessor_omitted_from_listing_refused_before_inspect(self):
        with mock.patch('proof_docker.inspect') as probe:
            with self.assertRaises(RuntimeError):all_containers(lambda:(b'',b''))
            probe.assert_not_called()
    def test_inspect_id_mismatch_refused(self):
        with mock.patch('proof_docker.inspect',return_value={'Id':'b'*64,'Name':'/soilfer-lims'}):
            with self.assertRaises(RuntimeError):all_containers(lambda:((PREDECESSOR_ID+'\n').encode(),b''))
    def test_inventory_deadline_stops_before_inspection(self):
        with mock.patch('proof_docker.time.monotonic',side_effect=[0,61]),mock.patch('proof_docker.inspect') as probe:
            with self.assertRaisesRegex(RuntimeError,'deadline'):all_containers(lambda:((PREDECESSOR_ID+'\n').encode(),b''))
            probe.assert_not_called()
class SnapshotHandoffTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        given=pathlib.Path(os.environ['LIMS_PROOF_GUARD_FIXTURE_DIR']);cls.root=given.parent/(given.name+'-handoff')
        require(given.is_absolute() and not cls.root.exists(),'New explicit retained handoff fixtures required');cls.root.mkdir(mode=0o700,parents=True)
    def setUp(self):
        import proof_files
        self.files=proof_files;self.owner=self.root/sha(self._testMethodName.encode())[:12];self.owner.mkdir(mode=0o700)
        self.live=self.owner/'live';self.live.mkdir(mode=0o700);self.db=self.live/'dev.db'
        db=sqlite3.connect(self.db);db.execute('CREATE TABLE evidence (id INTEGER,value TEXT)');db.execute('INSERT INTO evidence VALUES (1,?)',('original',));db.commit();db.close()
        self.assets=self.owner/'live-assets';self.assets.mkdir();(self.assets/'asset.txt').write_text('original',encoding='utf-8')
        self.paths=mock.patch.multiple('proof_files',LIVE_DATA=str(self.live),LIVE_ASSETS=str(self.assets));self.paths.start();self.addCleanup(self.paths.stop)
    def live_seal(self):return self.files.seal(self.owner,'fresh-production-snapshot',self.db,lambda:None,live_source=True)
    def handoff(self):return exact_json((self.owner/'fresh-production-snapshot/raw/snapshot-handoff.json').read_bytes())
    def mutate_live(self):
        db=sqlite3.connect(self.db);db.execute('INSERT INTO evidence VALUES (2,?)',('later legitimate producer',));db.commit();db.close()
    def test_stable_production_handoff_and_owned_wal_backup(self):
        opened=[];real=sqlite3.connect
        def connect(path,*a,**k):opened.append(str(path));return real(path,*a,**k)
        with mock.patch('proof_files.sqlite3.connect',side_effect=connect):backup,state=self.live_seal()
        h=self.handoff();self.assertEqual(h['beforeLiveTriple'],h['afterLiveTriple']);self.assertFalse(h['databaseAssetsCrossFileAtomicityClaimed']);self.assertTrue(h['handoffUtc'])
        self.assertEqual(self.files.identity_record(triple(self.owner/'fresh-production-snapshot/raw/dev.db')),h['rawCopyByteIdentity'])
        self.assertEqual(logical(backup),state);self.assertTrue(all('/raw/' not in p.replace('\\','/') and '/live/' not in p.replace('\\','/') for p in opened))
        self.assertEqual(stat_mode(self.owner/'fresh-production-snapshot/raw/snapshot-handoff.json'),0o444 if os.name=='nt' else 0o400)
    def test_live_changes_during_copy_stop_with_both_states_no_retry(self):
        real=self.files.copy_file;calls=[]
        def copying(src,dst,expected,check,live_evidence=None):
            result=real(src,dst,expected,check,live_evidence);calls.append(str(src))
            if pathlib.Path(src)==self.db:self.mutate_live()
            return result
        with mock.patch('proof_files.copy_file',side_effect=copying):
            with self.assertRaisesRegex(RuntimeError,'changed during copy'):self.live_seal()
        comparison=exact_json((self.owner/'fresh-production-snapshot/raw/copy-window-comparison.json').read_bytes())
        self.assertNotEqual(comparison['before'],comparison['after']);self.assertFalse(comparison['comparisonPassed']);self.assertEqual(calls,[str(self.db)]);self.assertFalse((self.owner/'fresh-production-snapshot/raw/snapshot-handoff.json').exists())
    def test_live_changes_after_handoff_are_observation_only(self):
        real=self.files.logical;changed=[]
        def scan(path):
            if pathlib.Path(path).parent.name=='reader' and not changed:self.assertTrue(self.handoff());self.mutate_live();changed.append(True)
            return real(path)
        with mock.patch('proof_files.logical',side_effect=scan):backup,state=self.live_seal()
        observation=self.files.live_metadata_observation();write_new(self.owner/'later-live-observation.json',observation)
        self.assertEqual(state['tables']['evidence']['count'],1);self.assertEqual(logical(self.db)['tables']['evidence']['count'],2);self.assertEqual(logical(backup),state)
        self.assertFalse(observation['snapshotAuthority']);self.assertTrue(observation['changesAreNotStopConditions']);self.assertEqual(observation['contentHashesTaken'],0)
    def test_nonempty_live_wal_handoff_survives_later_producer_write(self):
        writer=sqlite3.connect(self.db);writer.execute('PRAGMA journal_mode=WAL');writer.execute('PRAGMA wal_autocheckpoint=0');writer.execute('INSERT INTO evidence VALUES (2,?)',('inside snapshot WAL',));writer.commit()
        real=self.files.logical;changed=[]
        def scan(path):
            if pathlib.Path(path).parent.name=='reader' and not changed:
                self.assertGreater(self.handoff()['rawCopyByteIdentity']['-wal']['bytes'],0);writer.execute('INSERT INTO evidence VALUES (3,?)',('after snapshot handoff',));writer.commit();changed.append(True)
            return real(path)
        try:
            with mock.patch('proof_files.logical',side_effect=scan):backup,state=self.live_seal()
            self.assertEqual(state['tables']['evidence']['count'],2);self.assertEqual(logical(backup),state);self.assertEqual(logical(self.db)['tables']['evidence']['count'],3)
            self.assertEqual(self.files.identity_record(triple(self.owner/'fresh-production-snapshot/raw/dev.db')),self.handoff()['rawCopyByteIdentity'])
        finally:writer.close()
    def test_raw_master_changes_after_handoff_still_stop(self):
        real=self.files.logical;changed=[]
        def scan(path):
            if pathlib.Path(path).parent.name=='reader' and not changed:
                raw=self.owner/'fresh-production-snapshot/raw/dev.db';self.assertTrue(self.handoff());raw.chmod(0o600);b=raw.read_bytes();raw.write_bytes(b[:-1]+bytes([b[-1]^1]));raw.chmod(0o400);changed.append(True)
            return real(path)
        with mock.patch('proof_files.logical',side_effect=scan):
            with self.assertRaisesRegex(RuntimeError,'raw master changed'):self.live_seal()
        self.assertFalse((self.owner/'fresh-production-snapshot/seal.json').exists())
    def test_owned_source_late_changes_are_still_refused(self):
        real=self.files.logical;changed=[]
        def scan(path):
            if pathlib.Path(path).parent.name=='reader' and not changed:self.mutate_live();changed.append(True)
            return real(path)
        with mock.patch('proof_files.logical',side_effect=scan):
            with self.assertRaisesRegex(RuntimeError,'Original or raw master changed'):self.files.seal(self.owner,'owned',self.db,lambda:None)
    def test_wrong_production_label_refused(self):
        with self.assertRaises(RuntimeError):self.files.seal(self.owner,'owned',self.db,lambda:None,live_source=True)
    def test_wrong_live_db_path_refused(self):
        with self.assertRaises(RuntimeError):self.files.copy_triple(self.owner/'foreign.db',self.owner/'raw',lambda:None,live_source=True)
    def asset_copy(self):return self.files.copy_tree(self.assets,self.owner/'raw-assets',lambda:None,live_source=True,handoff_path=self.owner/'assets-snapshot-handoff.json')
    def test_asset_handoff_is_separate_and_outside_runtime_tree(self):
        self.asset_copy();h=exact_json((self.owner/'assets-snapshot-handoff.json').read_bytes());self.assertEqual(h['beforeLiveTree'],h['afterLiveTree']);self.assertFalse(h['databaseAssetsCrossFileAtomicityClaimed']);self.assertTrue(h['runtimeInputsOnlyNotScientificEvidence']);self.assertFalse((self.owner/'raw-assets/snapshot-handoff.json').exists())
    def test_assets_change_during_copy_stop_with_compared_states(self):
        real=self.files.copy_file
        def copying(src,dst,expected,check,live_evidence=None):
            result=real(src,dst,expected,check,live_evidence);pathlib.Path(src).write_text('later change',encoding='utf-8');return result
        with mock.patch('proof_files.copy_file',side_effect=copying):
            with self.assertRaisesRegex(RuntimeError,'Asset source changed'):self.asset_copy()
        c=exact_json((self.owner/'asset-copy-window-comparison.json').read_bytes());self.assertNotEqual(c['before'],c['after']);self.assertFalse((self.owner/'assets-snapshot-handoff.json').exists())
    def test_assets_change_after_handoff_only_observed_no_hashes(self):
        self.asset_copy();(self.assets/'asset.txt').write_text('legitimate later assets',encoding='utf-8')
        with mock.patch('proof_files.file_state',side_effect=AssertionError('Metadata observation must not hash')),mock.patch('proof_files.sqlite3.connect',side_effect=AssertionError('No observation SQL')):value=self.files.live_metadata_observation()
        self.assertFalse(value['snapshotAuthority']);self.assertTrue(value['changesAreNotStopConditions']);self.assertEqual(value['assetFiles']['asset.txt']['bytes'],len('legitimate later assets'))
    def test_live_file_changes_while_hashing_retain_metadata_pair(self):
        real=self.files.os.fstat;changed=[]
        def opened(fd):
            s=real(fd)
            if not changed:
                with self.db.open('ab') as f:f.write(b'actual growing-file mutation')
                changed.append(True)
            return s
        with mock.patch('proof_files.os.fstat',side_effect=opened):
            with self.assertRaisesRegex(RuntimeError,'changed during sampling'):self.files.file_state(self.db,self.owner)
        records=list(self.owner.glob('file-sampling-*.json'));self.assertEqual(len(records),1);c=exact_json(records[0].read_bytes());self.assertNotEqual(c['before'],c['after']);self.assertEqual(stat_mode(records[0]),0o444 if os.name=='nt' else 0o400)
    def test_live_observation_includes_asset_root_and_child_directories(self):
        (self.assets/'nested').mkdir();v=self.files.live_metadata_observation();self.assertIn('inode',v['assetRoot']);self.assertIn('nested',v['assetDirectories']);self.assertFalse(v['snapshotAuthority'])
    def test_missing_later_asset_root_is_recorded_not_refused(self):
        with mock.patch('proof_files.LIVE_ASSETS',str(self.owner/'missing-later-assets')):v=self.files.live_metadata_observation()
        self.assertEqual(v['assetRoot']['unavailable'],'FileNotFoundError');self.assertTrue(v['changesAreNotStopConditions']);self.assertFalse(v['snapshotAuthority'])
    def test_live_copy_byte_mismatch_retains_expected_and_actual(self):
        real=self.files.file_state
        def sampled(path,*args):
            value=real(path,*args)
            if pathlib.Path(path).name=='copy.db':value['sha256']='0'*64
            return value
        expected=file_state(self.db)
        with mock.patch('proof_files.file_state',side_effect=sampled):
            with self.assertRaisesRegex(RuntimeError,'Copy differs'):self.files.copy_file(self.db,self.owner/'copy.db',expected,lambda:None,self.owner)
        records=list(self.owner.glob('copy-bytes-*.json'));self.assertEqual(len(records),1);c=exact_json(records[0].read_bytes());self.assertNotEqual(c['before']['sha256'],c['after']['sha256'])
    def test_memory_stat_anon_and_file_counters(self):
        from proof_disk import parse_memory_stat
        v=parse_memory_stat(b'anon 123\nfile 456\nfile_mapped 8\n');self.assertEqual((v['anonBytes'],v['fileBytes']),(123,456))
    def test_memory_stat_missing_counter_refused(self):
        from proof_disk import parse_memory_stat
        with self.assertRaises(RuntimeError):parse_memory_stat(b'anon 123\n')
    def test_memory_stat_duplicate_or_negative_refused(self):
        from proof_disk import parse_memory_stat
        for raw in [b'anon 1\nanon 2\nfile 3\n',b'anon -1\nfile 2\n']:
            with self.assertRaises(RuntimeError):parse_memory_stat(raw)
    def test_budget_checkpoint_records_anon_file_before_reserve_stop(self):
        from proof_disk import Disk
        disk=Disk(self.owner);sample={'anonBytes':123,'fileBytes':456,'source':'CGROUP_V2_MEMORY_STAT','allCounters':{'anon':123,'file':456}}
        with mock.patch('proof_disk.cgroup_memory',return_value=sample),mock.patch.object(pathlib.Path,'is_dir',return_value=True),mock.patch.object(pathlib.Path,'is_symlink',return_value=False),mock.patch('proof_disk.shutil.disk_usage',return_value=type('Free',(),{'free':0})()):
            with self.assertRaisesRegex(RuntimeError,'reserve STOP'):disk.check()
        v=exact_json((self.owner/'memory-budget-check-000001.json').read_bytes());self.assertEqual((v['anonBytes'],v['fileBytes']),(123,456))

def stat_mode(path):
    import stat
    return stat.S_IMODE(pathlib.Path(path).stat().st_mode)

from proof_health import derive_healthcheck,assert_healthcheck,readiness_status
from proof_inputs import prior_records,validate_records,retained_guard

def real_bound_records():
    base=pathlib.Path(__file__).parent/'bound-input-records'
    return {n:exact_json((base/n).read_bytes()) for n in PRIOR_FILES}

class HealthDerivationTests(unittest.TestCase):
    def source(self):return (pathlib.Path(__file__).parent/'compose-source.yml').read_bytes()
    def derived(self):return derive_healthcheck(self.source())
    def pin(self,raw):
        import hashlib
        return {'bytes':len(raw),'sha256':sha(raw),'blob':hashlib.sha1(('blob '+str(len(raw))+'\0').encode()+raw).hexdigest(),'path':'synthetic-compose'}
    def test_real_compose_bytes_derive_all_flags_and_exact_cli_test(self):
        d=self.derived();self.assertEqual(d['composeTest'],['CMD','wget','-q','--spider','http://localhost:3000/api/health'])
        self.assertEqual(d['expectedDockerHealthcheck'],{'Test':['CMD-SHELL','exec wget -q --spider http://localhost:3000/api/health'],'Interval':30000000000,'Timeout':10000000000,'Retries':3,'StartPeriod':30000000000})
        self.assertEqual(d['createFlags'],['--health-cmd','exec wget -q --spider http://localhost:3000/api/health','--health-interval','30s','--health-timeout','10s','--health-retries','3','--health-start-period','30s'])
    def test_tampered_compose_pin_stops(self):
        with self.assertRaisesRegex(RuntimeError,'Pinned Compose'):derive_healthcheck(self.source()+b'\n')
    def test_forged_git_oid_stops(self):
        p=copy.deepcopy(COMPOSE_PIN);p['blob']='0'*40
        with self.assertRaisesRegex(RuntimeError,'Git blob'):derive_healthcheck(self.source(),p)
    def test_missing_field_stops_even_for_synthetic_accepted_pin(self):
        raw=self.source().replace(b'      timeout: 10s\n',b'').replace(b'      timeout: 10s\r\n',b'')
        with self.assertRaises(RuntimeError):derive_healthcheck(raw,self.pin(raw))
    def test_duplicate_field_stops(self):
        raw=self.source().replace(b'      interval:',b'      interval: 30s\n      interval:',1)
        with self.assertRaises(RuntimeError):derive_healthcheck(raw,self.pin(raw))
    def test_invalid_command_mode_stops(self):
        raw=self.source().replace(b'"CMD"',b'"NONE"')
        with self.assertRaises(RuntimeError):derive_healthcheck(raw,self.pin(raw))
    def test_null_healthcheck_stops_before_start(self):
        with self.assertRaisesRegex(RuntimeError,'absent'):assert_healthcheck(None,self.derived())
    def test_each_mismatched_value_stops(self):
        for key in ['Test','Interval','Timeout','Retries','StartPeriod']:
            h=copy.deepcopy(self.derived()['expectedDockerHealthcheck']);h[key]=['CMD','other'] if key=='Test' else h[key]+1
            with self.assertRaisesRegex(RuntimeError,'mismatch'):assert_healthcheck(h,self.derived())
    def test_unknown_health_field_stops(self):
        h=copy.deepcopy(self.derived()['expectedDockerHealthcheck']);h['Unexpected']=0
        with self.assertRaises(RuntimeError):assert_healthcheck(h,self.derived())
    def test_nonzero_start_interval_stops(self):
        h=copy.deepcopy(self.derived()['expectedDockerHealthcheck']);h['StartInterval']=1
        with self.assertRaises(RuntimeError):assert_healthcheck(h,self.derived())
    def test_exact_healthcheck_passes_and_zero_optional_start_interval(self):
        h=copy.deepcopy(self.derived()['expectedDockerHealthcheck']);assert_healthcheck(h,self.derived());h['StartInterval']=0;assert_healthcheck(h,self.derived())
    def test_unhealthy_is_an_immediate_stop(self):
        with self.assertRaisesRegex(RuntimeError,'immediate'):readiness_status({'Health':{'Status':'unhealthy'}})
    def test_missing_or_unknown_running_health_state_stops(self):
        for v in [{},{'Health':None},{'Health':{'Status':'unknown'}}]:
            with self.assertRaises(RuntimeError):readiness_status(v)
    def test_healthy_allows_http_stage(self):self.assertEqual(readiness_status({'Health':{'Status':'healthy'}}),'healthy')
    def test_starting_is_only_wait_state(self):self.assertEqual(readiness_status({'Health':{'Status':'starting'}}),'starting')
    def test_no_installer_or_policy_or_collector_creation_in_new_graph(self):
        from proof_docker import SCRIPTS
        self.assertEqual(CHAIN,[]);self.assertEqual(SCRIPTS,set())
        for script in ['install_sample_containers.js','install_control_charts.js','install_order_revisions.js','install_lab_policy_schema.js','order_revision_impact.js']:
            with self.assertRaisesRegex(RuntimeError,'forbids'):arguments(ROOT,'try',pathlib.Path(ROOT)/'data',pathlib.Path(ROOT)/'tmp',script,'--apply')
    def test_startup_creation_contains_only_derived_health_flags(self):
        d=self.derived()
        with mock.patch('proof_docker.load_health',return_value=d):
            n,o,args=arguments(ROOT,'startup-1',pathlib.Path(ROOT)/'data',pathlib.Path(ROOT)/'tmp',assets=pathlib.Path(ROOT)/'assets')
        self.assertIn(IMAGE,args);self.assertNotIn('--rm',args)
        for at in range(0,len(d['createFlags']),2):self.assertEqual(args[args.index(d['createFlags'][at])+1],d['createFlags'][at+1])

class BoundInstalled209Tests(unittest.TestCase):
    def test_actual_bound_closed_records_validate_without_sql(self):
        with mock.patch('sqlite3.connect',side_effect=AssertionError('No old input SQL')):
            self.assertEqual(len(validate_records(real_bound_records())),4517)
    def test_missing_input_record_stops(self):
        v=real_bound_records();v.pop('prior-stage-209.json')
        with self.assertRaises(RuntimeError):validate_records(v)
    def test_bound_prior_policy_is_canonical_noop_without_replay(self):
        v=real_bound_records();v['prior-policy-result.json']['classification']='ABSENT'
        with self.assertRaisesRegex(RuntimeError,'POLICY_PRESENT'):validate_records(v)
    def test_old_source_authority_or_wrong_root_stops(self):
        for key,change in [('prior-proof-input.json',{'toolingCommit':'0'*40}),('prior-closed-retention.json',{'root':'/other'})]:
            v=real_bound_records();v[key].update(change)
            with self.assertRaises(RuntimeError):validate_records(v)
    def test_recorded_logical_state_tamper_stops(self):
        v=real_bound_records();v['prior-installed-209--logical-state.json']['integrity']='bad'
        with self.assertRaises(RuntimeError):validate_records(v)
    def test_installed209_backup_cannot_be_substituted(self):
        v=real_bound_records();v['prior-installed-209--seal.json']['backup']='/other.db'
        with self.assertRaises(RuntimeError):validate_records(v)
    def test_old_installer_replay_or_nonzero_repeat_stops(self):
        for key in ['dry','repeat']:
            v=real_bound_records();v['prior-stage-209.json'][key]['totalChanges']=1
            with self.assertRaises(RuntimeError):validate_records(v)
    def test_bool_zero_repeat_stops(self):
        v=real_bound_records();v['prior-stage-209.json']['repeat']['totalChanges']=False
        with self.assertRaises(RuntimeError):validate_records(v)
    def test_original_rows_or_receipts_not_preserved_stops(self):
        v=real_bound_records();v['prior-preservation-209.json']['allOriginalRowsAndReceiptsPreserved']=False
        with self.assertRaises(RuntimeError):validate_records(v)
    def test_prior_running_container_stops(self):
        v=real_bound_records();next(iter(v['prior-closed-retention.json']['newOwnedContainersStoppedRetained'].values()))['running']=True
        with self.assertRaises(RuntimeError):validate_records(v)
    def test_prior_original_failure_identity_stops_if_reclassified(self):
        v=real_bound_records();v['prior-proof-terminal-refusal.json']['status']='PASSED'
        with self.assertRaises(RuntimeError):validate_records(v)
    def test_approved_amendment_refusal_is_carried_stop(self):
        v=real_bound_records();v['prior-actual-order-impact.json']['impact']['prospectiveApprovedAmendmentSampleCount']=1
        with self.assertRaises(RuntimeError):validate_records(v)
    def test_raw_input_cannot_be_opened_sqlite(self):
        v=real_bound_records();rows=validate_records(v)
        def state(path):
            rel=pathlib.Path(path).relative_to(pathlib.Path(PRIOR_ROOT)).as_posix();row=rows.get(rel);return None if row is None else {k:value for k,value in row.items() if k!='path'}
        raw={suffix:state(pathlib.Path(PRIOR_RAW_DATA)/('dev.db'+suffix)) for suffix in ['','-wal','-shm']}
        assets={'files':v['prior-assets-snapshot-handoff.json']['rawCopyByteIdentity'],'allocatedBytes':REFERENCE_ASSET_BYTES}
        with mock.patch('proof_inputs.file_state',side_effect=state),mock.patch('proof_inputs.triple',return_value=raw),mock.patch('proof_inputs.tree_state',return_value=assets),mock.patch('sqlite3.connect',side_effect=AssertionError('No SQL')):
            retained_guard(v)
    def test_exact_new_startup_only_budget(self):
        self.assertEqual((TOTAL_DB_COPIES,DB_EQUIVALENTS,TOTAL_ASSET_COPIES),(24,30,2));self.assertEqual([r['stage'] for r in TABLE],['startup-1','startup-2']);self.assertTrue(all(r['dbTriples']==12 for r in TABLE))

class StartupControlFlowTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        base=pathlib.Path(os.environ['LIMS_PROOF_GUARD_FIXTURE_DIR']);cls.root=base.with_name(base.name+'-health');require(not cls.root.exists(),'New health fixture required');cls.root.mkdir(parents=True,mode=0o700)
    def setUp(self):self.owner=self.root/sha(self._testMethodName.encode())[:12];self.owner.mkdir(mode=0o700)
    def exercise(self,status='healthy',health_mismatch=False,changed_state=False,probe_failure=False):
        from proof_startup import startup
        p=pathlib.Path(__file__).parent;derived=derive_healthcheck((p/'compose-source.yml').read_bytes());spec=real_bound_records()['prior-proof-input.json'];state={'ownedSyntheticState':'unchanged'};events=spec['expectedReadyEvents'];count=spec['expectedEntrypointVerifiers'];calls=[]
        log='\n'.join(['{"mode":"NO_OP","totalChanges":0}']*count)+'\nStarting SoilFER-LIMS...\n'+'\n'.join(json.dumps({'event':e,'totalChanges':0}) for e in events)
        class DiskFake:
            def begin_stage(self,label):calls.append(('begin',label))
            def finish_stage(self,label):calls.append(('finish',label))
            def check(self):pass
        class DockerFake:
            def create(self,label,*a,**kw):calls.append(('create',label));return label,str(self)
            def validate(self,*a):return {'State':{'Health':{'Status':status}},'Config':{'Healthcheck':derived['expectedDockerHealthcheck']}}
            def stop(self,id,*a):calls.append(('stop',id))
            def command(self,args,label,*a):
                calls.append(('command',args[1]))
                if args[1]=='logs':return log.encode(),b''
                if args[1]=='exec':
                    program=args[-1]
                    if 'memory.peak' in program:return b'4096',b''
                    if 'const checks=[]' in program:return b'[{"path":"/api/health","status":200},{"path":"/login","status":200},{"path":"/api/v2/sis/receipts","status":401}]',b''
                    if probe_failure:raise RuntimeError('HTTP health failed')
                    return b'{"status":"ok"}',b''
                return b'new-owned-id',b''
        health=copy.deepcopy(derived['expectedDockerHealthcheck']);health['Interval']+=1 if health_mismatch else 0
        def clone(root,label,*a):return root/label
        def sealed(*a):return self.owner/'new-owned-stopped-backup.db',({'changed':True} if changed_state else state)
        with mock.patch('proof_startup.clone_backup',side_effect=clone),mock.patch('proof_startup.copy_tree'),mock.patch('proof_startup.seal',side_effect=sealed),mock.patch('proof_startup.load_health',return_value=derived),mock.patch('proof_startup.inspect',return_value={'Config':{'Healthcheck':health}}),mock.patch('proof_startup.time.sleep',side_effect=AssertionError('Unexpected wait')):
            try:result=startup(self.owner,self.owner/'old-input-never-opened.db',state,self.owner/'assets',DockerFake(),DiskFake(),events,count,lambda:calls.append(('input-guard','checked')))
            except BaseException as error:return error,calls
        return result,calls
    def test_two_healthy_plus_http_startups_pass_and_remain_independent(self):
        r,calls=self.exercise();self.assertIsInstance(r,list);self.assertEqual(len(r),2);self.assertEqual([x['id'] for x in r],['startup-1','startup-2']);self.assertTrue(all(x['fullInstalledStatePreserved'] and x['stoppedContainerRetained'] for x in r));self.assertEqual(calls.count(('command','start')),2);self.assertEqual(calls.count(('input-guard','checked')),4);self.assertLess(calls.index(('input-guard','checked')),calls.index(('create','startup-1')))
    def test_mismatch_stops_before_any_start_or_entrypoint_attempt(self):
        r,calls=self.exercise(health_mismatch=True);self.assertIsInstance(r,RuntimeError);self.assertNotIn(('command','start'),calls);self.assertFalse((self.owner/'startup-1-default-entrypoint-attempt.json').exists())
    def test_unhealthy_immediate_stop_with_retained_evidence(self):
        r,calls=self.exercise(status='unhealthy');self.assertIsInstance(r,RuntimeError);self.assertIn('immediate',str(r));self.assertIn(('stop','startup-1'),calls);self.assertNotIn(('command','exec'),calls);self.assertTrue((self.owner/'startup-1-readiness-refusal-health-state.json').exists())
    def test_healthy_but_http_failure_is_not_pass_and_container_stops(self):
        r,calls=self.exercise(probe_failure=True);self.assertIsInstance(r,RuntimeError);self.assertIn(('stop','startup-1'),calls);self.assertFalse((self.owner/'startup-1-result.json').exists())
    def test_changed_full_stopped_state_is_refused(self):
        r,calls=self.exercise(changed_state=True);self.assertIsInstance(r,RuntimeError);self.assertIn('full stopped installed state',str(r));self.assertFalse((self.owner/'startup-1-result.json').exists())

class ActualOwnedValidationTests(unittest.TestCase):
    source=HealthDerivationTests.source
    derived=HealthDerivationTests.derived
    def fixture(self):
        root=pathlib.Path(ROOT);owner=str(root)+':startup-1';data=root/'data';tmp=root/'tmp';assets=root/'assets';id='a'*64
        v={'Id':id,'Image':IMAGE,'RestartCount':0,'State':{'Running':False,'OOMKilled':False},'Config':{'Labels':{'io.soilfer.release-owned':owner},'Env':['NODE_OPTIONS=','ALLOW_PRISMA_DB_PUSH=false','ALLOW_AUTO_SEED=false','DISABLE_BACKGROUND_JOBS=true'],'Healthcheck':self.derived()['expectedDockerHealthcheck']},'HostConfig':{'Memory':MEMORY,'MemorySwap':MEMORY,'NetworkMode':'none','RestartPolicy':{'Name':'no'}},'Mounts':[{'Type':'bind','Source':str(p),'Destination':dst,'RW':True} for p,dst in [(data,'/app/server/prisma'),(tmp,'/tmp'),(assets,'/app/server/uploads')]]}
        return root,owner,data,tmp,id,v
    def validate(self,change=None):
        root,owner,data,tmp,id,v=self.fixture()
        if change:change(v)
        with mock.patch('proof_docker.inspect',return_value=v),mock.patch('proof_docker.load_health',return_value=self.derived()):return Docker(root,None).validate(id,owner,data,tmp,False)
    def test_actual_validate_accepts_exact_derived_health_after_create(self):self.validate()
    def test_actual_validate_refuses_absent_health_after_create(self):
        with self.assertRaises(RuntimeError):self.validate(lambda v:v['Config'].update(Healthcheck=None))
    def test_actual_validate_refuses_changed_duration_after_create(self):
        with self.assertRaises(RuntimeError):self.validate(lambda v:v['Config']['Healthcheck'].update(Timeout=1))
    def test_actual_validate_refuses_heap_or_jobs_override(self):
        for env in [['NODE_OPTIONS=--max-old-space-size=1024'],['DISABLE_BACKGROUND_JOBS=false']]:
            with self.assertRaises(RuntimeError):self.validate(lambda v:v['Config'].update(Env=env))
    def test_actual_validate_refuses_memory_or_swap_or_network_override(self):
        for key,value in [('Memory',MEMORY+1),('MemorySwap',MEMORY+1),('NetworkMode','bridge')]:
            with self.assertRaises(RuntimeError):self.validate(lambda v:v['HostConfig'].update({key:value}))
    def test_actual_validate_refuses_production_mount(self):
        with self.assertRaises(RuntimeError):self.validate(lambda v:v['Mounts'][0].update(Source=LIVE_DATA))
    def test_actual_validate_refuses_restart_or_oom(self):
        with self.assertRaises(RuntimeError):self.validate(lambda v:v.update(RestartCount=1))
        with self.assertRaises(RuntimeError):self.validate(lambda v:v['State'].update(OOMKilled=True))

if __name__=='__main__':unittest.main(verbosity=2)

