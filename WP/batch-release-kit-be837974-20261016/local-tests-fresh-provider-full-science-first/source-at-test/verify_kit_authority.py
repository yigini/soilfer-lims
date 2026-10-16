"""Offline originals and synthetic future reviews only; no provider/host calls."""
import ast
import copy
import json
import pathlib
import tempfile
import types
import unittest
from unittest.mock import patch
from kit_contract import (HEAD,IMAGE,PHASES,POSTFLIGHT_POLICY,canonical,sha,whole_outage_disclosure,
    impact_sha,ACCEPTANCE_ID,TIMING_DIRECTION_ID)
from retained_contract import ROOT
from retained_authority import (MAIN_CI,AUDITS,RULE_AUTHORITY_PINS,POST_REBOOT_PINS,
    STEP2_DIRECTION_PINS,ATTEMPT_AUTHORITY_PINS)
from kit_provider import GitHubProvider,PREFIX,MAX_PAGES
from kit_authority import Authority,standing_authority,no_later_release_direction,reviewed_plan
from kit_science import scientific_projection,verify_scientific_originals,verify_reviewed_impact
from kit_frozen import source_review,kit_review,human_gate_comment
from verify_kit_frozen import index,source_pass,review,SOURCE_SCOPE

HERE=pathlib.Path(__file__).resolve().parent
FIXTURES=HERE/'authority-local-retained-fixtures'
OLD=HERE.parent/'batch-proof-mount-order-forward-be837974-20261016'


def originals():
    root=OLD/'actual-source-pass6211327371-once';result={}
    for row in json.loads((root/'api-command-index.json').read_bytes()):
        raw=(root/row['file']).read_bytes()
        if sha(raw)!=row['sha256'] or len(raw)!=row['bytes']:raise AssertionError('Offline original changed')
        path=row['argv'][-1].replace('repos/yigini/soilfer-lims/','')
        result[path]=json.loads(raw)
    result['issues/comments/'+str(ACCEPTANCE_ID)]=json.loads((OLD/'actual-result-accepted6212990400-once/actual-acceptance-original.json').read_bytes())
    result['issues/comments/'+str(TIMING_DIRECTION_ID)]=json.loads((HERE/'actual-timing-direction6213266959-once/api-original-0.json').read_bytes())
    return result


def synthetic_reviews():
    value=index();source=source_pass(value)
    disclosure=whole_outage_disclosure({name:{'kind':'REVIEWED_ALLOWANCE','seconds':1,
        'basis':'SYNTHETIC LOCAL TEST ONLY, not a production allowance'} for name in PHASES})
    manifest={'version':1,'scope':SOURCE_SCOPE,'root':str(ROOT),'head':HEAD,'image':IMAGE,
        'sourceIndexSha256':sha(canonical(value)),'sourceReviewBodySha256':sha(source['body'].encode()),
        'wholeOutageSeconds':4800}
    names=('consumerConfigurationSha256','originalIngressSha256','heldIngressSha256',
        'wholeOutageDisclosureSha256','actualScientificImpactSha256','packageFilesSha256')
    manifest.update({name:sha(name.encode()) for name in names})
    manifest['wholeOutageDisclosureSha256']=sha(canonical(disclosure))
    body='Exact-kit review: PASS\n'+'\n'.join([SOURCE_SCOPE,'manifestSha256='+sha(canonical(manifest)),
        str(ROOT),HEAD,IMAGE,'sourceReviewId='+str(source['id']),'noHostConsumerActsOnUnhealthyWindow=true',
        'freshYYWholeOutageIntakeAndWorkloadGateRequired=true',*[manifest[n] for n in names]])
    kit=review(body,source['id']+1,'2026-10-16T11:01:00Z');result=kit_review(kit,manifest,value,source)
    at=1792148520 # replaced by the precise synthetic record's UTC below
    from kit_provider import timestamp
    at=timestamp('2026-10-16T11:02:00Z')
    human=review('',kit['id']+1,'2026-10-16T11:02:00Z');human['performed_via_github_app']=None
    human['user']={'login':'yigini'}
    human['body']='\n'.join([HEAD,sha(canonical(manifest)),'I accept the disclosed whole outage',
        '193 samples','23 holds','20 existing','one notification','ZMB','Other labs unchanged',
        'production may have more','I accept the scientific impact lists','I control lab and hub builds/imports',
        'RELEASE_DAY_DISK_ABORTS_ACCEPTED'])
    confirmation={'confirmedByYY':True,'issue':162,'commentId':human['id'],'url':human['html_url'],
        'head':HEAD,'image':IMAGE,'createdEpoch':at,'impactSha256':impact_sha(),'acceptsFirstSyncImpact':True,
        'outageDisclosureSha256':sha(canonical(disclosure)),'acceptsWholeOutage':True,
        'labAndHubBuildsOwnedByYY':True,'controlled':True,'releaseWindowControl':'RELEASE_DAY_DISK_ABORTS_ACCEPTED',
        'manifestSha256':sha(canonical(manifest)),'exactKitReviewId':kit['id']}
    return value,source,manifest,kit,human,confirmation,disclosure,result


class Runner:
    def __init__(self,records):self.records=records;self.calls=[]
    def run(self,argv,label,timeout):
        self.calls.append((argv,label,timeout));path=argv[-1].removeprefix(PREFIX)
        if '/comments?' in path:
            key=path.split('&page=')[0];page=int(path.split('&page=')[1].split('&')[0])
            pages=self.records.get(key,[])
            value=pages[page-1] if page<=len(pages) else []
        else:value=self.records[path]
        if isinstance(value,Exception):raise value
        return canonical(value),b'',{}


def provider_fixture():
    records=originals();idx,source,manifest,kit,human,confirmation,disclosure,result=synthetic_reviews()
    for row in (source,kit,human):records['issues/comments/'+str(row['id'])]=row
    for issue in (162,295,296,297,298):
        records['issues/'+str(issue)+'/comments?per_page=100']=[[source,kit,human]] if issue==162 else []
    return Runner(records),(idx,source,manifest,kit,human,confirmation,disclosure,result)


class Provider(unittest.TestCase):
    def test_snapshot_runs_all_real_standing_predicates_on_retained_primary_originals(self):
        runner,data=provider_fixture();provider=GitHubProvider(runner,'synthetic');source,kit,human=data[1],data[3],data[4]
        value=provider.snapshot(source['id'],kit['id'],human['id']);standing_authority(value)
        self.assertGreater(len(runner.calls),35)
        self.assertEqual(len({label for argv,label,timeout in runner.calls}),len(runner.calls))
        self.assertTrue(all('--fail' in argv and '--location' not in argv and argv[-1].startswith(PREFIX)
            for argv,label,timeout in runner.calls))
        self.assertEqual(sum(argv[-1]==PREFIX+'git/ref/heads/main' for argv,label,timeout in runner.calls),2)
        no_later_release_direction(value['releaseComments'],source,kit)

    def test_incomplete_full_final_page_and_duplicate_or_foreign_rows_refuse_absence(self):
        since='2026-10-16T11:00:00Z';base=review('SYNTHETIC',8000000000,since)
        def row(i):v=copy.deepcopy(base);v['id']+=i;return v
        for mode in ('full','duplicate','foreign'):
            pages=[[row(page*100+i) for i in range(100)] for page in range(MAX_PAGES)]
            if mode=='duplicate':pages[1][0]=pages[0][0]
            if mode=='foreign':pages[0][0]['issue_url']=PREFIX+'issues/191'
            runner=Runner({'issues/162/comments?per_page=100':pages})
            with self.subTest(mode=mode),self.assertRaises(RuntimeError):
                GitHubProvider(runner,'synthetic').comments_since(162,since)
            self.assertLessEqual(len(runner.calls),MAX_PAGES)

    def test_foreign_endpoint_duplicate_json_and_network_failure_never_infer_no_comments(self):
        runner=Runner({});provider=GitHubProvider(runner,'synthetic')
        for path in ('https://evil.invalid/','../issues/191','issues/191?token=secret','pulls/299'):
            with self.subTest(path=path),self.assertRaises(RuntimeError):provider.get(path)
        self.assertFalse(runner.calls)
        runner=Runner({'issues/191':OSError('SYNTHETIC_TLS_FAILURE')})
        with self.assertRaises(OSError):GitHubProvider(runner,'synthetic').get('issues/191')
        class Duplicate:
            def run(self,*args):return b'{"state":"closed","state":"open"}',b'',{}
        with self.assertRaises(RuntimeError):GitHubProvider(Duplicate(),'synthetic').get('issues/191')

    def test_deadline_refuses_before_network_and_changed_main_at_end_refuses_snapshot(self):
        runner,data=provider_fixture();provider=GitHubProvider(runner,'synthetic',clock=lambda:100)
        provider.deadline=100
        with self.assertRaises(RuntimeError):provider.get('issues/191')
        self.assertFalse(runner.calls)
        original=runner.run;count=0
        def changing(argv,*args):
            nonlocal count
            raw,err,meta=original(argv,*args)
            if argv[-1]==PREFIX+'git/ref/heads/main':
                count+=1
                if count==2:return canonical({'object':{'sha':'f'*40}}),err,meta
            return raw,err,meta
        runner.run=changing
        with self.assertRaises(RuntimeError):GitHubProvider(runner,'synthetic').snapshot(data[1]['id'],data[3]['id'],data[4]['id'])


class AuthorityGuards(unittest.TestCase):
    def test_all_copied_predicate_asts_match_accepted_source_and_exclude_historical_approval(self):
        a=ast.parse((OLD/'proof_contract.py').read_text());b=ast.parse((HERE/'retained_authority.py').read_text())
        expected={n.name:ast.dump(n,include_attributes=False) for n in a.body if isinstance(n,ast.FunctionDef)}
        actual={n.name:ast.dump(n,include_attributes=False) for n in b.body if isinstance(n,ast.FunctionDef)}
        self.assertGreater(len(actual),10)
        for name,value in actual.items():self.assertEqual(value,expected[name],name)
        self.assertFalse({'approval','tokens','graph','reserve','healthy_predecessor'} & actual.keys())

    def test_each_current_authority_boundary_detects_tampering(self):
        runner,data=provider_fixture();snapshot=GitHubProvider(runner,'synthetic').snapshot(data[1]['id'],data[3]['id'],data[4]['id'])
        for field in ('main','ci','prs','verdicts','rules','r2Accepted','postRebootAuthorities','memoryDirection',
                      'jobsScope','diagnosticAccepted','step2Authorities','attemptAuthorities','acceptance','timingDirection','issue191'):
            v=copy.deepcopy(snapshot)
            if field=='main':v[field]['object']['sha']='f'*40
            elif field=='ci':v[field]['run_attempt']=2
            elif field=='issue191':v[field]['state']='open'
            elif field=='prs':v[field]['295']['head']['sha']='f'*40
            elif field in ('verdicts','rules','postRebootAuthorities','step2Authorities','attemptAuthorities'):
                next(iter(v[field].values()))['body']+='\nSYNTHETIC_EDIT'
            else:v[field]['body']+='\nSYNTHETIC_EDIT'
            with self.subTest(field=field),self.assertRaises(RuntimeError):standing_authority(v)

    def test_unknown_later_actual_direction_or_edited_old_direction_refuses_even_without_head_text(self):
        idx,source,manifest,kit,human,*_=synthetic_reviews()
        for stamp in ('2026-10-16T11:00:30Z','2026-10-16T11:03:00Z'):
            other=review('SYNTHETIC_NEW_SCOPE_WITHOUT_HEAD',kit['id']+10,stamp)
            with self.assertRaises(RuntimeError):no_later_release_direction([source,kit,human,other],source,kit)

    def test_real_human_body_and_unexpired_ack_required_not_confirmation_flags_alone(self):
        idx,source,manifest,kit,human,confirmation,disclosure,result=synthetic_reviews()
        human_gate_comment(human,confirmation,confirmation['createdEpoch']+10,disclosure,sha(canonical(manifest)),result)
        for mode in ('bot','edited','science','workload','manifest','expired'):
            changed=copy.deepcopy(human);now=confirmation['createdEpoch']+10
            if mode=='bot':changed['performed_via_github_app']={'id':1236702,'slug':'claude'}
            elif mode=='edited':changed['updated_at']='2026-10-16T11:03:00Z'
            elif mode=='science':changed['body']=changed['body'].replace('I accept the scientific impact lists','MISSING')
            elif mode=='workload':changed['body']=changed['body'].replace('I control lab and hub builds/imports','MISSING')
            elif mode=='manifest':changed['body']=changed['body'].replace(sha(canonical(manifest)),'MISSING')
            else:now=confirmation['createdEpoch']+601
            with self.subTest(mode=mode),self.assertRaises(RuntimeError):
                human_gate_comment(changed,confirmation,now,disclosure,sha(canonical(manifest)),result)

    def test_caller_boolean_plan_cannot_skip_real_preflight_and_failure_cannot_be_retried(self):
        data=synthetic_reviews();idx,source,manifest,kit,human,confirmation,disclosure,result=data
        authority=Authority(ROOT,object(),manifest,idx,source,kit,confirmation,disclosure,
            lambda label:None,lambda:b'',lambda:{})
        with self.assertRaises(RuntimeError):authority.consume_gate()
        with patch('kit_authority.frozen_hook_authority',side_effect=RuntimeError('SYNTHETIC_MISSING_FROZEN_FILES')) as read:
            with self.assertRaises(RuntimeError):authority.preflight({'exactKitReviewPassed':True})
            with self.assertRaises(RuntimeError):authority.preflight({'exactKitReviewPassed':True})
            self.assertEqual(read.call_count,1)
        plan=reviewed_plan(manifest,disclosure,result);self.assertEqual(plan['postflightPolicy'],POSTFLIGHT_POLICY)


class Science(unittest.TestCase):
    def chart(self):return {'access':'SQLITE_READONLY_SNAPSHOT','productionMutations':0,'observedAt':'SYNTHETIC_TIME',
        'controlChartContexts':[{'labId':'SYNTHETIC_ZMB','methodId':'METHOD','minPoints':20}],
        'affectedRuns':[{'id':'SYNTHETIC_RUN','position':1}],'sequenceRefusals':[],'counts':{'affectedRuns':1}}

    def test_only_chart_clock_is_excluded_context_settings_run_ids_counts_and_unknown_fields_remain(self):
        a=self.chart();b=copy.deepcopy(a);b['observedAt']='SYNTHETIC_LATER'
        self.assertEqual(scientific_projection('214',a),scientific_projection('214',b))
        for key in ('controlChartContexts','affectedRuns','sequenceRefusals','counts','newScientificField'):
            b=copy.deepcopy(a);b[key]=['SYNTHETIC_CHANGED'] if key!='counts' else {'affectedRuns':2}
            self.assertNotEqual(scientific_projection('214',a),scientific_projection('214',b))

    def test_order_retention_paths_do_not_hide_any_scientific_cause_ids_or_owner_ids(self):
        path=OLD/'first-proof-080000-not-used' # no access: actual retained original below
        path=HERE.parent/'batch-proof-forward-resume-cde8-20261015/first-proof-080000-closed-readiness-stop/remote-originals/actual-order-impact.json'
        a=json.loads(path.read_bytes());b=copy.deepcopy(a)
        b['retainedAllocation']['root']='/tmp/SYNTHETIC_NEW';b['readonlySnapshot']['path']='/tmp/SYNTHETIC_NEW/snapshot.db'
        self.assertEqual(scientific_projection('209',a),scientific_projection('209',b))
        for field in ('noActiveRevisionWorkItems','noMatchingLineWorkItems','refusedOpenWorkItems','refusalScope'):
            b=copy.deepcopy(a);b['impact'][field]=['SYNTHETIC_NEW_OWNER']
            self.assertNotEqual(scientific_projection('209',a),scientific_projection('209',b))
        b=copy.deepcopy(a);b['impact']['prospectiveApprovedAmendmentSampleCount']=1
        b['impact']['approvedAmendmentSampleIds']=['SYNTHETIC_APPROVED']
        with self.assertRaises(RuntimeError):scientific_projection('209',b)


if __name__=='__main__':unittest.main()
