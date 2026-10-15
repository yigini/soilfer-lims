"""Source-only post-reboot authorities and guarded directory/current-evidence fixtures."""
import ast,hashlib,json,pathlib
r=pathlib.Path(__file__).resolve().parents[2];p=r/'WP/batch-proof-startup-be837974-20261015';q=p/'post-reboot-readonly-preflight-once'
pins={}
for i in [6202595120,6202615241]:
    b=(q/('actual-authority-'+str(i)+'.json')).read_bytes();v=json.loads(b);z={k:v[k] for k in ['id','body','created_at','updated_at']};z['app']={k:v['performed_via_github_app'][k] for k in ['id','slug']};pins[str(i)]=hashlib.sha256(json.dumps(z,sort_keys=True,separators=(',',':'),ensure_ascii=False).encode()).hexdigest()
    (p/'new-authority-fixtures'/('post-reboot-'+str(i)+'.json')).write_bytes(b)
def put(n,s):compile(s,n,'exec');(p/n).write_bytes(s.encode())
s=(p/'proof_contract.py').read_text().replace("review.get('id',0)>6202252017","review.get('id',0)>6202615241").replace("review['created_at']>'2026-10-15T21:04:54Z'","review['created_at']>'2026-10-15T21:25:49Z'")
s=s.replace("+['authority'+i+'='+pin for i,pin in sorted(RULE_AUTHORITY_PINS.items())]","+['authority'+i+'='+pin for i,pin in sorted(RULE_AUTHORITY_PINS.items())]+['postRebootAuthority'+i+'='+pin for i,pin in sorted(POST_REBOOT_PINS.items())]")
s+='\nPOST_REBOOT_PINS='+repr(pins)+'''
def post_reboot_authorities(values):
    require(set(values)==set(POST_REBOOT_PINS),'Current actual post-reboot authorities required')
    for i,pin in POST_REBOOT_PINS.items():
        require(values[i]['id']==int(i) and sha(canonical(authority_projection(values[i])))==pin,'Post-reboot authority changed '+i)
'''
put('proof_contract.py',s)
s=(p/'prepare_proof.py').read_text().replace("    current(out['main']","    out['postRebootAuthorities']={i:gh('repos/yigini/soilfer-lims/issues/comments/'+i) for i in POST_REBOOT_PINS};post_reboot_authorities(out['postRebootAuthorities'])\n    current(out['main']")
put('prepare_proof.py',s)
s=(p/'run_stopped_proof.py').read_text().replace("rule_authorities(evidence['rules'],evidence['r2Accepted'])","rule_authorities(evidence['rules'],evidence['r2Accepted']);post_reboot_authorities(evidence['postRebootAuthorities'])")
put('run_stopped_proof.py',s)
fresh=r/'WP/r2-cache-api-identity-acc15844-20261015/actual-r2-result-accepted6202252017-once/fresh'
e={'main':json.loads((fresh/'main-original.json').read_bytes()),'ci':json.loads((fresh/'main-ci-original.json').read_bytes()),'prs':{},'verdicts':{},'comments':{}}
for n in ['295','296','297','298']:
    for key,suffix in [('prs','original'),('verdicts','actual-pass'),('comments','comments')]:e[key][n]=json.loads((fresh/('pr'+n+'-'+suffix+'.json')).read_bytes())
(p/'new-authority-fixtures/current-four-audits.json').write_text(json.dumps(e,ensure_ascii=False),encoding='utf-8')
s=(p/'verify_proof_guards.py').read_text();end="if __name__=='__main__':unittest.main(verbosity=2)";assert end in s
extra=r'''
class PostRebootAuthorityAndDirectoryTests(unittest.TestCase):
    def authorities(self):return {i:exact_json((pathlib.Path(__file__).parent/'new-authority-fixtures'/('post-reboot-'+i+'.json')).read_bytes()) for i in POST_REBOOT_PINS}
    def test_actual_yy_resumption_and_conditional_growth_are_bound(self):post_reboot_authorities(self.authorities())
    def test_changed_or_missing_post_reboot_authority_refused(self):
        v=self.authorities();v['6202595120']['body']+=' '
        with self.assertRaises(RuntimeError):post_reboot_authorities(v)
        with self.assertRaises(RuntimeError):post_reboot_authorities({})
    def test_actual_four_app_audits_and_closed_main_ci_validate(self):
        v=exact_json((pathlib.Path(__file__).parent/'new-authority-fixtures/current-four-audits.json').read_bytes());current(v['main'],v['ci'],v['prs'],v['verdicts'],v['comments'])
    def test_new_main_ci_failure_is_not_masked_by_old_success(self):
        v=exact_json((pathlib.Path(__file__).parent/'new-authority-fixtures/current-four-audits.json').read_bytes());v['ci']['conclusion']='failure'
        with self.assertRaises(RuntimeError):current(v['main'],v['ci'],v['prs'],v['verdicts'],v['comments'])
    def test_added_asset_directory_exceeds_fixed_source_bound(self):
        v=capacity_fixture();v['assetDirectoryCount']=8
        with self.assertRaisesRegex(RuntimeError,'directory maximum'):capacity_gate(v)
    def test_later_edit_of_old_source_comment_cannot_hide_failure(self):
        v=fixture_review()
        c={'created_at':'2026-10-15T20:00:00Z','updated_at':'2026-10-15T22:00:00Z','body':'Source review: FAILED '+fixture_graph()['head']}
        with self.assertRaises(RuntimeError):no_later_failure([c],v,fixture_graph())
'''
s=s.replace(end,extra+'\n'+end);put('verify_proof_guards.py',s)
print(json.dumps({'sourceOnly':True,'postRebootPins':pins,'tests':sum(isinstance(n,ast.FunctionDef) and n.name.startswith('test_') for n in ast.walk(ast.parse(s)))}))

