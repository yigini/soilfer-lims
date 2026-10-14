"""Meaningful source, authority, command, reference and interface refusal tests; no network or CLI execution."""
import copy,unittest
from forward_metadata_contract import *
class MetadataGuards(unittest.TestCase):
    def test_read_interfaces_allow_only_bounded_metadata_families(self):
        for a in [['docker','image','inspect',IMAGE],['docker','info','--format','{{.Driver}}'],['docker','buildx','du','--format','json'],['ctr','--address',SOCKET,'namespaces','list'],['ctr','--address',SOCKET,'--namespace','moby','content','get',IMAGE],['ctr','--address',SOCKET,'--namespace','moby','snapshots','--snapshotter','overlayfs','info','sha256:abc'],['ctr','--address',SOCKET,'--namespace','buildkit','snapshots','--snapshotter','overlayfs','usage','owned-snapshot']]:self.assertTrue(allowed_command(a))
    def test_mutations_filesystem_du_and_wrong_images_are_refused(self):
        for a in [['docker','build','.'],['docker','image','inspect','sha256:'+'a'*64],['docker','run',IMAGE],['docker','pull',IMAGE],['docker','image','tag',IMAGE,'new'],['docker','image','save',IMAGE],['docker','image','load'],['docker','system','prune'],['du','-s','/var/lib/containerd'],['ctr','--address',SOCKET,'--namespace','moby','content','delete',IMAGE],['ctr','--address',SOCKET,'--namespace','moby','snapshots','--snapshotter','overlayfs','view','created'],['ctr','--address','/other.sock','namespaces','list']]:
            with self.subTest(a=a),self.assertRaises(RuntimeError):allowed_command(a)
    def test_option_injection_unknown_namespace_and_digest_shapes_refuse(self):
        for key in ['--help','a;rm','a\nother','',False,'a'*252]:
            with self.subTest(key=key),self.assertRaises(RuntimeError):safe_key(key)
        for a in [['ctr','--address',SOCKET,'--namespace','unknown','content','list'],['ctr','--address',SOCKET,'--namespace','moby','content','get','sha256:abc']]:
            with self.assertRaises(RuntimeError):allowed_command(a)
    def test_real_unit_created_empty_outputs_are_accepted_consumed_and_aliases_refuse(self):
        rows={n:{'regular':True,'symlink':False,'bytes':1,'mode':0o400} for n in REQUIRED}
        rows.update({n:{'regular':True,'symlink':False,'bytes':0,'mode':0o600} for n in UNIT_LOGS});initial_inventory(rows)
        for change in [('unit-stdout-original.log','bytes',1),('candidate-image.id','symlink',True),('metadata-input.json','mode',0o600),('unit-stderr-original.log','mode',0o666)]:
            v=copy.deepcopy(rows);v[change[0]][change[1]]=change[2]
            with self.assertRaises(RuntimeError):initial_inventory(v)
        v=copy.deepcopy(rows);v['metadata-intent.json']={'regular':True,'symlink':False,'bytes':100,'mode':0o400}
        with self.assertRaises(RuntimeError):initial_inventory(v)
    def test_exact_first_new_root_is_bound_and_failed_root_or_aliases_refuse(self):
        self.assertEqual(str(safe_root(ROOT_NAME)),'/opt/lims/releases/'+ROOT_NAME)
        for v in [OLD_ROOT,'workflow-batch-forward-metadata-cde8c889-20261014T233000Z',ROOT_NAME+'-retry','../'+ROOT_NAME,ROOT_NAME.replace('000500','001000')]:
            with self.assertRaises(RuntimeError):safe_root(v)
    def test_exported_manifest_id_and_config_reference_mismatches_stop(self):
        self.assertEqual(exported_image('#71 exporting manifest list '+IMAGE+' done\n'),IMAGE)
        for value in ['#71 exporting config '+IMAGE+' done','unrelated '+IMAGE,'#71 exporting manifest list sha256:'+'a'*64+' done']:
            with self.assertRaises(RuntimeError):exported_image(value)
        ref={'Id':IMAGE,'Architecture':'amd64','Os':'linux','RootFS':{'Layers':['sha256:base']},'Config':{'Labels':{'org.opencontainers.image.revision':CANDIDATE},'Env':['A=B'],'Entrypoint':['/app/docker-entrypoint.sh'],'Cmd':['npm','start'],'User':'','WorkingDir':'/app/server'}}
        compare_image(ref,copy.deepcopy(ref))
        for k,value in [('Id','sha256:'+'b'*64),('RootFS',{'Layers':[]}),('Config',{'Env':[]}),('Architecture','arm64')]:
            v=copy.deepcopy(ref);v[k]=value
            with self.assertRaises(RuntimeError):compare_image(ref,v)
    def test_metadata_evidence_cannot_grant_image_or_production_authority(self):
        row={'imageEligibility':False,'imageAdoptionReceipts':0,'proofLaunches':0,'productionDeployments':0};evidence_only(row)
        for k,v in [('imageEligibility',True),('imageAdoptionReceipts',1),('proofLaunches',1),('productionDeployments',1)]:
            changed=dict(row);changed[k]=v
            with self.assertRaises(RuntimeError):evidence_only(changed)
    def test_oci_configuration_payload_is_not_mistaken_for_descriptor(self):
        config={'architecture':'amd64','config':{'Env':['NODE_ENV=production'],'Cmd':['npm','start']},'rootfs':{'type':'layers','diff_ids':['sha256:base']}}
        self.assertEqual(oci_children(config),[])
        self.assertEqual(oci_children({'config':{'digest':IMAGE,'size':7229}}),[IMAGE])
        for v in [{'config':{'digest':IMAGE,'size':MAX_OUTPUT+1}},{'config':{'digest':'sha256:bad','size':1}},{'config':{'digest':IMAGE,'size':True}}]:
            with self.assertRaises(RuntimeError):oci_children(v)
    def test_oci_platform_selection_preserves_only_owned_runtime_metadata(self):
        obj={'manifests':[{'digest':IMAGE,'platform':{'os':'linux','architecture':'amd64'}},{'digest':'sha256:'+'a'*64,'platform':{'os':'linux','architecture':'arm64'}},{'digest':'sha256:'+'b'*64,'platform':{'os':'unknown','architecture':'unknown'}}]}
        self.assertEqual(oci_children(obj),[IMAGE])
        with self.assertRaises(RuntimeError):oci_children({'manifests':{}})
    def test_snapshot_catalog_is_complete_or_refuses_without_truncation(self):
        self.assertEqual(snapshot_keys('KEY PARENT KIND\nsha256:abc  Committed\nowned-snap sha256:abc Active\n'),['sha256:abc','owned-snap'])
        for text in ['NAME SIZE\nsnapshot 1','KEY KIND\na Committed\na Active','KEY KIND\n'+'\n'.join('n'+str(i)+' Committed' for i in range(81)),'KEY KIND\n--help Committed']:
            with self.assertRaises(RuntimeError):snapshot_keys(text)
    def test_old_or_edited_wrong_actor_or_incomplete_source_review_refuses(self):
        index={'head':'a'*40,'files':{n:{'bytes':1,'blob':'b'*40,'sha256':'c'*64} for n in SOURCE_FILES}}
        v={'id':6181000000,'html_url':'https://github.com/yigini/soilfer-lims/issues/162#issuecomment-6181000000','performed_via_github_app':{'slug':'claude'},'created_at':'2026-10-14T23:20:00Z','updated_at':'2026-10-14T23:20:00Z','body':'Source review: PASS\n'+'\n'.join(tokens(index))};source_review(v,index)
        for field,value in [('id',6179940139),('updated_at','2026-10-14T23:21:00Z'),('performed_via_github_app',{'slug':'other'}),('body','Source review: PASS\n'+IMAGE)]:
            bad=copy.deepcopy(v);bad[field]=value
            with self.assertRaises(RuntimeError):source_review(bad,index)
        for field,value in [('head','short'),('files',{})]:
            bad=copy.deepcopy(index);bad[field]=value
            with self.assertRaises(RuntimeError):graph(bad)
    def test_duplicate_json_and_expanded_reference_roles_refuse(self):
        with self.assertRaises(RuntimeError):exact_json('{"imageEligibility":false,"imageEligibility":true}')
        with self.assertRaises(RuntimeError):exact_json('{"bytes":NaN}')
        scope={'id':6180234041,'performed_via_github_app':{'slug':'claude'},'created_at':'2026-10-14T22:49:57Z','updated_at':'2026-10-14T22:49:57Z','body':'This is direction only. 3,609,116,672'}
        ref={'id':6180335648,'performed_via_github_app':{'slug':'claude'},'created_at':'2026-10-14T22:57:41Z','updated_at':'2026-10-14T22:57:41Z','body':'This is still direction only. candidate-image-fresh-inspect-original.json'};directions(scope,ref)
        bad=copy.deepcopy(ref);bad['body']='Source review: PASS'
        with self.assertRaises(RuntimeError):directions(scope,bad)
    def authority_fixture(self):
        index={'head':'a'*40,'files':{n:{'bytes':1,'blob':'b'*40,'sha256':'c'*64} for n in SOURCE_FILES}}
        review={'id':6181000000,'html_url':'https://github.com/yigini/soilfer-lims/issues/162#issuecomment-6181000000','performed_via_github_app':{'slug':'claude'},'created_at':'2026-10-14T23:20:00Z','updated_at':'2026-10-14T23:20:00Z','body':'Source review: PASS\n'+'\n'.join(tokens(index))}
        scope={'id':6180234041,'performed_via_github_app':{'slug':'claude'},'created_at':'2026-10-14T22:49:57Z','updated_at':'2026-10-14T22:49:57Z','body':'This is direction only. 3,609,116,672'}
        ref={'id':6180335648,'performed_via_github_app':{'slug':'claude'},'created_at':'2026-10-14T22:57:41Z','updated_at':'2026-10-14T22:57:41Z','body':'This is still direction only. candidate-image-fresh-inspect-original.json'}
        spec={'status':'PREPARED_READONLY_METADATA_NOT_LAUNCHED','scope':SCOPE,'candidate':CANDIDATE,'tree':TREE,'image':IMAGE,'rootName':ROOT_NAME,'toolingCommit':index['head'],'toolingIndexSha256':sha(canonical(index)),'sourceReviewId':review['id'],'sourceReviewSha256':sha(canonical(review)),'scopeDirectionSha256':sha(canonical(scope)),'referenceDirectionSha256':sha(canonical(ref)),'originalRefs':REFS,'originalFailedRoot':OLD_ROOT,'originalInspectAbsent':True,'imageEligibility':False,'imageAdoptionReceipts':0,'newBuilds':0,'retags':0,'containerStarts':0,'databaseConnections':0,'volumeMounts':0,'filesystemDuCalls':0,'labAndHubBuildsOwnedByYY':True,'releaseWindowControl':'RELEASE_DAY_DISK_ABORTS_ACCEPTED'}
        return spec,index,review,scope,ref
    def test_metadata_spec_passes_only_same_graph_and_explicitly_distinct_reference_roles(self):
        values=self.authority_fixture();validate_spec(*values)
        for k,v in [('candidate','different'),('scope','ADOPT_IMAGE'),('originalInspectAbsent',False),('originalFailedRoot',str(safe_root(ROOT_NAME))),('toolingIndexSha256','f'*64),('sourceReviewId',6179940139),('originalRefs',{'image-inspect-original.json':REFS['candidate-image-fresh-inspect-original.json']})]:
            spec=copy.deepcopy(values[0]);spec[k]=v
            with self.subTest(k=k),self.assertRaises(RuntimeError):validate_spec(spec,*values[1:])
    def test_spec_and_evidence_cannot_expand_zero_operations_or_accept_boolean_counts(self):
        values=self.authority_fixture()
        for k,v in [('imageEligibility',True),('imageAdoptionReceipts',1),('newBuilds',1),('retags',1),('containerStarts',1),('databaseConnections',1),('volumeMounts',1),('filesystemDuCalls',1),('newBuilds',False),('labAndHubBuildsOwnedByYY',False)]:
            spec=copy.deepcopy(values[0]);spec[k]=v
            with self.subTest(k=k),self.assertRaises(RuntimeError):validate_spec(spec,*values[1:])
        with self.assertRaises(RuntimeError):evidence_only({'imageEligibility':False,'imageAdoptionReceipts':False,'proofLaunches':0,'productionDeployments':0})
    def chain_fixture(self,count=3):
        layers=['sha256:'+('%064x'%(i+1)) for i in range(count)];rows=[];parent=None;keys=[]
        for diff in layers:
            key=diff if parent is None else 'sha256:'+hashlib.sha256((parent+' '+diff).encode()).hexdigest()
            rows.append(key+' '+(parent+' ' if parent else '')+'Committed');keys.append(key);parent=key
        return layers,keys,rows
    def test_large_complete_catalogue_selects_only_exact_candidate_chain_without_truncation(self):
        layers,keys,rows=self.chain_fixture()
        rows=['unrelated'+str(i)+' Active' for i in range(1526)]+rows
        self.assertEqual(selected_snapshot_keys('KEY PARENT KIND\n'+'\n'.join(rows),layers),keys)
    def test_chain_selection_refuses_missing_duplicate_wrong_parent_or_active_target(self):
        layers,keys,rows=self.chain_fixture()
        bad=[rows[:-1],rows+[rows[0]],[rows[0],keys[1]+' wrong-parent Committed',rows[2]],[rows[0].replace('Committed','Active')]+rows[1:]]
        for values in bad:
            with self.assertRaises(RuntimeError):selected_snapshot_keys('KEY PARENT KIND\n'+'\n'.join(values),layers)
    def test_chain_selection_refuses_malformed_keys_kinds_and_runtime_layer_digest(self):
        layers,keys,rows=self.chain_fixture()
        for extra in ['--bad Active','good Unknown','too many fields Active']:
            with self.assertRaises(RuntimeError):selected_snapshot_keys('KEY PARENT KIND\n'+'\n'.join(rows+[extra]),layers)
        with self.assertRaises(RuntimeError):selected_snapshot_keys('KEY PARENT KIND\n'+'\n'.join(rows),['sha256:short'])
    def test_candidate_chain_bound_is_not_expanded_by_large_catalogue(self):
        layers,keys,rows=self.chain_fixture(81)
        with self.assertRaises(RuntimeError):selected_snapshot_keys('KEY PARENT KIND\n'+'\n'.join(rows),layers)
if __name__=='__main__':unittest.main(verbosity=2)
