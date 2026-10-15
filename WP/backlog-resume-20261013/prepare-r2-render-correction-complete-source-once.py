"""NEW complete R2 source successor with one-pass checked rendering; no package/host/cache."""
import ast,pathlib,subprocess
R=pathlib.Path(__file__).resolve().parents[2];S=R/'WP/r2-cache-cap-render-acc15844-20261015';D=S/'source-preparation-once'
assert not S.exists();oldrel='WP/r2-cache-cap-acc15844-20261015/'
names=['r2_contract.py','r2_cache.py','prepare_r2.py','launch_r2.py','verify_r2.py']
raws={n:subprocess.check_output(['git','show','a05c3ad10bb7c7e678abe91ce444b5f5dba24dd4:'+oldrel+n],cwd=R) for n in names}
texts={n:v.decode() for n,v in raws.items()}
def replace(n,before,after):
    assert texts[n].count(before)==1,(n,before,texts[n].count(before));texts[n]=texts[n].replace(before,after)
replace('r2_contract.py','r2-cache-acc15844-20261015T210000Z','r2-cache-acc15844-20261015T213000Z')
replace('r2_contract.py','lims-r2-cache-acc15844-20261015t210000z','lims-r2-cache-acc15844-20261015t213000z')
replace('r2_contract.py',"v['id']>6200455534","v['id']>6200950139")
replace('r2_contract.py',"'unknownOutcomeNeverRetry=true',","'unknownOutcomeNeverRetry=true','collisionSafeOnePassRemoteRenderAndCompileBeforeSsh=true','priorR2RenderFailureSha256='+PRIOR_RENDER_FAILURE_SHA,")
replace('r2_contract.py',"SOURCE_FILES=frozenset", "PRIOR_RENDER_FAILURE_AUDIT='2eb6534ccd5957a818e6fc2f76d41523c3aaccef'\nPRIOR_RENDER_FAILURE_PATH='WP/r2-cache-cap-acc15844-20261015/first-launch-210000-closed-render-refusal-publication-once/closed-render-refusal.json'\nPRIOR_RENDER_FAILURE_SHA='4f7fa58ae5225f03929a3df10d6cc793edc9b2e75ad75c4521025ce48c50be23'\nSOURCE_FILES=frozenset")
replace('r2_contract.py',"{'qualified-build-receipt.json','qualified-image-inspect.json','source-index.json'","{'prior-r2-render-refusal.json','qualified-build-receipt.json','qualified-image-inspect.json','source-index.json'")
replace('r2_contract.py',"validate_build(files['qualified-build-receipt.json'],files['qualified-image-inspect.json']);validate_rule_authorities(files)","validate_build(files['qualified-build-receipt.json'],files['qualified-image-inspect.json']);validate_rule_authorities(files);validate_prior_render_failure(files['prior-r2-render-refusal.json'])")
texts['r2_contract.py']+='''

def render_remote_source(template,values):
    """One simultaneous replacement; a value can never be reprocessed as a token."""
    require(type(template) is str and type(values) is dict,'Exact template/mapping required')
    pattern=re.compile(r'\\b[A-Z][A-Z0-9_]*_VALUE\\b')
    tokens=set(pattern.findall(template));require(tokens and tokens==set(values),'Missing/unknown/extra remote template token')
    require(all(type(v) is str for v in values.values()),'Rendered expressions must be explicit strings')
    rendered=pattern.sub(lambda match:values[match.group(0)],template)
    compile(rendered,'reviewed-r2-generated-remote.py','exec')
    return rendered

def validate_prior_render_failure(raw):
    require(sha(raw)==PRIOR_RENDER_FAILURE_SHA,'Exact published prior R2 failure required')
    value=json_exact(raw)
    require(value.get('status')=='R2_REMOTE_SOURCE_PARSE_REFUSED_BEFORE_ANY_ROOT_UNIT_OR_CACHE_OPERATION' and value.get('rootAbsent') is True and value.get('unitNotFound') is True and value.get('cacheOperations')==0 and value.get('neverRetryThisGraphRootOrLauncher') is True,'Prior R2 refusal cannot be retried/reclassified')
'''
for n in ['prepare_r2.py']:
    replace(n,oldrel,'WP/r2-cache-cap-render-acc15844-20261015/')
replace('prepare_r2.py',"validate_build(files['qualified-build-receipt.json'],files['qualified-image-inspect.json'])","validate_build(files['qualified-build-receipt.json'],files['qualified-image-inspect.json'])\n    files['prior-r2-render-refusal.json']=raw_git(PRIOR_RENDER_FAILURE_AUDIT,PRIOR_RENDER_FAILURE_PATH)[0];validate_prior_render_failure(files['prior-r2-render-refusal.json'])")
replace('launch_r2.py','for k,v in replacements.items():create=create.replace(k,v)','create=render_remote_source(create,replacements)')
replace('launch_r2.py',"for k,v in {**replacements,'HASHES_VALUE':repr(hashes)}.items():unit_code=unit_code.replace(k,v)","unit_code=render_remote_source(unit_code,{**{k:replacements[k] for k in ['ROOT_VALUE','UNIT_VALUE','FLOOR_VALUE','RESERVE_VALUE']},'HASHES_VALUE':repr(hashes)})")
newtests='''
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
        template='root=ROOT_VALUE\\nbuild=BUILD_ROOT_VALUE\\n'
        values={'ROOT_VALUE':repr(ROOT),'BUILD_ROOT_VALUE':repr(BUILD_ROOT)}
        rendered=render_remote_source(template,values);self.assertEqual(rendered,render_remote_source(template,dict(reversed(list(values.items())))))
        target={};exec(compile(rendered,'pure-literal-assignment','exec'),{},target);self.assertEqual(target,{'root':ROOT,'build':BUILD_ROOT})
    def test_48_missing_extra_or_invalid_render_refuses_before_ssh(self):
        for values in [{},{'ROOT_VALUE':repr(ROOT),'EXTRA_VALUE':'1'},{'ROOT_VALUE':"'unterminated"}]:self.assertRaises((RuntimeError,SyntaxError),render_remote_source,'root=ROOT_VALUE',values)
    def test_49_original_actual_render_syntax_failure_preserved(self):
        self.assertRaises(SyntaxError,compile,REFERENCE_RAW_FILES['failed-r2-upload-source.py'],'actual-original-failed-script','exec')
        validate_prior_render_failure(REFERENCE_RAW_FILES['prior-r2-render-refusal.json'])
    def test_50_new_root_and_no_sequential_replace_or_old_replay(self):
        self.assertTrue(ROOT.endswith('T213000Z'));self.assertNotIn('T210000Z',ROOT)
        launcher=SOURCE_RAW_FILES['launch_r2.py'].decode();self.assertNotIn('create=create.replace',launcher);self.assertNotIn('unit_code=unit_code.replace',launcher)
        self.assertEqual(launcher.count('render_remote_source('),2)
        self.rejected(validate_prior_render_failure,b'{}')
'''
replace('verify_r2.py',"if __name__=='__main__':unittest.main(verbosity=2)",newtests+"\nif __name__=='__main__':unittest.main(verbosity=2)")
replace('verify_r2.py',"'authority-source-preparation-once'/'" if False else "'authority-source-preparation-once'/n","'source-preparation-once'/n")
replace('verify_r2.py',"for n in ['build-receipt.json','image-inspect-original.json']","for n in ['build-receipt.json','image-inspect-original.json','failed-r2-upload-source.py','prior-r2-render-refusal.json']")
for n,text in texts.items():ast.parse(text,filename=n,feature_version=(3,9))
assert texts['r2_cache.py'].encode()==raws['r2_cache.py']
S.mkdir();D.mkdir()
def save(p,v):
    with p.open('xb') as f:f.write(v)
for n,v in raws.items():save(D/('before-'+n),v)
for n,text in texts.items():save(S/n,text.encode())
for filename in ['build-receipt.json','image-inspect-original.json']:
    save(D/filename,subprocess.check_output(['git','show','5f86a1966af536f83a345ebdb02983bbe2a166ad:WP/batch-build-stable-accounting-be837974-20261015/first-build-190000-closed-originals-once/'+filename],cwd=R))
save(D/'failed-r2-upload-source.py',subprocess.check_output(['git','show','2eb6534ccd5957a818e6fc2f76d41523c3aaccef:'+oldrel+'launch-reviewed-r2-once/exclusive-root-upload-source.py'],cwd=R))
save(D/'prior-r2-render-refusal.json',subprocess.check_output(['git','show','2eb6534ccd5957a818e6fc2f76d41523c3aaccef:'+oldrel+'first-launch-210000-closed-render-refusal-publication-once/closed-render-refusal.json'],cwd=R))
print('Prepared COMPLETE new five-file R2 render correction SOURCE ONLY; cache operator byte-identical; no package/host/cache execution.')
