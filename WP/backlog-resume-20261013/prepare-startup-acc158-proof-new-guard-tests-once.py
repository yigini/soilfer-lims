"""New authority fixtures and meaningful new guards; preserve175 predecessor guards."""
import ast,hashlib,json,pathlib
r=pathlib.Path(__file__).resolve().parents[2];p=r/'WP/batch-proof-startup-be837974-20261015';o=r/'WP/batch-proof-health-transitions-cde8-20261015'
s=(o/'verify_proof_guards.py').read_text()
s=s.replace('6189000001','6203000001').replace("'slug':'claude'","'id':1236702,'slug':'claude'")
s=s.replace('2026-10-15T08:50:00Z','2026-10-15T21:50:00Z').replace('2026-10-15T08:51:00Z','2026-10-15T21:51:00Z').replace('2026-10-15T08:52:00Z','2026-10-15T21:52:00Z')
s=s.replace('31895225454','41895635054').replace('31895225453','41895635053')
s=s.replace('FLOOR+DB_EQUIVALENTS*4096+3*8192+LOG_RESERVE','FLOOR+DB_EQUIVALENTS*4096+3*8192+LOG_RESERVE+ADDITIONAL_BYTES+FIXED_BYTES')
s=s.replace('FLOOR_BYTES+LOG_BYTES)','FLOOR_BYTES+LOG_BYTES+ADDITIONAL_BYTES)')
a=s.index('    def capacity(self):');b=s.index('\n    def test_capacity_enough',a)
s=s[:a]+"    def capacity(self):return capacity_fixture()\n"+s[b:]
s=s.replace("v=self.capacity();v['freeBytes']['/opt/lims']=41895635053","v=self.capacity();v['hardware']['/opt/lims']['availableBlocks']=v['requiredBytes']//4096;v['hardware']['/opt/lims']['freeBytes']=v['hardware']['/opt/lims']['availableBlocks']*4096;v['freeBytes']['/opt/lims']=v['hardware']['/opt/lims']['freeBytes']")
s=s.replace('def test_reference_capacity_honestly_fits(self):','def test_synthetic_reference_capacity_with_58gb_fixture(self):')
s=s.replace('def fixture_graph():',"""from proof_budget import ADDITIONAL_BYTES,FIXED_BYTES,FIXED_PER_STARTUP,hardware_gate,package_allowance,capacity_probe_source,HARDWARE_SOURCE,collect_hardware
from proof_app_sources import APP_PINS,validate_sources
from proof_render import render
def capacity_fixture(phase='BEFORE_UNIT',future=0):
    required=declared_budget(REFERENCE_DB_BYTES,REFERENCE_ASSET_BYTES)+future;blocks=(required+4095)//4096
    hardware={p:{'path':p,'realpath':p,'ancestorsChecked':True,'directory':True,'device':64769,'blockBytes':4096,'fragmentBytes':4096,'availableBlocks':blocks,'freeBytes':blocks*4096} for p in BOUND}
    return {'metadataOnly':True,'phase':phase,'futurePackageBytes':future,'additionalHeadroomBytes':ADDITIONAL_BYTES,'databaseReserveBytes':REFERENCE_DB_BYTES,'assetReserveBytes':REFERENCE_ASSET_BYTES,'requiredBytes':required,'dbEquivalents':30,'stageTableSha256':TABLE_SHA,'hardware':hardware,'freeBytes':{p:r['freeBytes'] for p,r in hardware.items()}}
def fixture_graph():""")
end="if __name__=='__main__':unittest.main(verbosity=2)"
assert end in s;s=s.replace(end,'')
extra=r'''
class NewApplicationSourceTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.raw={n:(pathlib.Path(__file__).parent/'application-source-fixtures'/n).read_bytes() for n in APP_PINS}
    def test_actual_all_pinned_sources_derive_26_ready_and_conservative_8_triples(self):
        v=validate_sources(self.raw);self.assertEqual((len(v['readyEvents']),v['entrypointPolicySnapshots'],v['readyPolicySnapshots'],v['maximumPolicyDbTriplesPerStartup']),(26,4,4,8));self.assertFalse(v['cacheHitAssumed']);self.assertEqual(v['schemaCopyBytesPerStartup'],89556)
    def test_actual_qualified_manifest_matches_all_source_pins(self):
        rows=exact_json((pathlib.Path(__file__).parent/'new-authority-fixtures/source-index.json').read_bytes());validate_sources(self.raw,{r['path']:r for r in rows['entries']})
    def test_one_changed_byte_in_context_stops(self):
        v=dict(self.raw);v['server/utils/startupReadinessContext.js']+=b' '
        with self.assertRaisesRegex(RuntimeError,'source changed'):validate_sources(v)
    def test_new_unbudgeted_policy_copy_stops(self):
        v=dict(self.raw);v['server/scripts/install_lab_policy_schema.js']+=b'\nfs.copyFileSync(a,b)\n'
        with self.assertRaises(RuntimeError):validate_sources(v)
    def test_missing_ready_module_stops(self):
        v=dict(self.raw);v.pop('server/scripts/install_order_revisions.js')
        with self.assertRaises(RuntimeError):validate_sources(v)
    def test_added_unreviewed_copy_source_stops(self):
        v=dict(self.raw);v['server/scripts/new.js']=b'copyFile(a,b)'
        with self.assertRaises(RuntimeError):validate_sources(v)
    def test_changed_entrypoint_schema_copy_stops(self):
        v=dict(self.raw);v['docker-entrypoint.sh']=v['docker-entrypoint.sh'].replace(b'cp /app/server/.schema-backup',b'cp /elsewhere')
        with self.assertRaises(RuntimeError):validate_sources(v)
    def test_changed_manifest_blob_stops(self):
        rows={n:dict(r) for n,r in APP_PINS.items()};rows['server/index.js']['blob']='0'*40
        with self.assertRaisesRegex(RuntimeError,'manifest'):validate_sources(self.raw,rows)
    def test_changed_manifest_length_stops(self):
        rows={n:dict(r) for n,r in APP_PINS.items()};rows['server/index.js']['bytes']+=1
        with self.assertRaises(RuntimeError):validate_sources(self.raw,rows)
    def test_old_input_authority_accepts_real_old_records_with_new_image_constants(self):
        self.assertNotEqual((CANDIDATE,TREE,IMAGE),(OLD_INPUT_CANDIDATE,OLD_INPUT_TREE,OLD_INPUT_IMAGE));validate_records(real_bound_records())
    def test_new_head_cannot_be_substituted_into_old_input_record(self):
        v=real_bound_records();v['prior-proof-input.json'].update(head=CANDIDATE,tree=TREE,image=IMAGE)
        with self.assertRaisesRegex(RuntimeError,'Bound app/image'):validate_records(v)

class NewQualifiedAuthorityTests(unittest.TestCase):
    def fixture(self,n):return (pathlib.Path(__file__).parent/'new-authority-fixtures'/n).read_bytes()
    def qualified(self,change=None):
        raw=self.fixture('build-receipt.json');v=exact_json(raw);i=exact_json(self.fixture('image-inspect-original.json'))[0]
        if change:change(v,i)
        qualified(v,raw,i)
    def test_actual_qualified_acc158_cd3a_receipt(self):self.qualified()
    def test_old_b5_image_refused(self):
        with self.assertRaises(RuntimeError):self.qualified(lambda v,i:i.update(Id=OLD_INPUT_IMAGE))
    def test_unqualified_failed_build_refused(self):
        with self.assertRaises(RuntimeError):self.qualified(lambda v,i:v.update(status='FAILED'))
    def test_entire_qualified_image_config_changed_refused(self):
        with self.assertRaises(RuntimeError):self.qualified(lambda v,i:i['Config'].update(Entrypoint=['sh']))
    def test_all_six_actual_rule_pins_and_actual_r2_acceptance(self):
        rules={i:exact_json(self.fixture('authority-'+i+'.json')) for i in RULE_AUTHORITY_PINS};accepted=exact_json(self.fixture('r2-accepted.json'));rule_authorities(rules,accepted)
    def test_rule_edited_body_refused(self):
        rules={i:exact_json(self.fixture('authority-'+i+'.json')) for i in RULE_AUTHORITY_PINS};accepted=exact_json(self.fixture('r2-accepted.json'));rules['6200547786']['body']+=' '
        with self.assertRaises(RuntimeError):rule_authorities(rules,accepted)
    def test_r2_acceptance_cannot_be_changed_to_new_prune_authority(self):
        rules={i:exact_json(self.fixture('authority-'+i+'.json')) for i in RULE_AUTHORITY_PINS};accepted=exact_json(self.fixture('r2-accepted.json'));accepted['body']+=' Another R2 allowed'
        with self.assertRaises(RuntimeError):rule_authorities(rules,accepted)
    def test_spoofed_claude_app_id_stops_new_source_review(self):
        v=fixture_review();v['performed_via_github_app']['id']=1
        with self.assertRaises(RuntimeError):approval(v,fixture_graph())
    def test_previous_actual_r2_pass_is_not_new_proof_review(self):
        v=fixture_review();v['id']=6201838855
        with self.assertRaises(RuntimeError):approval(v,fixture_graph())
    def test_new_main_ci_and_four_application_audits(self):
        self.assertEqual(MAIN_CI,38772398721);self.assertEqual([r[0] for r in AUDITS],[295,296,297,298]);self.assertEqual(AUDITS[-1][3],CANDIDATE)

class NewR4Tests(unittest.TestCase):
    def test_additional_10gb_and_schema_fixed_bytes_are_required(self):
        self.assertEqual((ADDITIONAL_BYTES,FIXED_PER_STARTUP,FIXED_BYTES),(10000000000,163840,409600));self.assertEqual(declared_budget(REFERENCE_DB_BYTES,REFERENCE_ASSET_BYTES),41895635054)
    def test_package_future_is_charged_exactly_before_root(self):
        lengths={'proof-input.json':1234,'a.py':4097};size=package_allowance(lengths);self.assertEqual(size,4096+8192+2*1024**2)
        a=capacity_fixture('BEFORE_ROOT',size);b=capacity_fixture('BEFORE_UNIT',0);capacity_gate(a,'BEFORE_ROOT',size);capacity_gate(b,'BEFORE_UNIT',0);self.assertEqual(a['requiredBytes']-b['requiredBytes'],size)
    def test_one_byte_short_fresh_hardware_refuses_before_any_root(self):
        base=declared_budget(REFERENCE_DB_BYTES,REFERENCE_ASSET_BYTES);extra=(4096-(base%4096))%4096+1
        v=capacity_fixture('BEFORE_ROOT',extra)
        for p,r in v['hardware'].items():r.update(availableBlocks=(v['requiredBytes']-1)//4096,freeBytes=v['requiredBytes']-1);v['freeBytes'][p]=r['freeBytes']
        with self.assertRaisesRegex(RuntimeError,'STOP_CAPACITY'):capacity_gate(v,'BEFORE_ROOT',extra)
    def test_same_filesystem_free_is_never_added(self):
        v=capacity_fixture();blocks=(v['requiredBytes']//2)//4096
        for p,r in v['hardware'].items():r.update(availableBlocks=blocks,freeBytes=blocks*4096);v['freeBytes'][p]=r['freeBytes']
        with self.assertRaisesRegex(RuntimeError,'STOP_CAPACITY'):capacity_gate(v)
    def test_before_unit_rejects_double_package_charge(self):
        v=capacity_fixture('BEFORE_UNIT',4096)
        with self.assertRaisesRegex(RuntimeError,'Future package'):capacity_gate(v)
    def test_before_root_rejects_missing_package_charge(self):
        with self.assertRaises(RuntimeError):capacity_gate(capacity_fixture('BEFORE_ROOT',0))
    def test_missing_10gb_not_accepted(self):
        v=capacity_fixture();v['requiredBytes']-=ADDITIONAL_BYTES
        with self.assertRaises(RuntimeError):capacity_gate(v)
    def test_hardware_alias_refused(self):
        v=capacity_fixture();v['hardware']['/opt/lims']['realpath']='/elsewhere'
        with self.assertRaises(RuntimeError):capacity_gate(v)
    def test_hardware_ancestor_not_verified_refused(self):
        v=capacity_fixture();v['hardware']['/opt/lims']['ancestorsChecked']=False
        with self.assertRaises(RuntimeError):capacity_gate(v)
    def test_hardware_wrong_block_size_refused(self):
        v=capacity_fixture();v['hardware']['/opt/lims']['blockBytes']=512
        with self.assertRaises(RuntimeError):capacity_gate(v)
    def test_hardware_noninteger_statvfs_refused(self):
        v=capacity_fixture();v['hardware']['/opt/lims']['availableBlocks']=float(v['hardware']['/opt/lims']['availableBlocks'])
        with self.assertRaises(RuntimeError):capacity_gate(v)
    def test_hardware_inconsistent_free_bytes_refused(self):
        v=capacity_fixture();v['hardware']['/opt/lims']['freeBytes']+=1
        with self.assertRaises(RuntimeError):capacity_gate(v)
    def test_package_path_or_oversized_spec_refused(self):
        for v in [{'../outside':1},{'proof-input.json':1024**2+1},{'a':True}]:
            with self.assertRaises(RuntimeError):package_allowance(v)
    def test_actual_stage_allowance_includes_schema_bytes(self):
        b=Budget(4096,0);self.assertEqual(b.allowances[0],12*4096*5//4+FIXED_PER_STARTUP*5//4)
    def test_terminal_reserve_keeps_extra_10gb(self):
        b=Budget(4096,0)
        for row in TABLE:
            b.begin(row['stage'],b.required())
            for site,count in row['sites'].items():
                for _ in range(count):b.claim(site)
            b.finish(row['stage'],0)
        self.assertEqual(b.required(),FLOOR_BYTES+LOG_BYTES+ADDITIONAL_BYTES)

class ActualRemoteTemplateTests(unittest.TestCase):
    def test_all_actual_remote_templates_compile(self):
        from launch_proof import remote_sources
        programs=remote_sources({'proof-input.json':'a'*64},4096)
        self.assertEqual(set(programs),{'beforeRoot','beforeUnit','create','unit'})
        for n,raw in programs.items():compile(raw,n,'exec')
    def test_actual_capacity_template_all_phases_compile(self):
        for phase,future in [('BEFORE_ROOT',4096),('BEFORE_UNIT',0),('RUNTIME_BIND',0)]:
            compile(capacity_probe_source('/old/data','/old/assets','/old/backup',phase,future),phase,'exec')
    def test_render_nested_tokens_and_literal_values_are_one_pass(self):
        raw=render('root=ROOT_VALUE\nbuild=BUILD_ROOT_VALUE\n',{'ROOT_VALUE':'BUILD_ROOT_VALUE','BUILD_ROOT_VALUE':'ROOT_VALUE'},'collision')
        v={};exec(raw,v);self.assertEqual((v['root'],v['build']),('BUILD_ROOT_VALUE','ROOT_VALUE'))
    def test_render_missing_extra_token_and_invalid_syntax_stops(self):
        for template,values in [('x=X_VALUE',{}),('x=X_VALUE',{'X_VALUE':1,'EXTRA_VALUE':2}),('x=(X_VALUE',{'X_VALUE':1})]:
            with self.assertRaises((RuntimeError,SyntaxError)):render(template,values,'refused')
    def test_actual_template_syntax_failure_precedes_any_ssh(self):
        import launch_proof
        with mock.patch.object(launch_proof,'CREATE_TEMPLATE','x=(ROOT_VALUE'),mock.patch.object(launch_proof,'transport',side_effect=AssertionError('No SSH')):
            with self.assertRaises(SyntaxError):launch_proof.remote_sources({'a':'b'},4096)
    def test_actual_existing_unit_template_cannot_start_systemd(self):
        import launch_proof,types
        calls=[]
        class P:
            def __init__(self,p):self.p=p
            def __truediv__(self,n):return P(self.p+'/'+n)
            def __str__(self):return self.p
            def __eq__(self,o):return isinstance(o,P) and self.p==o.p
            def resolve(self,strict=True):return self
            def is_symlink(self):return False
            def iterdir(self):return []
        def run(args,**kw):calls.append(args);return types.SimpleNamespace(returncode=0,stdout=b'loaded\n',stderr=b'')
        fakepath=types.SimpleNamespace(Path=P);fakesub=types.SimpleNamespace(run=run)
        raw=render(launch_proof.UNIT_TEMPLATE,{'ROOT_VALUE':'/new','HASHES_VALUE':{},'UNIT_VALUE':'new-unit'},'actual-unit')
        with mock.patch.dict('sys.modules',{'pathlib':fakepath,'subprocess':fakesub}):
            with self.assertRaisesRegex(AssertionError,'Never reuse'):exec(raw,{})
        self.assertEqual(len(calls),1);self.assertEqual(calls[0][0],'systemctl')
'''
s+=extra+'\n'+end+'\n'
compile(s,'verify_proof_guards.py','exec');(p/'verify_proof_guards.py').write_bytes(s.encode())
d=p/'new-authority-fixtures';assert not d.exists();d.mkdir()
build=r/'WP/batch-build-stable-accounting-be837974-20261015/first-build-190000-closed-originals-once'
for n in ['build-receipt.json','image-inspect-original.json']:(d/n).write_bytes((build/n).read_bytes())
(d/'source-index.json').write_bytes((r/'WP/batch-build-stable-accounting-be837974-20261015/build-package-workflow-batch-build-be837974-20261015T190000Z/source-index.json').read_bytes())
accepted=r/'WP/r2-cache-api-identity-acc15844-20261015/actual-r2-result-accepted6202252017-once'
(d/'r2-accepted.json').write_bytes((accepted/'actual-acceptance-original.json').read_bytes())
for i in ['6189025975','6189658753','6189669837','6191219093','6198899941','6200547786']:
    candidates=list((accepted/'fresh').rglob('*'+i+'*.json'));assert len(candidates)==1,(i,candidates)
    (d/('authority-'+i+'.json')).write_bytes(candidates[0].read_bytes())
print(json.dumps({'sourceOnly':True,'newTestCount':sum(isinstance(n,ast.FunctionDef) and n.name.startswith('test_') for n in ast.walk(ast.parse(s))),'operatorsExecuted':0,'hostSteps':0}))

