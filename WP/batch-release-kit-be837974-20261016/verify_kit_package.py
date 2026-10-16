"""New retained LOCAL fixtures and Linux command stand-ins only; no host calls."""
import ast
import copy
import hashlib
import contextlib
import io
import json
import os
import pathlib
import tempfile
import types
import sys
import unittest
from unittest.mock import patch
from kit_contract import HEAD,TREE,IMAGE,BUILD_RECEIPT_SHA,PHASES,canonical,sha,whole_outage_disclosure
from retained_contract import ROOT,exact_json
from kit_frozen import REQUIRED_SOURCE,SOURCE_SCOPE,source_review,kit_review
from kit_package import (MAX_PACKAGE_FILES,REQUIRED_PAYLOAD,POST_MANIFEST_FILES,payload_map,allocation,
    freeze_manifest,validate_payload,verify_final,read_package,write_new_file)
from kit_science import scientific_projection
from kit_launch_programs import remote_programs,render,UNIT
from prepare_release import raw_git
from verify_kit_frozen import source_pass,review
from verify_kit_authority import synthetic_reviews,provider_fixture
import verify_kit_authority as authority_fixtures

HERE=pathlib.Path(__file__).resolve().parent
FIXTURES=HERE/'package-local-retained-fixtures'
BUILD=HERE.parent/'batch-build-stable-accounting-be837974-20261015'
OLD=HERE.parent/'batch-proof-forward-resume-cde8-20261015/first-proof-080000-closed-readiness-stop/remote-originals'
PAYLOAD=None


def package_fixture():
    global PAYLOAD
    if PAYLOAD is not None:return copy.deepcopy(PAYLOAD)
    files={};idx={'version':1,'scope':SOURCE_SCOPE,'root':str(ROOT),'head':HEAD,'tree':TREE,'image':IMAGE,
        'buildReceiptSha256':BUILD_RECEIPT_SHA,'sourceCommit':'b'*40,'files':{}}
    for name in sorted(REQUIRED_SOURCE):
        raw=('# SYNTHETIC LOCAL TOOLING ONLY '+name+'\n').encode()
        files['tooling/'+name]=raw
        idx['files'][name]={'sha256':sha(raw),'bytes':len(raw),
            'gitBlob':hashlib.sha1(('blob '+str(len(raw))+'\0').encode()+raw).hexdigest()}
    source=source_pass(idx)
    files['source-index.json']=canonical(idx)+b'\n';files['source-review.json']=canonical(source)+b'\n'
    disclosure=whole_outage_disclosure({name:{'kind':'REVIEWED_ALLOWANCE','seconds':1,
        'basis':'SYNTHETIC LOCAL TEST ONLY'} for name in PHASES})
    files['whole-outage-disclosure.json']=canonical(disclosure)+b'\n'
    chart=authority_fixtures.Science().chart();order=exact_json((OLD/'actual-order-impact.json').read_bytes())
    for issue,value in [('214',chart),('209',order)]:files['actual-impact-'+issue+'.json']=canonical(value)+b'\n'
    science={'version':1,'root':str(ROOT),'head':HEAD,'image':IMAGE,
        'context':'FRESH_REVIEWED_PRODUCTION_COPY_BEFORE_RELEASE_GATE','productionSqliteConnections':0,
        'captureSourceReviewId':source['id'],'capturedAt':'2026-10-16T11:00:20Z',
        'issues':{'206':scientific_projection('206',{'issue':'206','additiveEmptyTablesOnly':True}),
            '214':scientific_projection('214',chart),'209':scientific_projection('209',order)},
        'originalReferences':{issue:{'file':'actual-impact-'+issue+'.json',
            'sha256':sha(files['actual-impact-'+issue+'.json']),'bytes':len(files['actual-impact-'+issue+'.json'])}
            for issue in ('214','209')}}
    files['actual-scientific-impact.json']=canonical(science)+b'\n'
    files['capture-receipt.json']=canonical({'root':str(ROOT),'head':HEAD,'sourceReviewId':source['id'],
        'productionSqliteConnections':0,'scienceSha256':sha(canonical(science))})+b'\n'
    projection={'units':{'SYNTHETIC.service':{'definitionSha256':'d'*64}},'cron':{},'containers':{}}
    inventory={'configuration':projection,'configurationSha256':sha(canonical(projection)),
        'completeCollection':True,'readOnly':True,'activeTimerNames':[],
        'loadedAndTransientUnitsIncluded':True,'independentCompletePasses':2,
        'configurationEqualAcrossBothPasses':True,'cataloguesReenumeratedAfterEachPass':True,
        'observedProcessCommandSha256':['e'*64]}
    consumer={'exactKitReviewPassed':True,'reviewedConsumerConfigurationSha256':inventory['configurationSha256'],
        'noHostConsumerActsOnUnhealthyWindow':True,'reviewedAllowedProcessCommandSha256':['e'*64],
        'reviewedAllowedActiveTimerNames':[]}
    files['consumer-inventory.json']=canonical(inventory)+b'\n';files['consumer-review.json']=canonical(consumer)+b'\n'
    from verify_kit_apache_capture import original
    from kit_apache_capture import render_held,CONF
    files['ingress-original.conf']=original();files['ingress-held.conf'],rendering=render_held(original())
    # Pure synthetic metadata in a NEW LOCAL package fixture. No host capture.
    synthetic_stat={'st_dev':7,'st_ino':123,'st_size':len(original()),'st_mode':0o100644,'st_nlink':1,
        'st_uid':0,'st_gid':0,'st_mtime_ns':1000,'st_ctime_ns':1000,'allocatedBytes':4096}
    apache={'path':CONF,'head':HEAD,'captureSourceReviewId':source['id'],'sourceBinding':source_review(source,idx),
        'capturedAt':'2026-10-16T11:00:20Z','neverRetry':True,'before':synthetic_stat,'after':synthetic_stat,
        'extendedAttributesBase64':{},'extendedAttributesSha256':sha(canonical({})),
        'originalSha256':sha(files['ingress-original.conf']),'heldSha256':sha(files['ingress-held.conf']),
        'rendering':rendering,'sourceWrites':0,'certificateOrPrivateKeyFilesOpened':0,
        'configurationInstalled':False,'metadataCaptureNotGlobalFilesystemClosure':True}
    files['apache-capture.json']=canonical(apache)+b'\n'
    capture=exact_json(files['capture-receipt.json']);capture['apacheCaptureSha256']=sha(files['apache-capture.json'])
    files['capture-receipt.json']=canonical(capture)+b'\n'
    for target,source_path in [
        ('qualified-build-receipt.json',BUILD/'first-build-190000-closed-originals-once/build-receipt.json'),
        ('qualified-image-inspect-original.json',BUILD/'first-build-190000-closed-originals-once/image-inspect-original.json'),
        ('application-index.json',BUILD/'build-package-workflow-batch-build-be837974-20261015T190000Z/source-index.json')]:
        files[target]=source_path.read_bytes()
    from retained_app_copy import APP_PINS
    app=raw_git(HEAD,list(APP_PINS))
    files.update({'application/'+name:app[name][0] for name in APP_PINS})
    manifest=freeze_manifest(files,idx,source,4800)
    names=('consumerConfigurationSha256','originalIngressSha256','heldIngressSha256',
        'wholeOutageDisclosureSha256','actualScientificImpactSha256','packageFilesSha256')
    body='Exact-kit review: PASS\n'+'\n'.join([SOURCE_SCOPE,'manifestSha256='+sha(canonical(manifest)),
        str(ROOT),HEAD,IMAGE,'sourceReviewId='+str(source['id']),'noHostConsumerActsOnUnhealthyWindow=true',
        'freshYYWholeOutageIntakeAndWorkloadGateRequired=true',*[manifest[name] for name in names]])
    kit=review(body,source['id']+1,'2026-10-16T11:01:00Z')
    _,_,_,_,human,confirmation,_,_=synthetic_reviews()
    old_manifest=confirmation['manifestSha256'];confirmation['manifestSha256']=sha(canonical(manifest))
    confirmation['outageDisclosureSha256']=sha(canonical(disclosure));human['body']=human['body'].replace(old_manifest,sha(canonical(manifest)))
    final={**files,'frozen-manifest.json':canonical(manifest)+b'\n','exact-kit-review.json':canonical(kit)+b'\n',
        'yy-confirmation.json':canonical(confirmation)+b'\n','yy-comment-original.json':canonical(human)+b'\n'}
    PAYLOAD=(files,idx,source,manifest,kit,human,confirmation,final)
    return copy.deepcopy(PAYLOAD)


class Package(unittest.TestCase):
    def test_many_directory_entries_receive_allocation_beyond_constant_directory_overhead(self):
        one={'dense/one':{'sha256':'a'*64,'bytes':1}}
        many={'dense/name-'+str(i):{'sha256':'a'*64,'bytes':1} for i in range(100)}
        # The extra99 children reserve both their file blocks and their
        # directory-entry blocks; a constant two-block directory is inadequate.
        self.assertGreaterEqual(allocation(many)-allocation(one),99*8192)

    def test_full_actual_app_and_build_bindings_validate_in_synthetic_future_package(self):
        files,idx,source,manifest,kit,human,confirmation,final=package_fixture()
        self.assertGreater(len(files),512)
        validate_payload(files,manifest,idx,source)
        checked=verify_final(final,confirmation['createdEpoch']+1)
        self.assertEqual(checked['filePins'],{n:{'sha256':sha(r),'bytes':len(r)} for n,r in final.items()})
        self.assertEqual(set(final)-set(files),POST_MANIFEST_FILES)
        self.assertGreater(checked['futurePackageAllocationBytes'],sum(len(raw) for raw in final.values()))

    def test_manifest_hash_cycle_and_expanded_payload_are_refused(self):
        files,idx,source,manifest,*_=package_fixture()
        for name in POST_MANIFEST_FILES:
            with self.subTest(name=name),self.assertRaises(RuntimeError):payload_map({**files,name:b'{}'})
        for name in ('../escape','tooling/../escape','/absolute','tooling//empty','foreign-private-key'):
            changed={**files,name:b'SYNTHETIC'}
            with self.subTest(name=name),self.assertRaises(RuntimeError):freeze_manifest(changed,idx,source,4800)

    def test_source_impact_ingress_consumer_and_application_tampering_each_refuse(self):
        files,idx,source,manifest,*_=package_fixture()
        for name in ('tooling/kit_sequence.py','actual-impact-214.json','consumer-inventory.json',
                     'qualified-build-receipt.json','application/server/index.js'):
            changed=dict(files);changed[name]+=b'\nSYNTHETIC_CHANGE'
            with self.subTest(name=name),self.assertRaises((RuntimeError,ValueError,KeyError)):
                validate_payload(changed,manifest,idx,source)
        changed=dict(files);changed['ingress-held.conf']=files['ingress-original.conf']
        with self.assertRaises(RuntimeError):freeze_manifest(changed,idx,source,4800)

    def test_no_late_record_can_rewrite_manifest_or_refresh_expired_human(self):
        files,idx,source,manifest,kit,human,confirmation,final=package_fixture()
        for mode in ('manifest','kit','human','extra','expired'):
            changed=dict(final);now=confirmation['createdEpoch']+1
            if mode=='manifest':
                value=copy.deepcopy(manifest);value['wholeOutageSeconds']=4799;changed['frozen-manifest.json']=canonical(value)
            elif mode in ('kit','human'):
                name='exact-kit-review.json' if mode=='kit' else 'yy-comment-original.json'
                value=exact_json(changed[name]);value['body']+='\nSYNTHETIC_EDIT';value['updated_at']='2026-10-16T11:03:00Z';changed[name]=canonical(value)
            elif mode=='extra':changed['unexpected.json']=b'{}'
            else:now=confirmation['createdEpoch']+601
            with self.subTest(mode=mode),self.assertRaises(RuntimeError):verify_final(changed,now)

    def test_apache_capture_requires_this_source_fresh_time_full_metadata_and_exact_rendered_bytes(self):
        files,idx,source,*_=package_fixture()
        original=exact_json(files['apache-capture.json'])
        for mode in ('missing','source','before-source','path','identity','links','attribute-hash',
                     'invalid-base64','rendering','source-write','held-hash','receipt-binding'):
            changed=dict(files);value=copy.deepcopy(original)
            if mode=='missing':del changed['apache-capture.json']
            elif mode=='source':value['captureSourceReviewId']+=1
            elif mode=='before-source':value['capturedAt']='2026-10-15T01:00:00Z'
            elif mode=='path':value['path']='/etc/httpd/other.conf'
            elif mode=='identity':value['after']['st_ino']+=1
            elif mode=='links':value['before']['st_nlink']=value['after']['st_nlink']=2
            elif mode=='attribute-hash':value['extendedAttributesSha256']='a'*64
            elif mode=='invalid-base64':value['extendedAttributesBase64']={'user.local':'***'}
            elif mode=='rendering':value['rendering']['insertedDirectiveCount']=1
            elif mode=='source-write':value['sourceWrites']=False
            elif mode=='held-hash':value['heldSha256']='a'*64
            else:
                capture=exact_json(changed['capture-receipt.json']);capture['apacheCaptureSha256']='a'*64
                changed['capture-receipt.json']=canonical(capture)
            if mode!='missing':changed['apache-capture.json']=canonical(value)+b'\n'
            # Refresh the ordinary file hash so semantic checks, not a stale
            # generic package pin, must catch each false capture assertion.
            if mode not in ('missing','receipt-binding'):
                capture=exact_json(changed['capture-receipt.json']);capture['apacheCaptureSha256']=sha(changed['apache-capture.json'])
                changed['capture-receipt.json']=canonical(capture)
            with self.subTest(mode=mode),self.assertRaises((RuntimeError,ValueError)):
                freeze_manifest(changed,idx,source,4800)

    def test_independent_files_exclusive_writes_and_link_refusal_use_real_local_files(self):
        FIXTURES.mkdir(exist_ok=True);root=pathlib.Path(tempfile.mkdtemp(prefix='owned-',dir=FIXTURES)).resolve()
        write_new_file(root,'tooling/test.py',b'# SYNTHETIC\n',False)
        with self.assertRaises(FileExistsError):write_new_file(root,'tooling/test.py',b'# REPLACEMENT\n',False)
        self.assertEqual(read_package(root,require_posix_permissions=False),{'tooling/test.py':b'# SYNTHETIC\n'})
        os.link(root/'tooling/test.py',root/'linked.py')
        with self.assertRaises(RuntimeError):read_package(root,require_posix_permissions=False)

    def test_all_remote_programs_compile_and_exact_unit_has_nonignored_independent_hook(self):
        *_,confirmation,final=package_fixture();checked=verify_final(final,confirmation['createdEpoch']+1)
        programs=remote_programs(checked['filePins'])
        self.assertEqual(set(programs),{'beforeRoot','create','beforeUnit','unit'})
        for name,raw in programs.items():compile(raw,name,'exec');self.assertLess(len(raw),1024**2)
        tree=ast.parse(programs['unit']);literals={n.value for n in ast.walk(tree) if isinstance(n,ast.Constant) and isinstance(n.value,str)}
        for flag in ('--property=RuntimeMaxSec=5400','--property=MemoryMax=805306368',
                     '--property=MemorySwapMax=0','--property=Restart=no','--property=TimeoutStopSec=300'):
            self.assertIn(flag,literals)
        self.assertIn('--property=ExecStopPost=/usr/bin/python3 -B ',literals)
        self.assertNotIn('--property=ExecStopPost=-/usr/bin/python3',literals)
        self.assertIn('tooling/stop_post.py',literals)
        self.assertEqual(programs['beforeRoot'].count(b'FUTURE_PACKAGE_VALUE'),0)
        with self.assertRaises(RuntimeError):render('x=MISSING_VALUE',{})
        code=render('result=BOUND_VALUE',{'BOUND_VALUE':'literal\n"; raise RuntimeError("INJECTION")'})
        values={};exec(code,values);self.assertTrue(values['result'].startswith('literal'))

    def test_provider_source_snapshot_requires_no_nonexistent_kit_or_human(self):
        runner,data=provider_fixture()
        # No later actual Claude direction exists in this synthetic interval.
        runner.records['issues/162/comments?per_page=100']=[[data[1]]]
        from kit_provider import GitHubProvider
        from kit_authority import standing_authority,no_later_release_direction
        value=GitHubProvider(runner,'synthetic-source').source_snapshot(data[1]['id'])
        standing_authority(value);no_later_release_direction(value['releaseComments'],data[1],data[1])
        self.assertNotIn('kit',value);self.assertNotIn('human',value)

    def test_local_primary_transport_uses_existing_gh_auth_without_credential_arguments(self):
        calls=[]
        class Local:
            def run(self,argv,label,timeout):calls.append(argv);return b'{"number":191,"state":"closed"}',b'',{}
        from kit_provider import GitHubProvider
        provider=GitHubProvider(Local(),'synthetic-local',transport='gh')
        self.assertEqual(provider.get('issues/191')['state'],'closed')
        self.assertEqual(calls[0][:7],['gh','api','--hostname','github.com','--method','GET','--header'])
        self.assertEqual(calls[0][-1],'repos/yigini/soilfer-lims/issues/191')
        self.assertFalse(any('Authorization' in entry or 'token' in entry.lower() for entry in calls[0]))
        with self.assertRaises(RuntimeError):provider.get('https://foreign.invalid')
        self.assertEqual(len(calls),1)

    def test_single_host_snapshot_and_immediate_refresh_fit_one_bounded_request_inventory(self):
        runner,data=provider_fixture()
        from kit_provider import GitHubProvider
        provider=GitHubProvider(runner,'synthetic-host')
        provider.snapshot(data[1]['id'],data[3]['id'],data[4]['id'])
        provider.gate_refresh(data[1],data[3],data[4])
        self.assertLess(len(runner.calls),60)

    def test_actual_rendered_unit_program_verifies_real_files_before_standin_dispatch(self):
        *_,confirmation,final=package_fixture();checked=verify_final(final,confirmation['createdEpoch']+1)
        FIXTURES.mkdir(exist_ok=True);root=pathlib.Path(tempfile.mkdtemp(prefix='owned-unit-',dir=FIXTURES)).resolve()
        for name,raw in final.items():write_new_file(root,name,raw,False)
        code=remote_programs(checked['filePins'])['unit'];calls=[]
        def run(argv,**kwargs):
            calls.append(argv)
            return types.SimpleNamespace(returncode=0,stdout=b'not-found\n' if argv[0]=='systemctl' else b'LOCAL STANDIN',stderr=b'')
        fake_pathlib=types.SimpleNamespace(Path=lambda value:root)
        def execute():
            # LOCAL kernel/directory-fsync/platform boundaries only. The actual
            # rendered upload inventory, hashes, syntax checks, final manifest
            # and actual-provider-record shape checks still execute.
            with patch.dict('sys.modules',{'pathlib':fake_pathlib,'subprocess':types.SimpleNamespace(run=run),
                    'time':types.SimpleNamespace(time=lambda:confirmation['createdEpoch']+1)}),\
                 patch('os.name','posix'),patch.object(os,'O_DIRECTORY',0,create=True),\
                 patch('os.open',return_value=123),patch('os.fsync'),patch('os.close'),\
                 patch('kit_package.read_package',return_value=final),patch('sys.path',list(sys.path)),\
                 contextlib.redirect_stdout(io.StringIO()):
                exec(code,{})
        execute();self.assertEqual(len(calls),2)
        self.assertEqual(calls[1][-5:],['/usr/bin/python3','-B',str(root/'tooling/run_release.py'),'--root',str(root)])
        self.assertIn('--property=ExecStopPost=/usr/bin/python3 -B '+str(root/'tooling/stop_post.py'),calls[1])
        (root/'unreviewed-empty-directory').mkdir()
        with self.assertRaises(RuntimeError):execute()
        self.assertEqual(len(calls),2)

    def test_capacity_program_reuses_exact_reader_and_budget_ast_not_a_rough_multiplier(self):
        *_,confirmation,final=package_fixture();checked=verify_final(final,confirmation['createdEpoch']+1)
        programs=remote_programs(checked['filePins']);tree=ast.parse(programs['beforeRoot'])
        bodies={n.name:ast.dump(n,include_attributes=False) for n in tree.body if isinstance(n,(ast.FunctionDef,ast.ClassDef))}
        for filename,names in [('kit_budget.py',['Budget']),('kit_disk.py',['hardware','free_gate','measure_inputs']),
                               ('kit_contract.py',['disk_required'])]:
            original=ast.parse((HERE/filename).read_bytes())
            for node in original.body:
                if isinstance(node,(ast.FunctionDef,ast.ClassDef)) and node.name in names:
                    self.assertEqual(bodies[node.name],ast.dump(node,include_attributes=False))

    def authority_fixture(self):
        files,idx,source,manifest,kit,human,confirmation,final=package_fixture()
        FIXTURES.mkdir(exist_ok=True);root=pathlib.Path(tempfile.mkdtemp(prefix='owned-authority-',dir=FIXTURES)).resolve()
        for name,raw in final.items():write_new_file(root,name,raw,False)
        runner,_=provider_fixture()
        for value in (source,kit,human):runner.records['issues/comments/'+str(value['id'])]=value
        runner.records['issues/162/comments?per_page=100']=[[source,kit,human]]
        from kit_provider import GitHubProvider
        from kit_authority import Authority,reviewed_plan
        current={'ingress':files['ingress-original.conf']}
        inventory=exact_json(files['consumer-inventory.json'])
        with patch('kit_authority.ROOT',root):
            authority=Authority(root,GitHubProvider(runner,'synthetic-integration'),manifest,idx,source,kit,
                confirmation,exact_json(files['whole-outage-disclosure.json']),lambda label:inventory,
                lambda:current['ingress'],lambda:exact_json(files['qualified-image-inspect-original.json'])[0],
                clock=lambda:confirmation['createdEpoch']+1,require_directory_sync=False)
        plan=reviewed_plan(manifest,exact_json(files['whole-outage-disclosure.json']),kit_review(kit,manifest,idx,source))
        return root,authority,runner,plan,current

    def test_full_frozen_authority_preflight_and_exclusive_consumption_with_real_local_files(self):
        root,authority,runner,plan,current=self.authority_fixture()
        # Only the Windows permission projection is adapted. All full package
        # hashes, independent source blobs, actual standing predicates, full
        # scientific lists and fresh provider checks execute unchanged.
        with patch('kit_stop_lifecycle.stat.S_IMODE',return_value=0o400):
            result=authority.preflight(plan)
            self.assertEqual(result['sourceReviewId'],7000000000)
            authority.consume_gate()
        consumed=exact_json((root/'production-gate-consumed.json').read_bytes())
        self.assertTrue(consumed['exclusive']);self.assertEqual(consumed['humanCommentId'],7000000002)
        count=len(runner.calls)
        with self.assertRaises(RuntimeError):authority.consume_gate()
        self.assertEqual(len(runner.calls),count)

    def test_changed_apache_after_real_preflight_consumes_attempt_without_gate(self):
        root,authority,runner,plan,current=self.authority_fixture()
        with patch('kit_stop_lifecycle.stat.S_IMODE',return_value=0o400):
            authority.preflight(plan);current['ingress']=b'SYNTHETIC_CHANGED_AFTER_PREFLIGHT'
            with self.assertRaises(RuntimeError):authority.consume_gate()
        self.assertFalse((root/'production-gate-consumed.json').exists())
        self.assertTrue(authority.consumed)
        count=len(runner.calls)
        with self.assertRaises(RuntimeError):authority.consume_gate()
        self.assertEqual(len(runner.calls),count)


if __name__=='__main__':unittest.main()
