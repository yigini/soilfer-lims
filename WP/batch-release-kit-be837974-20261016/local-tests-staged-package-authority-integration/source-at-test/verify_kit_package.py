"""New retained LOCAL fixtures and Linux command stand-ins only; no host calls."""
import ast
import copy
import hashlib
import json
import os
import pathlib
import tempfile
import types
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
        'observedProcessCommandSha256':['e'*64]}
    consumer={'exactKitReviewPassed':True,'reviewedConsumerConfigurationSha256':inventory['configurationSha256'],
        'noHostConsumerActsOnUnhealthyWindow':True,'reviewedAllowedProcessCommandSha256':['e'*64],
        'reviewedAllowedActiveTimerNames':[]}
    files['consumer-inventory.json']=canonical(inventory)+b'\n';files['consumer-review.json']=canonical(consumer)+b'\n'
    files['ingress-original.conf']=b'# SYNTHETIC ORIGINAL\n';files['ingress-held.conf']=b'# SYNTHETIC HELD\n'
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
