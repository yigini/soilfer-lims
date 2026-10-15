"""Complete self-contained R2 authority from pinned raw references; SOURCE ONLY."""
import ast,hashlib,json,pathlib,subprocess
R=pathlib.Path(__file__).resolve().parents[2];S=R/'WP/r2-cache-cap-acc15844-20261015';D=S/'authority-source-preparation-once'
assert not D.exists();D.mkdir()
def save(n,v):
    with (D/n).open('xb') as f:f.write(v)
old=(R/'WP/batch-build-stable-accounting-be837974-20261015/batch_build_contract.py').read_text()
tree=ast.parse(old);functions={n.name:ast.get_source_segment(old,n) for n in tree.body if isinstance(n,ast.FunctionDef)}
constants={}
for n in tree.body:
    if isinstance(n,ast.Assign) and len(n.targets)==1 and isinstance(n.targets[0],ast.Name) and n.targets[0].id in ['AUDITS','RULE_AUTHORITY_PINS']:
        text=ast.get_source_segment(old,n)
        if n.targets[0].id=='AUDITS':text=text.replace("'merge':CANDIDATE","'merge':'be8379745bdfae52ce46496ff26514dc7d729640'")
        constants[n.targets[0].id]=text
newcomments={}
for ident in ['6198899941','6200547786']:
    if ident=='6198899941':raw=(R/'WP/host-capacity-r1-amendment-6198899941-20261015/actual-amendment-original.json').read_bytes()
    else:raw=(S/'interface-and-new-direction-readonly-once/actual-claudio6200547786-original.json').read_bytes()
    v=json.loads(raw);assert v['id']==int(ident) and v['created_at']==v['updated_at'] and v['performed_via_github_app']['id']==1236702
    projection={k:v[k] for k in ['id','body','created_at','updated_at']};projection['app']={k:v['performed_via_github_app'][k] for k in ['id','slug']}
    newcomments[ident]=hashlib.sha256(json.dumps(projection,sort_keys=True,separators=(',',':'),ensure_ascii=False).encode()).hexdigest()
    save('authority-'+ident+'-original.json',raw)
p=S/'r2_contract.py';before=p.read_bytes();save('r2_contract-before-authority-completion.py',before)
text=before.decode().replace("AUDITS=[] # Populated from the unchanged, previously published authority below.",constants['AUDITS']).replace('RULE_AUTHORITY_PINS={}',constants['RULE_AUTHORITY_PINS']+'\nRULE_AUTHORITY_PINS.update('+repr(newcomments)+')')
text+='\n\n'+functions['validate_current'].replace('build refuses','R2 refuses')+'\n\n'+functions['validate_rule_authorities']+'\n'
ast.parse(text,feature_version=(3,9));p.write_bytes(text.encode())
for filename in ['build-receipt.json','image-inspect-original.json']:
    path='WP/batch-build-stable-accounting-be837974-20261015/first-build-190000-closed-originals-once/'+filename
    raw=subprocess.check_output(['git','show','5f86a1966af536f83a345ebdb02983bbe2a166ad:'+path],cwd=R)
    save(filename,raw)
save('preparation-record.json',(json.dumps({'status':'SOURCE_ONLY_COMPLETE_SELF_CONTAINED_AUTHORITY','newAuthoritySemanticSha256':newcomments,'sourceChangesOutsideR2Folder':0,'operatorsExecuted':0},indent=2)+'\n').encode())
print(json.dumps({'status':'SOURCE_ONLY_AUTHORITY_COMPLETED','newSemanticPins':newcomments,'cacheOperations':0}))
