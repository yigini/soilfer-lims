"""Closed synthetic R2 guards. Never invoke a real Docker, SSH or filesystem operator."""
import ast,copy,pathlib,sys,types,unittest
from r2_contract import *

if 'SOURCE_RAW_FILES' not in globals():
    SOURCE_RAW_FILES={n:(pathlib.Path(__file__).parent/n).read_bytes() for n in SOURCE_FILES}
if 'REFERENCE_RAW_FILES' not in globals():
    REFERENCE_RAW_FILES={n:(pathlib.Path(__file__).parent/'source-preparation-once'/n).read_bytes() for n in ['build-receipt.json','image-inspect-original.json','failed-r2-upload-source.py','prior-r2-render-refusal.json','prior-r2-du-refusal.json','actual-r2-du-command-result.json','actual-r2-plan.json']}
module=types.ModuleType('r2_cache_guard_copy');sys.modules[module.__name__]=module
exec(compile(SOURCE_RAW_FILES['r2_cache.py'],'r2_cache.py','exec'),module.__dict__)

def row(letter='a',size=100,parents=None,shared=False,inuse=False):
    return {'ID':letter*25,'Size':size,'Parents':parents or [],'InUse':inuse,'Shared':shared,'CreatedAt':'2026-10-15T19:19:22Z','LastUsedAt':'2026-10-15T19:19:23Z','UsageCount':1,'Type':'regular'}
def rows(*items):return cache_rows(list(items))
def du(wanted):return {**wanted,'Size':str(wanted['Size']),'Reclaimable':not wanted['InUse'],'Mutable':False}
def df():return {p:{'realpath':p,'device':64769,'block':4096,'available':30000000000} for p in ['/opt/lims','/var/lib/docker','/var/lib/containerd']}
def source_index():return {'head':'a'*40,'files':{n:{'sha256':sha(v),'blob':oid(v),'bytes':len(v)} for n,v in SOURCE_RAW_FILES.items()}}
def review(index):return {'id':6202000000,'created_at':'2026-10-15T20:00:00Z','updated_at':'2026-10-15T20:00:00Z','html_url':'https://github.com/yigini/soilfer-lims/issues/162#issuecomment-6202000000','performed_via_github_app':{'id':1236702,'slug':'claude'},'body':'Source review: PASS\n'+'\n'.join(review_tokens(index['head'],index))}
class FakeSink:
    def __init__(self):self.events=[]
    def event(self,label,value):self.events.append((label,copy.deepcopy(value)))
class FakeBackend:
    def __init__(self,items):
        self.rows=rows(*items);self.calls=[];self.sink=FakeSink();self.keep={'containers':{'historical':'stopped','production':'running'},'images':{'candidate':IMAGE,'other':'kept'}}
        self.remove_outside=False;self.error=False;self.change_on_du=False;self.protection_race=False;self.deadline=False;self.mismatch_preservation=False
    def check(self,seconds=0):require(not self.deadline,'Controller deadline')
    def interfaces(self):pass
    def inventory(self):return copy.deepcopy(self.rows)
    def preservation(self):return {'changed':True} if self.mismatch_preservation else copy.deepcopy(self.keep)
    def df(self):return df()
    def du(self,wanted):
        value=du(wanted)
        if self.change_on_du:self.rows[wanted['ID']]['UsageCount']+=1
        return [value]
    def prune(self,ident):
        self.calls.append(prune_argv(ident));self.rows.pop(ident)
        out='ID:\t'+ident+'\nTotal:\t100B\n'
        if self.remove_outside:
            other=next(iter(self.rows));self.rows.pop(other);out+='ID:\t'+other+'\n'
        if self.protection_race:self.mismatch_preservation=True
        return {'stdout':out,'stderr':'oops' if self.error else '','exitCode':1 if self.error else 0}

class Guards(unittest.TestCase):
    def rejected(self,fn,*a):self.assertRaises((RuntimeError,KeyError,TypeError,ValueError),fn,*a)
    def test_01_all_five_sources_compile_python39(self):
        self.assertEqual(set(SOURCE_RAW_FILES),SOURCE_FILES)
        for n,v in SOURCE_RAW_FILES.items():ast.parse(v,filename=n,feature_version=(3,9));compile(v,n,'exec')
    def test_02_exact_review_accepts_complete_graph(self):
        i=source_index();validate_source_review(review(i),i['head'],i)
    def test_03_missing_source_hash_refuses(self):
        i=source_index();v=review(i);v['body']=v['body'].replace(i['files']['r2_cache.py']['sha256'],'x');self.rejected(validate_source_review,v,i['head'],i)
    def test_04_old_review_refuses(self):
        i=source_index();v=review(i);v['id']=6200145007;self.rejected(validate_source_review,v,i['head'],i)
    def test_05_edited_or_nonclaude_review_refuses(self):
        i=source_index();v=review(i);v['updated_at']='later';self.rejected(validate_source_review,v,i['head'],i)
        v=review(i);v['performed_via_github_app']['id']=1;self.rejected(validate_source_review,v,i['head'],i)
    def test_06_incomplete_graph_refuses(self):
        i=source_index();i['files'].pop('launch_r2.py');self.rejected(graph,i)
    def test_07_actual_successful_build_binding(self):
        value=validate_build(REFERENCE_RAW_FILES['build-receipt.json'],REFERENCE_RAW_FILES['image-inspect-original.json']);self.assertEqual(value['Id'],IMAGE)
    def test_08_failed_or_other_build_receipt_refuses(self):
        self.rejected(validate_build,b'{"status":"FAILED180000"}',REFERENCE_RAW_FILES['image-inspect-original.json'])
    def test_09_image_inspection_changed_refuses(self):
        self.rejected(validate_build,REFERENCE_RAW_FILES['build-receipt.json'],REFERENCE_RAW_FILES['image-inspect-original.json']+b' ')
    def test_10_duplicate_json_refuses(self):self.rejected(json_exact,b'{"a":1,"a":2}')
    def test_11_invalid_full_id_refuses(self):
        for ident in ['a'*24,'a'*26,'A'*25,'a.*','../x',None]:self.rejected(prune_argv,ident)
    def test_12_cache_protection_booleans_exact(self):
        for key in ['InUse','Shared']:
            for value in [0,1,None,'false']:
                v=row();v[key]=value;self.rejected(cache_rows,[v])
    def test_13_size_and_usage_exact_integers(self):
        for key in ['Size','UsageCount']:
            for value in [True,-1,'100',None]:
                v=row();v[key]=value;self.rejected(cache_rows,[v])
    def test_14_duplicate_cache_refuses(self):self.rejected(cache_rows,[row(),row()])
    def test_15_parent_aliases_and_duplicates_refuse(self):
        v=row();v[' Parents']=[];self.rejected(cache_rows,[v])
        self.rejected(cache_rows,[row(parents=['b'*25,'b'*25])])
    def test_16_parent_cycles_refuse(self):self.rejected(cache_rows,[row(parents=['b'*25]),row('b',parents=['a'*25])])
    def test_17_empty_and_bounds(self):
        self.assertEqual(rows(),{});self.rejected(cache_rows,[row() for _ in range(MAX_RECORDS+1)])
    def test_18_inuse_and_shared_never_planned(self):
        self.assertEqual(plan(rows(row(shared=True),row('b',inuse=True))),[])
    def test_19_protected_child_preserves_parent(self):self.assertEqual(plan(rows(row(),row('b',parents=['a'*25],shared=True))),[])
    def test_20_leaf_before_parent(self):
        self.assertEqual([v['ID'] for v in plan(rows(row(),row('b',parents=['a'*25])))],['b'*25,'a'*25])
    def test_21_changed_record_skips(self):
        v=row();r=rows(v);r[v['ID']]['UsageCount']=2;self.assertIsNotNone(eligible(v,r))
    def test_22_new_child_blocks_parent(self):
        v=row();self.assertIsNotNone(eligible(v,rows(v,row('b',parents=[v['ID']]))))
    def test_23_exact_cap_and_atomic_protection_filters(self):
        a=prune_argv('a'*25);self.assertIn('--max-used-space=5000000000',a);self.assertIn('id=^'+'a'*25+'$',a)
        self.assertIn('shared=false',a);self.assertIn('inuse=false',a);self.assertNotIn('--keep-storage',a);self.assertNotIn('--reserved-space',a)
    def test_24_du_complete_and_matching(self):
        v=row();du_guard([du(v)],v)
        self.rejected(du_guard,[],v);self.rejected(du_guard,[du(v),du(v)],v)
    def test_25_du_protected_or_exact_usage_changed_refuses(self):
        v=row()
        for k,x in [('Shared',True),('Reclaimable',False),('UsageCount',2)]:
            d=du(v);d[k]=x;self.rejected(du_guard,[d],v)
    def test_26_outside_removal_refuses(self):
        self.rejected(removal_guard,rows(row(),row('b')),rows(),'a'*25,'ID:\t'+'a'*25+'\nID:\t'+'b'*25+'\n')
    def test_27_report_and_actual_must_agree(self):self.rejected(removal_guard,rows(row()),rows(),'a'*25,'Total: 0B\n')
    def test_28_protected_loss_refuses(self):self.rejected(removal_guard,rows(row(),row('b',shared=True)),rows(),'a'*25,'ID:\t'+'a'*25+'\n')
    def test_29_noop_is_honest(self):self.assertEqual(removal_guard(rows(row()),rows(row()),'a'*25,'Total: 0B\n'),[])
    def test_30_duplicate_report_refuses(self):self.rejected(removal_guard,rows(row()),rows(),'a'*25,('ID:\t'+'a'*25+'\n')*2)
    def test_31_df_same_fs_not_added(self):self.assertEqual(validate_df(df()),df())
    def test_32_df_floor_alias_block_device_refuse(self):
        for k,v in [('available',FLOOR+LOG_RESERVE-1),('realpath','/alias'),('block',512),('device',9)]:
            d=df();d['/opt/lims'][k]=v;self.rejected(validate_df,d)
    def test_33_actual_core_under_cap_no_prune(self):
        b=FakeBackend([row()]);v=module.maintain(b,b.sink);self.assertEqual(v['status'],'R2_CAP_MET');self.assertEqual(b.calls,[])
    def test_34_actual_core_protected_above_cap_stays(self):
        b=FakeBackend([row(size=6000000000,shared=True),row('b',size=1000000000)]);v=module.maintain(b,b.sink)
        self.assertEqual(len(b.calls),1);self.assertIn('a'*25,b.rows);self.assertEqual(v['remainingLogicalCacheBytes'],6000000000);self.assertNotEqual(v['status'],'R2_CAP_MET')
        receipt=[r for label,r in b.sink.events if label=='item-receipt'][0];self.assertIn('dfBefore',receipt);self.assertIn('dfAfter',receipt)
    def test_35_actual_core_changed_after_du_skips(self):
        b=FakeBackend([row(size=6000000000)]);b.change_on_du=True;v=module.maintain(b,b.sink);self.assertEqual(b.calls,[]);self.assertEqual(v['items'][0]['status'],'SKIPPED')
    def test_36_actual_core_failed_mutation_never_retried(self):
        b=FakeBackend([row(size=6000000000)]);b.error=True;self.rejected(module.maintain,b,b.sink);self.assertEqual(len(b.calls),1)
    def test_37_actual_core_outside_change_stops(self):
        b=FakeBackend([row(size=6000000000),row('b')]);b.remove_outside=True;self.rejected(module.maintain,b,b.sink);self.assertEqual(len(b.calls),1)
    def test_38_actual_core_deadline_before_operation(self):
        b=FakeBackend([row(size=6000000000)]);b.deadline=True;self.rejected(module.maintain,b,b.sink);self.assertEqual(b.calls,[])
    def test_39_actual_core_preservation_change_stops(self):
        b=FakeBackend([row(size=6000000000)]);b.protection_race=True;self.rejected(module.maintain,b,b.sink);self.assertEqual(len(b.calls),1)
    def test_40_new_direction_bound_but_r2_retry_prohibited(self):
        self.assertIn('6200547786',RULE_AUTHORITY_PINS);self.assertIn('6198899941',RULE_AUTHORITY_PINS)
        self.assertIn('unknownOutcomeNeverRetry=true',review_tokens('a'*40,source_index()));self.assertNotIn('rerun1',ROOT)
    def test_41_later_exact_source_failure_refuses(self):
        i=source_index();v=review(i);self.rejected(no_later_source_failure,[{'created_at':'2026-10-15T21:00:00Z','body':i['head']+' Source review: FAILED'}],v,i['head'])
    def test_42_new_unknown_id_not_substituted(self):
        before=rows(row());v=row('b');self.assertIsNotNone(eligible(v,before));self.assertEqual([p['ID'] for p in plan(before)],['a'*25])
    def test_43_actual_core_unknown_outcome_retains_item_receipt(self):
        b=FakeBackend([row(size=6000000000)])
        def unknown(ident):
            b.calls.append(prune_argv(ident));raise RuntimeError('Timeout unknown outcome')
        b.prune=unknown;self.rejected(module.maintain,b,b.sink);self.assertEqual(len(b.calls),1)
        item=[r for label,r in b.sink.events if label=='item-receipt'][0]
        self.assertEqual(item['status'],'UNKNOWN_OR_OUTSIDE_CHANGE_STOP_NEVER_RETRY');self.assertFalse(item['retryAllowed']);self.assertIn('dfBefore',item);self.assertIsNone(item['dfAfter'])
    def test_44_maximum32_closed_items_no_substitution(self):
        data=[]
        for i in range(40):
            r=row();r['ID']='%025d'%i;data.append(r)
        selected=plan(cache_rows(data));self.assertEqual(len(selected),32);self.assertEqual(len({v['ID'] for v in selected}),32)

    def actual_template(self,name):
        tree=ast.parse(SOURCE_RAW_FILES['launch_r2.py'])
        nodes=[n for n in ast.walk(tree) if isinstance(n,ast.Assign) and any(isinstance(t,ast.Name) and t.id==name for t in n.targets) and isinstance(n.value,ast.Constant)]
        self.assertEqual(len(nodes),1);return ast.literal_eval(nodes[0].value)
    def test_45_exact_actual_upload_template_renders_and_compiles(self):
        import base64
        values={'ROOT_VALUE':repr(ROOT),'UNIT_VALUE':repr(UNIT),'ENCODED_VALUE':repr({n:base64.b64encode(v).decode() for n,v in SOURCE_RAW_FILES.items()}),'FLOOR_VALUE':str(FLOOR),'RESERVE_VALUE':str(LOG_RESERVE),'BUILD_ROOT_VALUE':repr(BUILD_ROOT),'RECEIPT_VALUE':repr(BUILD_RECEIPT_SHA)}
        actual=render_remote_source(self.actual_template('create'),values);compile(actual,'actual-upload-script','exec')
        self.assertIn('pathlib.Path('+repr(BUILD_ROOT)+')',actual);self.assertNotIn("BUILD_'",actual)
        tree=ast.parse(actual);assign=[n for n in ast.walk(tree) if isinstance(n,ast.Assign) and any(isinstance(t,ast.Name) and t.id=='original' for t in n.targets)][0]
        self.assertEqual(ast.literal_eval(assign.value.left.args[0]),BUILD_ROOT)
    def test_46_exact_actual_unit_template_renders_and_compiles(self):
        actual=render_remote_source(self.actual_template('unit_code'),{'ROOT_VALUE':repr(ROOT),'UNIT_VALUE':repr(UNIT),'FLOOR_VALUE':str(FLOOR),'RESERVE_VALUE':str(LOG_RESERVE),'HASHES_VALUE':repr({n:sha(v) for n,v in SOURCE_RAW_FILES.items()})})
        compile(actual,'actual-unit-script','exec');self.assertIn("'systemd-run'",actual);self.assertIn('MemoryMax=805306368',actual)
    def test_47_replacement_order_and_nested_name_do_not_collide(self):
        template='root=ROOT_VALUE\nbuild=BUILD_ROOT_VALUE\n'
        values={'ROOT_VALUE':repr(ROOT),'BUILD_ROOT_VALUE':repr(BUILD_ROOT)}
        rendered=render_remote_source(template,values);self.assertEqual(rendered,render_remote_source(template,dict(reversed(list(values.items())))))
        target={};exec(compile(rendered,'pure-literal-assignment','exec'),{},target);self.assertEqual(target,{'root':ROOT,'build':BUILD_ROOT})
    def test_48_missing_extra_or_invalid_render_refuses_before_ssh(self):
        for values in [{},{'ROOT_VALUE':repr(ROOT),'EXTRA_VALUE':'1'},{'ROOT_VALUE':"'unterminated"}]:self.assertRaises((RuntimeError,SyntaxError),render_remote_source,'root=ROOT_VALUE',values)
    def test_49_original_actual_render_syntax_failure_preserved(self):
        self.assertRaises(SyntaxError,compile,REFERENCE_RAW_FILES['failed-r2-upload-source.py'],'actual-original-failed-script','exec')
        validate_prior_render_failure(REFERENCE_RAW_FILES['prior-r2-render-refusal.json'])
    def test_50_new_root_and_no_sequential_replace_or_old_replay(self):
        self.assertTrue(ROOT.endswith('T220000Z'));self.assertNotIn('T210000Z',ROOT);self.assertNotIn('T213000Z',ROOT)
        launcher=SOURCE_RAW_FILES['launch_r2.py'].decode();self.assertNotIn('create=create.replace',launcher);self.assertNotIn('unit_code=unit_code.replace',launcher)
        self.assertEqual(launcher.count('render_remote_source('),2)
        self.rejected(validate_prior_render_failure,b'{}')


    def actual_du_pair(self):
        wanted=json_exact(REFERENCE_RAW_FILES['actual-r2-plan.json'])['items'][0]
        result=json_exact(REFERENCE_RAW_FILES['actual-r2-du-command-result.json'])
        self.assertEqual(result['exitCode'],0);self.assertEqual(result['stderr'],'')
        return wanted,json_exact(result['stdout'])
    def test_51_actual_installed_du_human_fields_are_evidence_only(self):
        wanted,actual=self.actual_du_pair();proof=du_guard([actual],wanted)
        self.assertEqual(proof['humanDisplayEvidenceOnly'],{'Size':'33.17MB','CreatedAt':'2026-10-15 18:32:40.205063424 +0000 UTC','LastUsedAt':'2 hours ago'})
        self.assertEqual(proof['apiExactBytesAndTimes']['Size'],33165312);self.assertFalse(proof['displayValuesUsedAsMutationAuthority'])
    def test_52_original_strict_guard_reproduces_actual_refusal_purely(self):
        wanted,actual=self.actual_du_pair()
        self.assertNotEqual(str(actual['Size']),str(wanted['Size']))
        self.assertNotEqual(actual['CreatedAt'],wanted['CreatedAt']);self.assertNotEqual(actual['LastUsedAt'],wanted['LastUsedAt'])
        validate_prior_du_failure(REFERENCE_RAW_FILES['prior-r2-du-refusal.json'])
    def test_53_actual_controller_with_real_du_bytes_closed_fake_only(self):
        wanted,actual=self.actual_du_pair();b=FakeBackend([wanted,row('z',size=6000000000,shared=True)])
        b.du=lambda unused:[copy.deepcopy(actual)]
        result=module.maintain(b,b.sink);self.assertEqual(len(b.calls),1);self.assertIn(wanted['ID'],b.calls[0][b.calls[0].index('--filter')+1])
        self.assertEqual(result['remainingLogicalCacheBytes'],6000000000)
        proofs=[v for label,v in b.sink.events if label=='buildx-reference-crosscheck'];self.assertEqual(len(proofs),1);self.assertFalse(proofs[0]['displayValuesUsedAsMutationAuthority'])
    def test_54_exact_api_changes_during_real_human_du_skip_no_substitute(self):
        wanted,actual=self.actual_du_pair()
        changes={'Size':wanted['Size']+1,'CreatedAt':'2026-10-15T18:32:40.205063425Z','LastUsedAt':'2026-10-15T18:35:28.328436337Z','UsageCount':2,'Parents':[],'Type':'other','InUse':True,'Shared':True}
        for key,value in changes.items():
            with self.subTest(field=key):
                b=FakeBackend([wanted,row('z',size=6000000000,shared=True)])
                def changed_du(unused):
                    b.rows[wanted['ID']][key]=value;return [copy.deepcopy(actual)]
                b.du=changed_du;result=module.maintain(b,b.sink);self.assertEqual(b.calls,[]);self.assertEqual(result['items'][0]['status'],'SKIPPED')
    def test_55_buildx_exact_reference_mismatch_or_protection_refuses(self):
        wanted,actual=self.actual_du_pair()
        for key,value in [('ID','x'*25),('Parents',[]),('UsageCount',2),('UsageCount',True),('Type','other'),('Shared',True),('Reclaimable',False),('Mutable',0)]:
            with self.subTest(field=key,value=value):
                bad=copy.deepcopy(actual);bad[key]=value;self.rejected(du_guard,[bad],wanted)
    def test_56_missing_or_untyped_du_evidence_refuses(self):
        wanted,actual=self.actual_du_pair()
        for key in ['Size','CreatedAt','LastUsedAt','ID','Parents','UsageCount','Type','Shared','Reclaimable','Mutable']:
            bad=copy.deepcopy(actual);bad.pop(key);self.rejected(du_guard,[bad],wanted)
        for value in [None,3,True,'','x'*4097]:
            bad=copy.deepcopy(actual);bad['Size']=value;self.rejected(du_guard,[bad],wanted)
    def test_57_new_identity_failure_root_and_binding_are_mandatory(self):
        self.rejected(validate_prior_du_failure,b'{}');validate_prior_du_failure(REFERENCE_RAW_FILES['prior-r2-du-refusal.json'])
        tokens=review_tokens('a'*40,source_index());self.assertIn('exactApiByteTimeIdentityBeforeAndAfterBuildx=true',tokens);self.assertIn('buildxHumanDisplayIsEvidenceOnly=true',tokens)
        self.assertIn('priorR2DuFailureSha256='+PRIOR_DU_FAILURE_SHA,tokens)
    def test_58_display_numbers_never_replace_exact_api_bytes_or_nanos(self):
        wanted,actual=self.actual_du_pair();actual['Size']='999999999999GB';actual['CreatedAt']='human evidence';actual['LastUsedAt']='just now'
        proof=du_guard([actual],wanted);self.assertEqual(proof['apiExactBytesAndTimes'],{k:wanted[k] for k in ['Size','CreatedAt','LastUsedAt']});self.assertFalse(proof['displayValuesUsedAsMutationAuthority'])

if __name__=='__main__':unittest.main(verbosity=2)
