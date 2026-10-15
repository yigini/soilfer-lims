"""Isolated refusal tests for build authority and archive boundaries; no network/Docker."""
import copy,hashlib,io,tarfile,unittest
from batch_build_contract import *

def fixture():
    index={'head':'a'*40,'files':{n:{'bytes':10,'blob':'b'*40,'sha256':'c'*64} for n in SOURCE_FILES}}
    review={'id':6199000001,'html_url':'https://github.com/yigini/soilfer-lims/issues/162#issuecomment-6199000001',
        'performed_via_github_app':{'slug':'claude'},'created_at':'2026-10-15T18:00:00Z','updated_at':'2026-10-15T18:00:00Z',
        'body':'Source review: PASS\n'+'\n'.join(review_tokens(index['head'],index))}
    spec={'status':'PREPARED_BATCH_BUILD_ONLY_NOT_LAUNCHED','head':CANDIDATE,'tree':TREE,'scope':SCOPE,'rootName':FIRST_BUILD_ROOT_NAME,
        'audits':copy.deepcopy(AUDITS),'mainCiRun':MAIN_CI,'labAndHubBuildsOwnedByYY':True,'releaseWindowControl':'RELEASE_DAY_DISK_ABORTS_ACCEPTED',
        'productionDatabaseMounts':0,'productionDatabaseConnections':0,'proofLaunches':0,'productionDeployments':0,
        'toolingCommit':index['head'],'toolingSourceIndexSha256':sha(canonical(index)),'sourceReviewId':review['id'],'sourceReviewRawSha256':sha(canonical(review)),
        'reserveFloorBytes':FLOOR,'buildAllocationReserveBytes':BUILD_ALLOCATION,'buildTimeoutSeconds':BUILD_TIMEOUT,
        'buildUnitTimeoutSeconds':UNIT_TIMEOUT,'unexplainedGrowthAbortBytes':UNEXPLAINED_GROWTH_ABORT,'diskGrowthPolicy':GROWTH_POLICY}
    spec.update(allocationMeasurementTimeoutSeconds=MEASUREMENT_TIMEOUT,batchBuildMemoryLimitBytes=MEMORY,originalFailedRoot=ORIGINAL_FAILED_ROOT,metadataAnalysisAudit=ANALYSIS_AUDIT,referenceFiles=copy.deepcopy(REFERENCE_FILES),fallbackDirectionId=FALLBACK_DIRECTION_ID,fallbackDirectionRawSha256='e'*64)
    app={'head':CANDIDATE,'tree':TREE,'entries':[{'path':'Dockerfile','mode':'100644','bytes':10}]}
    plan=capacity_plan(app,{n:10 for n in REQUIRED_ARTIFACTS if n!='build-input.json'})
    spec.update(capacityPlan=plan,capacityPlanSha256=sha(canonical(plan)))
    return spec,index,review
def archive(files):
    output=io.BytesIO();rows=[]
    with tarfile.open(fileobj=output,mode='w') as t:
        for name,data,mode in files:
            info=tarfile.TarInfo(name)
            if mode=='120000':info.type=tarfile.SYMTYPE;info.linkname=data.decode();t.addfile(info)
            else:info.size=len(data);t.addfile(info,io.BytesIO(data))
            rows.append({'path':name,'bytes':len(data),'mode':mode,'sha256':sha(data),'blob':hashlib.sha1(('blob '+str(len(data))+'\0').encode()+data).hexdigest()})
    output.seek(0)
    return output,{'status':'COMMITTED_APPLICATION_GIT_BLOB_INDEX','head':CANDIDATE,'tree':TREE,'entries':rows}
class AuthorityGuards(unittest.TestCase):
    def test_current_bound_build_scope_passes(self):
        spec,index,review=fixture();validate_spec(spec,index,review)
    def test_historical_and_expanded_bindings_refuse(self):
        changes={'head':PREDECESSOR,'tree':'d'*40,'scope':'DEPLOY','rootName':'instrument-import-release-959d17e1-20261012T213000Z',
            'mainCiRun':38629458186,'labAndHubBuildsOwnedByYY':False,'releaseWindowControl':'OVERRIDE','productionDatabaseMounts':1,
            'productionDatabaseConnections':1,'proofLaunches':1,'productionDeployments':1,'reserveFloorBytes':FLOOR-1,
            'buildAllocationReserveBytes':0,'buildTimeoutSeconds':5400,'sourceReviewId':6178123314,'productionDatabaseMounts_bool':False}
        for key,value in changes.items():
            with self.subTest(key=key):
                spec,index,review=fixture();spec[key.removesuffix('_bool')]=value
                with self.assertRaises(RuntimeError):validate_spec(spec,index,review)
    def test_changed_source_graph_missing_file_and_extra_file_refuse(self):
        for mode in ['changed','missing','extra']:
            with self.subTest(mode=mode):
                spec,index,review=fixture()
                if mode=='changed':index['files']['batch_build.py']['sha256']='d'*64
                elif mode=='missing':del index['files']['batch_build.py']
                else:index['files']['deploy.py']=index['files']['batch_build.py']
                with self.assertRaises(RuntimeError):validate_spec(spec,index,review)
    def test_old_edited_wrong_actor_and_incomplete_reviews_refuse(self):
        for kind in ['old','edited','actor','missing-token','failed','wrong-url']:
            with self.subTest(kind=kind):
                spec,index,review=fixture()
                if kind=='old':review['id']=6178123314
                elif kind=='edited':review['updated_at']='2026-10-15T18:01:00Z'
                elif kind=='actor':review['performed_via_github_app']['slug']='other'
                elif kind=='missing-token':review['body']=review['body'].replace('batch_build.py='+'c'*64,'')
                elif kind=='failed':review['body']=review['body'].replace('Source review: PASS','Source review: FAILED')
                else:review['html_url']='https://github.com/yigini/soilfer-lims/issues/209#issuecomment-6199000001'
                spec['sourceReviewRawSha256']=sha(canonical(review))
                with self.assertRaises(RuntimeError):validate_spec(spec,index,review)
    def test_unreviewed_individual_issue_or_main_moves_refuse(self):
        main={'object':{'sha':CANDIDATE}};ci={'id':MAIN_CI,'head_sha':CANDIDATE,'event':'push','run_attempt':1,'status':'completed','conclusion':'success'}
        prs={};verdicts={};comments={}
        for a in AUDITS:
            n=str(a['pr']);prs[n]={'merged':True,'merge_commit_sha':a['merge'],'head':{'sha':a['source']}}
            verdicts[n]={'id':a['comment'],'body':'Audit passed: OK to merge and deploy\n'+a['source'],'performed_via_github_app':{'slug':'claude'},'created_at':'2026-10-14T20:48:25Z'};comments[n]=[]
        validate_current(main,ci,prs,verdicts,comments)
        altered=copy.deepcopy(main);altered['object']['sha']=PREDECESSOR
        with self.assertRaises(RuntimeError):validate_current(altered,ci,prs,verdicts,comments)
        for a in AUDITS:
            with self.subTest(issue=a['issue']):
                v=copy.deepcopy(verdicts);v[str(a['pr'])]['body']='Audit failed '+a['source']
                with self.assertRaises(RuntimeError):validate_current(main,ci,prs,v,comments)
        later=copy.deepcopy(comments);later['297']=[{'created_at':'2026-10-15T18:01:00Z','body':'Audit failed: current head'}]
        with self.assertRaises(RuntimeError):validate_current(main,ci,prs,verdicts,later)
        rerun=copy.deepcopy(ci);rerun['run_attempt']=2
        with self.assertRaises(RuntimeError):validate_current(main,rerun,prs,verdicts,comments)
    def test_duplicate_json_and_unsafe_roots_refuse(self):
        with self.assertRaises(RuntimeError):json_exact('{"head":"safe","head":"other"}')
        for name in ['../workflow-batch-build-cde8c889-20261014T220000Z','/opt/lims/releases/workflow-batch-build-cde8c889-20261014T220000Z','workflow-batch-build-959d17e1-20261014T220000Z']:
            with self.subTest(name=name),self.assertRaises(RuntimeError):safe_build_root(name)
        with self.assertRaises(RuntimeError):safe_build_root('workflow-batch-build-cde8c889-20261014T221600Z')
    def test_later_source_rejection_refuses_and_unrelated_note_does_not(self):
        spec,index,review=fixture()
        no_later_source_failure([{'created_at':'2026-10-15T18:01:00Z','body':'Audit failed on a historical unrelated source'}],review,index['head'])
        for text in ['Source review: FAILED','Source review: changes required','Audit failed']:
            with self.subTest(text=text),self.assertRaises(RuntimeError):
                no_later_source_failure([{'created_at':'2026-10-15T18:01:00Z','body':text+' '+index['head']}],review,index['head'])
class ArchiveGuards(unittest.TestCase):
    def test_raw_application_file_and_ignored_dependency_link(self):
        stream,index=archive([('Dockerfile',b'FROM node\n','100644'),('server/node_modules/pkg',b'../../elsewhere','120000')])
        with tarfile.open(fileobj=stream) as t:self.assertEqual([m.name for m in verify_archive_members(t,index)],['Dockerfile'])
    def test_unsafe_paths_and_links_refuse(self):
        for name,mode in [('../escape','100644'),('/tmp/escape','100644'),('server/../../escape','100644'),('WP/tooling.py','100644'),('server/link','120000'),('server\\escape','100644')]:
            with self.subTest(name=name):
                stream,index=archive([(name,b'elsewhere',mode)])
                with tarfile.open(fileobj=stream) as t,self.assertRaises(RuntimeError):verify_archive_members(t,index)
    def test_duplicate_missing_modified_and_wrong_source_inventory_refuse(self):
        for kind in ['duplicate','missing','bytes','blob','head','tree','extra']:
            with self.subTest(kind=kind):
                stream,index=archive([('Dockerfile',b'FROM node\n','100644')])
                if kind=='duplicate':index['entries'].append(copy.deepcopy(index['entries'][0]))
                elif kind=='missing':index['entries']=[]
                elif kind=='bytes':index['entries'][0]['sha256']='e'*64
                elif kind=='blob':index['entries'][0]['blob']='e'*40
                elif kind=='head':index['head']=PREDECESSOR
                elif kind=='tree':index['tree']='e'*40
                else:index['entries'].append({**index['entries'][0],'path':'extra'})
                with tarfile.open(fileobj=stream) as t,self.assertRaises(RuntimeError):verify_archive_members(t,index)
    def test_foreign_directories_executable_modes_and_hardlinks_refuse(self):
        for kind in ['directory','mode','hardlink']:
            with self.subTest(kind=kind):
                stream,index=archive([('Dockerfile',b'FROM node\n','100644')])
                out=io.BytesIO()
                with tarfile.open(fileobj=stream) as prior,tarfile.open(fileobj=out,mode='w') as modified:
                    m=prior.getmembers()[0]
                    if kind=='mode':m.mode=0o777
                    if kind=='hardlink':m.type=tarfile.LNKTYPE;m.linkname='/tmp/outside';m.size=0
                    modified.addfile(m,prior.extractfile(prior.getmembers()[0]) if kind!='hardlink' else None)
                    if kind=='directory':
                        foreign=tarfile.TarInfo('foreign');foreign.type=tarfile.DIRTYPE;modified.addfile(foreign)
                out.seek(0)
                with tarfile.open(fileobj=out) as t,self.assertRaises(RuntimeError):verify_archive_members(t,index)
class DiskGuards(unittest.TestCase):
    def allocation_fixture(self):
        root=str(safe_build_root(FIRST_BUILD_ROOT_NAME));rows={p:{'device':1,'bytes':0,'exists':True,'symlink':False} for p in allocation_paths(root)}
        return root,rows
    def test_complete_disjoint_containerd_inventory_required_and_optional_legacy_absence_allowed(self):
        root,rows=self.allocation_fixture();validate_allocation_inventory(root,rows)
        rows['/var/lib/docker/overlay2']['exists']=False;validate_allocation_inventory(root,rows)
        for mode in ['missing','absent','alias','rounded','extra']:
            r=copy.deepcopy(rows)
            if mode=='missing':del r['/var/lib/containerd']
            elif mode=='absent':r['/var/lib/containerd']['exists']=False
            elif mode=='alias':r['/var/lib/containerd']['symlink']=True
            elif mode=='rounded':r['/var/lib/containerd']['bytes']=1.5
            else:r['/var/lib/docker']={'device':1,'bytes':0,'exists':True,'symlink':False}
            with self.subTest(mode=mode),self.assertRaises(RuntimeError):validate_allocation_inventory(root,r)
    def test_old_consumed_build_root_and_same_namespace_aliases_are_refused(self):
        for name in [pathlib.PurePosixPath(ORIGINAL_FAILED_ROOT).name,FIRST_BUILD_ROOT_NAME+'-retry',FIRST_BUILD_ROOT_NAME.replace('190000','191000')]:
            with self.assertRaises(RuntimeError):safe_build_root(name)
    def test_descendant_mounts_and_malformed_mount_inventory_refuse_without_traversal(self):
        roots=['/var/lib/containerd','/var/lib/docker/buildkit']
        line='23 1 253:1 / /var/lib/containerd rw - ext4 /dev/vda1 rw'
        no_descendant_mounts(line,roots)
        for text in [line.replace('/var/lib/containerd ','/var/lib/containerd/snapshots/foreign '),line.replace('/var/lib/containerd ','/var/lib/docker/buildkit/foreign '),'', 'bad']:
            with self.assertRaises(RuntimeError):no_descendant_mounts(text,roots)
        no_descendant_mounts(line.replace('/var/lib/containerd ','/var/lib/containerd-other/ '),roots)
        with self.assertRaises(RuntimeError):no_descendant_mounts(line+'\n'+line.replace('/var/lib/containerd ','/var/lib/docker/buildkit/foreign '),iter(roots))
    def topology_fixture(self):
        return ['overlayfs\n','[["driver-type","io.containerd.snapshotter.v1"]]','/var/lib/docker\n','LoadState=loaded\nActiveState=active\nMainPID=679\nExecStart={ path=/usr/bin/containerd ; argv[]=/usr/bin/containerd ; }',"version = 3\nroot = '/var/lib/containerd'\nstate = '/run/containerd'\n[plugins]\nroot = 'not-top-level'\n"]
    def test_actual_containerd_top_level_and_no_custom_daemon_root_required(self):
        values=self.topology_fixture();result=storage_topology(*values);self.assertEqual(result['containerdRoot'],'/var/lib/containerd')
        for index,value in [(0,'overlay2'),(1,'[]'),(2,'/other'),(3,values[3].replace('/usr/bin/containerd ; }','/usr/bin/containerd --root /other ; }')),(4,values[4].replace("'/var/lib/containerd'","'/other'")),(4,values[4].replace('version = 3','version = 2'))]:
            args=values.copy();args[index]=value
            with self.subTest(index=index),self.assertRaises(RuntimeError):storage_topology(*args)
    def test_new_spec_cannot_drop_containerd_measurement_or_failure_reference_bindings(self):
        for key,value in [('allocationMeasurementTimeoutSeconds',0),('batchBuildMemoryLimitBytes',MEMORY+1),('originalFailedRoot','wrong'),('metadataAnalysisAudit','wrong'),('referenceFiles',{}),('fallbackDirectionId',6179940139),('fallbackDirectionRawSha256','short')]:
            values=fixture();values[0][key]=value
            with self.subTest(key=key),self.assertRaises(RuntimeError):validate_spec(*values)
    def test_source_only_fallback_direction_does_not_adopt_or_reclassify_original(self):
        direction={'id':FALLBACK_DIRECTION_ID,'performed_via_github_app':{'slug':'claude'},'created_at':'2026-10-14T22:49:57Z','updated_at':'2026-10-14T22:49:57Z','body':'This is direction only. send a new build source with corrected Docker+containerd accounting for review instead.'}
        failed={'status':'FAILED_OR_RESERVE_REFUSED_BUILD_ONLY_RETAIN_ALL','error':'Unexplained disk growth reached the 500MB abort boundary'}
        analysis={'status':'RETAINED_METADATA_INSUFFICIENT_FOR_IMAGE_ADOPTION','adoptionMustStop':True,'imageEligibility':False,'growthBytesCreditedByThisAnalysis':0}
        fallback_evidence(direction,failed,analysis)
        for which,key,value in [(0,'updated_at','changed'),(0,'body','Approval'),(1,'status','PASS'),(2,'imageEligibility',True),(2,'growthBytesCreditedByThisAnalysis',3609116672)]:
            values=copy.deepcopy([direction,failed,analysis]);values[which][key]=value
            with self.assertRaises(RuntimeError):fallback_evidence(*values)
    def test_cache_shrink_does_not_hide_unexplained_growth(self):
        before={'docker':2000000000};after={'docker':2200000000};devices={'docker':1}
        old={'source':{'device':1,'bytes':0},'cache':{'device':1,'bytes':900000000}}
        new={'source':{'device':1,'bytes':0},'cache':{'device':1,'bytes':0}}
        with self.assertRaises(RuntimeError):build_disk_growth(before,after,devices,old,new)
    def test_known_growth_does_not_mask_a_different_filesystem(self):
        before={'lims':2000000000,'docker':2000000000};after={'lims':1500000000,'docker':1000000000};devices={'lims':1,'docker':2}
        old={'source':{'device':1,'bytes':0},'cache':{'device':2,'bytes':0}}
        new={'source':{'device':1,'bytes':0},'cache':{'device':2,'bytes':1000000000}}
        with self.assertRaises(RuntimeError):build_disk_growth(before,after,devices,old,new)
    def test_shared_filesystem_counts_known_allocations_once_and_bounds_residual(self):
        before={'lims':2000000000,'docker':2000000000};after={'lims':1000000000,'docker':1000000000};devices={'lims':1,'docker':1}
        old={'source':{'device':1,'bytes':0},'cache':{'device':1,'bytes':0}}
        new={'source':{'device':1,'bytes':200000000},'cache':{'device':1,'bytes':800000000}}
        result=build_disk_growth(before,after,devices,old,new)
        self.assertEqual(result['filesystems']['lims']['unexplainedGrowthBytes'],0)
        after['lims']-=UNEXPLAINED_GROWTH_ABORT
        with self.assertRaises(RuntimeError):build_disk_growth(before,after,devices,old,new)

class FreshCapacityGuards(unittest.TestCase):
    def plan(self):
        return capacity_plan({'head':CANDIDATE,'tree':TREE,'entries':[{'path':'server/index.js','mode':'100644','bytes':4097}]},{n:12 for n in REQUIRED_ARTIFACTS if n!='build-input.json'})
    def test_exact_computed_requirement_plus_ten_gb_and_consumption_phases(self):
        p=self.plan()
        self.assertEqual(p['sourceRoundedFileBytes'],8192)
        self.assertEqual(capacity_requirement(p,'before-build'),FLOOR+BUILD_ALLOCATION+10_000_000_000)
        self.assertEqual(capacity_requirement(p,'before-root')-capacity_requirement(p,'before-unit'),p['packageAllocationAllowanceBytes'])
        self.assertEqual(capacity_requirement(p,'before-unit')-capacity_requirement(p,'before-build'),p['sourceExtractionAllowanceBytes'])
    def test_one_byte_short_refuses_each_phase_without_cleanup_or_root(self):
        p=self.plan()
        for phase in ['before-root','before-unit','before-build']:
            rows={n:{'freeBytes':capacity_requirement(p,phase),'device':1,'blockBytes':4096,'symlink':False,'directory':True} for n in ['/opt/lims','/var/lib/docker','/var/lib/containerd']}
            validate_capacity_observation(p,phase,rows)
            rows['/opt/lims']['freeBytes']-=1
            with self.assertRaises(RuntimeError):validate_capacity_observation(p,phase,rows)
    def test_missing_path_alias_changed_block_boolean_free_and_headroom_refuse(self):
        p=self.plan();phase='before-root'
        initial={n:{'freeBytes':capacity_requirement(p,phase),'device':1,'blockBytes':4096,'symlink':False,'directory':True} for n in ['/opt/lims','/var/lib/docker','/var/lib/containerd']}
        for kind in ['missing','alias','block','bool','directory']:
            rows=copy.deepcopy(initial)
            if kind=='missing':del rows['/var/lib/containerd']
            else:
                key,value={'alias':('symlink',True),'block':('blockBytes',512),'bool':('freeBytes',True),'directory':('directory',False)}[kind]
                rows['/opt/lims'][key]=value
            with self.assertRaises(RuntimeError):validate_capacity_observation(p,phase,rows)
        p['additionalHeadroomBytes']-=1
        with self.assertRaises(RuntimeError):capacity_requirement(p,phase)
    def test_changed_package_source_or_budget_refuses(self):
        p=self.plan()
        for key,value in [('capacityPlan',{}),('capacityPlanSha256','bad')]:
            spec,index,review=fixture();spec[key]=value
            with self.assertRaises(RuntimeError):validate_spec(spec,index,review)
        with self.assertRaises(RuntimeError):capacity_plan({'head':PREDECESSOR,'tree':TREE,'entries':[]},{})
    def test_launcher_and_builder_gate_order_is_structural(self):
        raw=globals().get('SOURCE_RAW_FILES')
        if raw is None:
            here=pathlib.Path(__file__).resolve().parent
            raw={n:(here/n).read_bytes() for n in SOURCE_FILES}
        launch=raw['launch_batch_build.py'].decode()
        build=raw['batch_build.py'].decode()
        self.assertLess(launch.index("fresh_capacity(package,spec,'before-root'"),launch.index("create="))
        self.assertLess(launch.index("fresh_capacity(package,spec,'before-unit'"),launch.rindex("    result=run("))
        self.assertLess(build.index("write_new('capacity-before-build-original.json'"),build.index("result=subprocess.run(['docker','build'"))
        self.assertNotIn("buildx','prune",build)


class RuleAuthorityGuards(unittest.TestCase):
    def test_missing_or_changed_actual_rule_authority_refuses(self):
        for value in [{},{'authority-'+i+'-original.json':b'{}' for i in RULE_AUTHORITY_PINS}]:
            with self.assertRaises((RuntimeError,KeyError)):validate_rule_authorities(value)
    def test_tokens_pin_all_current_rules_and_no_db_removal(self):
        spec,index,review=fixture();tokens=review_tokens(index['head'],index)
        for i,pin in RULE_AUTHORITY_PINS.items():self.assertIn('authority'+i+'='+pin,tokens)
        self.assertIn('noProofDatabaseRemovalPendingYY=true',tokens)
    def test_recomputed_smaller_plan_cannot_match_exact_package_or_source(self):
        spec,index,review=fixture()
        app={'head':CANDIDATE,'tree':TREE,'entries':[{'path':'Dockerfile','mode':'100644','bytes':10}]}
        lengths={n:10 for n in REQUIRED_ARTIFACTS if n!='build-input.json'}
        validate_capacity_files(spec,app,lengths)
        lengths['source.tar.gz']+=1
        with self.assertRaises(RuntimeError):validate_capacity_files(spec,app,lengths)
        lengths['source.tar.gz']-=1;app['entries'][0]['bytes']=10**7
        with self.assertRaises(RuntimeError):validate_capacity_files(spec,app,lengths)


class WholeMeasurementGuards(unittest.TestCase):
    def test_prior_failed_180000_root_is_not_the_new_reviewed_root(self):
        with self.assertRaises(RuntimeError):safe_build_root('workflow-batch-build-be837974-20261015T180000Z')
        self.assertEqual(str(safe_build_root(FIRST_BUILD_ROOT_NAME)),'/opt/lims/releases/workflow-batch-build-be837974-20261015T190000Z')
    def test_only_exact_first_postbuild_numeric_snapshot_missing_directory_allows_another_complete_measurement(self):
        error="du: cannot access '/var/lib/containerd/io.containerd.snapshotter.v1.overlayfs/snapshots/12671': No such file or directory\n"
        self.assertEqual(missing_snapshot_measurement_paths('after',1,1,error),['/var/lib/containerd/io.containerd.snapshotter.v1.overlayfs/snapshots/12671'])
        for stage,attempt,code in [('before',1,1),('after',2,1),('after',1,0),('after',1,2),('after',True,1),('after',1,True)]:
            with self.subTest(stage=stage,attempt=attempt,code=code),self.assertRaises(RuntimeError):missing_snapshot_measurement_paths(stage,attempt,code,error)
    def test_foreign_nested_alias_malformed_permission_and_empty_errors_refuse(self):
        good="du: cannot access '/var/lib/containerd/io.containerd.snapshotter.v1.overlayfs/snapshots/12671': No such file or directory"
        for text in ['',good.replace('/12671','/12671/fs/file'),good.replace('/12671','/../12671'),good.replace('/12671','/name'),good.replace('/12671','/0'),good.replace('/var/lib/containerd/','/other/'),good.replace('No such file or directory','Permission denied'),good+'\n'+good,good+'\nunknown',good+'\n'*65536]:
            with self.subTest(error=text[:120]),self.assertRaises(RuntimeError):missing_snapshot_measurement_paths('after',1,1,text)
    def test_successful_measurement_requires_each_exact_nonduplicate_integer_row(self):
        rows={'/a':{'bytes':0},'/b':{'bytes':0}}
        value=parse_complete_allocation_rows('1\t/a\n2\t/b\n',{'/a','/b'},rows)
        self.assertEqual(value,{'/a':{'bytes':1},'/b':{'bytes':2}});self.assertEqual(rows['/a']['bytes'],0)
        for text in ['1\t/a\n','1\t/a\n2\t/a\n','1\t/a\n2\t/foreign\n','-1\t/a\n2\t/b\n','1.5\t/a\n2\t/b\n','01\t/a\n2\t/b\n','1\t/a\n2\t/b','1\t/a\textra\n2\t/b\n']:
            with self.subTest(text=text),self.assertRaises(RuntimeError):parse_complete_allocation_rows(text,{'/a','/b'},rows)
    def test_prior_failed_run_cannot_be_adopted_or_given_partial_totals(self):
        v={'status':'FAILED_OR_RESERVE_REFUSED_BUILD_ONLY_RETAIN_ALL','head':CANDIDATE,'exitCode':0,'error':'Physical measurement failed; no estimate or replay','diskGrowth':{'afterAllocations':None},'neverRetry':True}
        validate_prior_startup_failure(v)
        for key,value in [('status','PASS'),('head',PREDECESSOR),('error','ignored'),('diskGrowth',{'afterAllocations':{}}),('neverRetry',False)]:
            x=copy.deepcopy(v);x[key]=value
            with self.subTest(key=key),self.assertRaises(RuntimeError):validate_prior_startup_failure(x)

class ActualMeasurementExecutionGuards(unittest.TestCase):
    def run_measurement(self,responses,replace_missing=False,topology_change=False):
        import ast,datetime,subprocess,types
        raw=globals().get('SOURCE_RAW_FILES')
        if raw is None:
            here=pathlib.Path(__file__).resolve().parent;raw={n:(here/n).read_bytes() for n in SOURCE_FILES}
        node=next(n for n in ast.parse(raw['batch_build.py']).body if isinstance(n,ast.FunctionDef) and n.name=='allocated')
        state={'calls':[],'logs':{},'records':{},'sleep':[],'topology':[]}
        root=str(safe_build_root(FIRST_BUILD_ROOT_NAME));present={root,'/var/lib/docker/buildkit','/var/lib/containerd','/var/lib/containerd/io.containerd.snapshotter.v1.overlayfs/snapshots'}
        class Buffer(io.BytesIO):
            def __init__(self,path):super().__init__();self.path=path
            def close(self):state['logs'][self.path]=self.getvalue();super().close()
        class FakePath:
            def __init__(self,p):self.p=str(p)
            def __str__(self):return self.p
            def __hash__(self):return hash(self.p)
            def __eq__(self,v):return self.p==str(v)
            def __truediv__(self,n):return FakePath(self.p+'/'+n)
            @property
            def parent(self):return FakePath(str(pathlib.PurePosixPath(self.p).parent))
            def is_symlink(self):return False
            def exists(self):return self.p in present or (replace_missing and self.p.endswith('/12671'))
            def is_dir(self):return self.p in present
            def resolve(self):return self
            def read_text(self):return '23 1 253:1 / /var/lib/containerd rw - ext4 /dev/vda1 rw\n'
            def open(self,mode):
                if mode!='xb':raise AssertionError('Unexpected fixture open')
                return Buffer(self.p)
            def chmod(self,mode):self.assert_mode=mode
        def run(argv,**kw):
            self.assertEqual(argv,['du','-s','-B1','--',root,'/var/lib/docker/buildkit','/var/lib/containerd']);self.assertEqual(kw,{'capture_output':True,'timeout':120})
            state['calls'].append(argv);value=responses[len(state['calls'])-1]
            if isinstance(value,BaseException):raise value
            return types.SimpleNamespace(returncode=value[0],stdout=value[1],stderr=value[2])
        def topology(label):
            state['topology'].append(label)
            return {'same':not(topology_change and len(state['topology'])>1)}
        ns={k:v for k,v in globals().items() if not k.startswith('__')}
        ns.update(ROOT=FakePath(root),pathlib=types.SimpleNamespace(Path=FakePath),os=types.SimpleNamespace(stat=lambda p:types.SimpleNamespace(st_dev=1)),subprocess=types.SimpleNamespace(run=run,TimeoutExpired=subprocess.TimeoutExpired),datetime=datetime,time=types.SimpleNamespace(sleep=state['sleep'].append),write_new=lambda n,v:state['records'].__setitem__(n,v),topology=topology)
        exec(compile(ast.Module(body=[node],type_ignores=[]),'actual-reviewed-allocated-function','exec'),ns)
        try:state['result']=ns['allocated']('after')
        except BaseException as e:state['error']=e
        return state
    def output(self):
        return ('10\t'+str(safe_build_root(FIRST_BUILD_ROOT_NAME))+'\n20\t/var/lib/docker/buildkit\n30\t/var/lib/containerd\n').encode()
    def missing(self):return b"du: cannot access '/var/lib/containerd/io.containerd.snapshotter.v1.overlayfs/snapshots/12671': No such file or directory\n"
    def test_actual_success_executes_one_complete_measurement(self):
        s=self.run_measurement([(0,self.output(),b'')]);self.assertNotIn('error',s);self.assertEqual(len(s['calls']),1);self.assertEqual(s['records']['allocation-after-original.json']['acceptedCompleteAttempt'],1)
    def test_actual_exact_enoent_retains_first_output_then_accepts_only_second_complete_measurement(self):
        s=self.run_measurement([(1,b'999999\t/incomplete\n',self.missing()),(0,self.output(),b'')]);self.assertNotIn('error',s);self.assertEqual(len(s['calls']),2);self.assertEqual(s['sleep'],[2]);self.assertEqual(s['records']['allocation-after-original.json']['acceptedCompleteAttempt'],2);self.assertEqual(s['result']['/var/lib/containerd']['bytes'],30);self.assertIn(b'999999',s['logs'][str(safe_build_root(FIRST_BUILD_ROOT_NAME))+'/allocation-after-attempt-1-stdout.log'])
    def test_actual_repeated_missing_snapshot_stops_after_two_attempts(self):
        s=self.run_measurement([(1,b'',self.missing()),(1,b'',self.missing())]);self.assertIsInstance(s['error'],RuntimeError);self.assertEqual(len(s['calls']),2);self.assertNotIn('allocation-after-original.json',s['records'])
    def test_actual_permission_or_timeout_does_not_allow_additional_measurement(self):
        import subprocess
        for value in [(1,b'',b'Permission denied\n'),subprocess.TimeoutExpired(['du'],120,output=b'partial',stderr=b'')]:
            s=self.run_measurement([value]);self.assertIsInstance(s['error'],RuntimeError);self.assertEqual(len(s['calls']),1);self.assertNotIn('allocation-after-original.json',s['records'])
    def test_actual_missing_path_replacement_or_topology_change_stops_before_second_attempt(self):
        for flags in [{'replace_missing':True},{'topology_change':True}]:
            s=self.run_measurement([(1,b'',self.missing())],**flags);self.assertIsInstance(s['error'],RuntimeError);self.assertEqual(len(s['calls']),1)
    def test_actual_success_with_stderr_or_incomplete_rows_never_produces_accepted_record(self):
        for value in [(0,self.output(),b'warning\n'),(0,b'1\t/var/lib/containerd\n',b'')]:
            s=self.run_measurement([value]);self.assertIsInstance(s['error'],RuntimeError);self.assertEqual(len(s['calls']),1);self.assertNotIn('allocation-after-original.json',s['records']);self.assertFalse(s['records']['allocation-after-attempt-1-result.json']['accepted'])

if __name__=='__main__':unittest.main(verbosity=2)
