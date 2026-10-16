"""Synthetic authority records only; no actual PASS/gate is created or claimed."""
import copy
import json
import pathlib
import tempfile
import unittest
from kit_contract import HEAD,TREE,IMAGE,BUILD_RECEIPT_SHA,canonical,sha,POSTFLIGHT_POLICY
from retained_contract import ROOT
from kit_frozen import (REQUIRED_SOURCE,SOURCE_SCOPE,source_index,source_review,kit_review,
    frozen_source_bytes,consume_gate)

HERE=pathlib.Path(__file__).resolve().parent
FIXTURES=HERE/'frozen-local-retained-fixtures'

def index():
    return {'version':1,'scope':SOURCE_SCOPE,'root':str(ROOT),'head':HEAD,'tree':TREE,'image':IMAGE,
        'buildReceiptSha256':BUILD_RECEIPT_SHA,'sourceCommit':'b'*40,
        'files':{name:{'sha256':sha(name.encode()),'bytes':len(name),'gitBlob':'c'*40} for name in REQUIRED_SOURCE}}

def review(body,identity=7000000000,stamp='2026-10-16T11:00:00Z'):
    return {'id':identity,'created_at':stamp,'updated_at':stamp,'body':body,
        'performed_via_github_app':{'id':1236702,'slug':'claude'},
        'issue_url':'https://api.github.com/repos/yigini/soilfer-lims/issues/162',
        'html_url':'https://github.com/yigini/soilfer-lims/issues/162#issuecomment-'+str(identity)}

def source_pass(value):
    tokens=[SOURCE_SCOPE,'sourceIndexSha256='+sha(canonical(value)),value['sourceCommit'],str(ROOT),HEAD,TREE,IMAGE,
        BUILD_RECEIPT_SHA,'acceptedQualificationId=6212990400','timingDirectionId=6213266959',
        'preApplyExactRawDbWalShmRecoveryOnly=true','anyApplyIntentOrUnknownOutcomeForwardOnly=true',
        'readinessSeconds=600','wholeOutageDisclosureRequired=true','singleHostWriter=true',
        'postflightPolicy='+POSTFLIGHT_POLICY,*[r['sha256'] for r in value['files'].values()]]
    return review('Source review: PASS\n'+'\n'.join(tokens))

class FrozenGuards(unittest.TestCase):
    def test_existing_partial_graph_is_explicitly_incomplete_and_cannot_be_source_approved(self):
        value=index();value['files']={name:row for name,row in value['files'].items() if (HERE/name).exists()}
        self.assertNotEqual(set(value['files']),REQUIRED_SOURCE)
        with self.assertRaises(RuntimeError):source_index(value)

    def test_exact_new_actual_app_review_binds_all_source_hashes_not_boolean_flags(self):
        value=index();actual=source_pass(value)
        result=source_review(actual,value);self.assertEqual(result['id'],actual['id'])
        for mode in ('old','edited','human','root','missingHash','wrongIssue'):
            changed=copy.deepcopy(actual)
            if mode=='old':changed['id']=6211327371
            elif mode=='edited':changed['updated_at']='2026-10-16T11:01:00Z'
            elif mode=='human':changed['performed_via_github_app']=None
            elif mode=='root':changed['body']=changed['body'].replace(str(ROOT),'/foreign')
            elif mode=='wrongIssue':changed['issue_url']=changed['issue_url'].replace('162','191')
            else:changed['body']=changed['body'].replace(next(iter(value['files'].values()))['sha256'],'MISSING')
            with self.subTest(mode=mode),self.assertRaises(RuntimeError):source_review(changed,value)

    def test_exact_kit_review_requires_source_pass_manifest_and_no_consumer_verdict(self):
        value=index();source=source_pass(value);source_result=source_review(source,value)
        manifest={'version':1,'scope':SOURCE_SCOPE,'root':str(ROOT),'head':HEAD,'image':IMAGE,
            'sourceIndexSha256':source_result['sourceIndexSha256'],'sourceReviewBodySha256':source_result['bodySha256']}
        names=('consumerConfigurationSha256','originalIngressSha256','heldIngressSha256',
            'wholeOutageDisclosureSha256','actualScientificImpactSha256','packageFilesSha256')
        manifest.update({name:sha(name.encode()) for name in names})
        body='Exact-kit review: PASS\n'+'\n'.join([SOURCE_SCOPE,'manifestSha256='+sha(canonical(manifest)),str(ROOT),HEAD,IMAGE,
            'sourceReviewId='+str(source['id']),'noHostConsumerActsOnUnhealthyWindow=true',
            'freshYYWholeOutageIntakeAndWorkloadGateRequired=true',*[manifest[name] for name in names]])
        actual=review(body,source['id']+1,'2026-10-16T11:01:00Z')
        self.assertEqual(kit_review(actual,manifest,value,source)['id'],actual['id'])
        changed=copy.deepcopy(actual);changed['body']=changed['body'].replace('noHostConsumerActsOnUnhealthyWindow=true','MISSING')
        with self.assertRaises(RuntimeError):kit_review(changed,manifest,value,source)

    def test_fresh_gate_is_exclusive_and_expired_human_ack_is_not_refreshed(self):
        FIXTURES.mkdir(exist_ok=True);root=pathlib.Path(tempfile.mkdtemp(prefix='owned-',dir=FIXTURES)).resolve()
        gate={'manifestSha256':'a'*64,'root':str(ROOT),'status':'FRESH_SINGLE_USE_AUTHORIZED','humanConfirmed':True,
            'createdEpoch':1000,'humanCreatedEpoch':900,'humanBodySha256':'b'*64,'humanCommentId':7000000002}
        with self.assertRaises(RuntimeError):consume_gate(root,gate,'a'*64,1501,False)
        self.assertFalse((root/'production-gate-consumed.json').exists())
        consume_gate(root,gate,'a'*64,1100,False)
        before=(root/'production-gate-consumed.json').read_bytes()
        with self.assertRaises(FileExistsError):consume_gate(root,gate,'a'*64,1100,False)
        self.assertEqual((root/'production-gate-consumed.json').read_bytes(),before)

if __name__=='__main__':unittest.main()
