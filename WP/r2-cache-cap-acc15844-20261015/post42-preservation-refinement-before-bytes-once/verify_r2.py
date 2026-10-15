"""Closed synthetic R2 guards. Never invoke a real Docker, SSH or filesystem operator."""
import ast,copy,pathlib,sys,types,unittest
from r2_contract import *

if 'SOURCE_RAW_FILES' not in globals():
    SOURCE_RAW_FILES={n:(pathlib.Path(__file__).parent/n).read_bytes() for n in SOURCE_FILES}
if 'REFERENCE_RAW_FILES' not in globals():
    REFERENCE_RAW_FILES={n:(pathlib.Path(__file__).parent/'authority-source-preparation-once'/n).read_bytes() for n in ['build-receipt.json','image-inspect-original.json']}
module=types.ModuleType('r2_cache_guard_copy');sys.modules[module.__name__]=module
exec(compile(SOURCE_RAW_FILES['r2_cache.py'],'r2_cache.py','exec'),module.__dict__)

def row(letter='a',size=100,parents=None,shared=False,inuse=False):
    return {'ID':letter*25,'Size':size,'Parents':parents or [],'InUse':inuse,'Shared':shared,'CreatedAt':'2026-10-15T19:19:22Z','LastUsedAt':'2026-10-15T19:19:23Z','UsageCount':1,'Type':'regular'}
def rows(*items):return cache_rows(list(items))
def du(wanted):return {**wanted,'Size':str(wanted['Size']),'Reclaimable':not wanted['InUse']}
def df():return {p:{'realpath':p,'device':64769,'block':4096,'available':30000000000} for p in ['/opt/lims','/var/lib/docker','/var/lib/containerd']}
def source_index():return {'head':'a'*40,'files':{n:{'sha256':sha(v),'blob':oid(v),'bytes':len(v)} for n,v in SOURCE_RAW_FILES.items()}}
def review(index):return {'id':6201000000,'created_at':'2026-10-15T20:00:00Z','updated_at':'2026-10-15T20:00:00Z','html_url':'https://github.com/yigini/soilfer-lims/issues/162#issuecomment-6201000000','performed_via_github_app':{'id':1236702,'slug':'claude'},'body':'Source review: PASS\n'+'\n'.join(review_tokens(index['head'],index))}
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
    def test_25_du_protected_or_size_changed_refuses(self):
        v=row()
        for k,x in [('Shared',True),('Reclaimable',False),('Size','101')]:
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
if __name__=='__main__':unittest.main(verbosity=2)
