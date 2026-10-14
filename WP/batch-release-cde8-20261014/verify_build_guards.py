"""Isolated refusal tests for build authority and archive boundaries; no network/Docker."""
import copy,hashlib,io,tarfile,unittest
from batch_build_contract import *

def fixture():
    index={'head':'a'*40,'files':{n:{'bytes':10,'blob':'b'*40,'sha256':'c'*64} for n in SOURCE_FILES}}
    review={'id':6179000001,'html_url':'https://github.com/yigini/soilfer-lims/issues/162#issuecomment-6179000001',
        'performed_via_github_app':{'slug':'claude'},'created_at':'2026-10-14T21:40:00Z','updated_at':'2026-10-14T21:40:00Z',
        'body':'Source review: PASS\n'+'\n'.join(review_tokens(index['head'],index))}
    spec={'status':'PREPARED_BATCH_BUILD_ONLY_NOT_LAUNCHED','head':CANDIDATE,'tree':TREE,'scope':SCOPE,'rootName':FIRST_BUILD_ROOT_NAME,
        'audits':copy.deepcopy(AUDITS),'mainCiRun':MAIN_CI,'labAndHubBuildsOwnedByYY':True,'releaseWindowControl':'RELEASE_DAY_DISK_ABORTS_ACCEPTED',
        'productionDatabaseMounts':0,'productionDatabaseConnections':0,'proofLaunches':0,'productionDeployments':0,
        'toolingCommit':index['head'],'toolingSourceIndexSha256':sha(canonical(index)),'sourceReviewId':review['id'],'sourceReviewRawSha256':sha(canonical(review)),
        'reserveFloorBytes':FLOOR,'buildAllocationReserveBytes':BUILD_ALLOCATION,'buildTimeoutSeconds':BUILD_TIMEOUT,
        'buildUnitTimeoutSeconds':UNIT_TIMEOUT,'unexplainedGrowthAbortBytes':UNEXPLAINED_GROWTH_ABORT,'diskGrowthPolicy':GROWTH_POLICY}
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
                elif kind=='edited':review['updated_at']='2026-10-14T21:41:00Z'
                elif kind=='actor':review['performed_via_github_app']['slug']='other'
                elif kind=='missing-token':review['body']=review['body'].replace('batch_build.py='+'c'*64,'')
                elif kind=='failed':review['body']=review['body'].replace('Source review: PASS','Source review: FAILED')
                else:review['html_url']='https://github.com/yigini/soilfer-lims/issues/209#issuecomment-6179000001'
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
        later=copy.deepcopy(comments);later['297']=[{'created_at':'2026-10-14T21:41:00Z','body':'Audit failed: current head'}]
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
        no_later_source_failure([{'created_at':'2026-10-14T21:41:00Z','body':'Audit failed on a historical unrelated source'}],review,index['head'])
        for text in ['Source review: FAILED','Source review: changes required','Audit failed']:
            with self.subTest(text=text),self.assertRaises(RuntimeError):
                no_later_source_failure([{'created_at':'2026-10-14T21:41:00Z','body':text+' '+index['head']}],review,index['head'])
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
if __name__=='__main__':unittest.main(verbosity=2)
