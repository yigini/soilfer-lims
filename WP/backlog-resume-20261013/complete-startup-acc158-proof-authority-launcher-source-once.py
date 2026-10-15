"""Finish new source bindings only; no SSH/package/proof operator."""
import ast,hashlib,json,pathlib,sys
repo=pathlib.Path(__file__).resolve().parents[2]
p=repo/'WP/batch-proof-startup-be837974-20261015';old=repo/'WP/batch-proof-health-transitions-cde8-20261015'
def put(n,s):compile(s,n,'exec');(p/n).write_bytes(s.encode())
def change(s,a,b):assert a in s,a[:100];return s.replace(a,b)
r2=ast.parse((repo/'WP/r2-cache-api-identity-acc15844-20261015/r2_contract.py').read_bytes())
pins={}
for n in r2.body:
    if isinstance(n,ast.Assign) and any(isinstance(t,ast.Name) and t.id=='RULE_AUTHORITY_PINS' for t in n.targets):pins.update(ast.literal_eval(n.value))
    if isinstance(n,ast.Expr) and isinstance(n.value,ast.Call) and isinstance(n.value.func,ast.Attribute) and isinstance(n.value.func.value,ast.Name) and n.value.func.value.id=='RULE_AUTHORITY_PINS':pins.update(ast.literal_eval(n.value.args[0]))
assert len(pins)==6
s=(p/'proof_contract.py').read_text()
s=change(s,"+[n+'='+d for n,d in sorted(graph(index).items())]","+['authority'+i+'='+pin for i,pin in sorted(RULE_AUTHORITY_PINS.items())]+[n+'='+d for n,d in sorted(graph(index).items())]")
qualified_image=json.loads((repo/'WP/batch-build-stable-accounting-be837974-20261015/first-build-190000-closed-originals-once/image-inspect-original.json').read_bytes())[0]
canonical_image=hashlib.sha256(json.dumps(qualified_image,sort_keys=True,separators=(',',':'),ensure_ascii=False).encode()).hexdigest()
s=change(s,'def plan(value,issue,mode):',"    require(sha(canonical(inspect))=="+repr(canonical_image)+",'Entire qualified image object differs')\n    require(receipt.get('applicationIndexSha256')=='c7ee2de3e0cbad7aad9be99b8a74f5ddc070f033b70b9595b7f7c754e99156db','Qualified manifest SHA differs')\ndef plan(value,issue,mode):")
accept=json.loads((repo/'WP/r2-cache-api-identity-acc15844-20261015/actual-r2-result-accepted6202252017-once/actual-acceptance-original.json').read_bytes())
projection={k:accept[k] for k in ['id','body','created_at','updated_at']};projection['app']={k:accept['performed_via_github_app'][k] for k in ['id','slug']}
accepted_sha=hashlib.sha256(json.dumps(projection,sort_keys=True,separators=(',',':'),ensure_ascii=False).encode()).hexdigest()
s+='\nRULE_AUTHORITY_PINS='+repr(pins)+'\nR2_ACCEPTED_SHA='+repr(accepted_sha)+'''
def authority_projection(v):
    out={k:v[k] for k in ['id','body','created_at','updated_at']};app=v.get('performed_via_github_app') or {};out['app']={'id':app.get('id'),'slug':app.get('slug')};return out
def rule_authorities(rules,accepted):
    require(set(rules)==set(RULE_AUTHORITY_PINS),'Complete six current rule authorities required')
    for i,pin in RULE_AUTHORITY_PINS.items():
        v=rules[i];require(v['id']==int(i) and sha(canonical(authority_projection(v)))==pin,'Current rule authority changed '+i)
    require(accepted['id']==6202252017 and sha(canonical(authority_projection(accepted)))==R2_ACCEPTED_SHA,'Actual accepted R2 boundary changed; no further R2 authority')
'''
put('proof_contract.py',s)
s=(old/'prepare_proof.py').read_text()
s=change(s,"REL='WP/batch-proof-health-transitions-cde8-20261015/'","REL='WP/batch-proof-startup-be837974-20261015/'")
s=change(s,"BUILD_REL='WP/batch-build-containerd-cde8-20261015/first-build-010000-closed-success/'","BUILD_REL='WP/batch-build-stable-accounting-be837974-20261015/first-build-190000-closed-originals-once/'\nBUILD_INDEX='WP/batch-build-stable-accounting-be837974-20261015/build-package-workflow-batch-build-be837974-20261015T190000Z/source-index.json'")
s=change(s,'from proof_files import write_new','from proof_files import write_new\nfrom proof_app_sources import APP_PINS,validate_sources')
s=change(s,"    current(out['main']", "    out['rules']={i:gh('repos/yigini/soilfer-lims/issues/comments/'+i) for i in RULE_AUTHORITY_PINS};out['r2Accepted']=gh('repos/yigini/soilfer-lims/issues/comments/6202252017');rule_authorities(out['rules'],out['r2Accepted'])\n    current(out['main']")
s=change(s,"raw,_=raw_git(BUILD_EVIDENCE,BUILD_REL+n)","raw,_=raw_git(BUILD_EVIDENCE,BUILD_INDEX if n=='source-index.json' else BUILD_REL+n)")
start=s.index('    application=');end=s.index('    index_source=',start)
s=s[:start]+"    application=sorted(APP_PINS);appraw=raw_git_many(CANDIDATE,application);derivation=validate_sources(appraw,{r['path']:r for r in manifest['entries']})\n"+s[end:]
s=change(s,"'applicationSourceFiles':application,","'applicationSourceFiles':application,'applicationCopyDerivation':derivation,'retryAllowed':False,")
pos=s.index('def current_evidence(')
s=s[:pos]+'''def raw_git_many(head,paths):
    rows=command('git','ls-tree','-rz',head).split(b'\\0');inventory={r.split(b'\\t')[1].decode():r.split(b'\\t')[0].decode().split() for r in rows if r}
    require(all(n in inventory and inventory[n][0] in ['100644','100755'] and inventory[n][1]=='blob' for n in paths),'Complete regular application source graph required')
    ids=[inventory[n][2] for n in paths];raw=subprocess.check_output(['git','cat-file','--batch'],cwd=REPO,input=('\\n'.join(ids)+'\\n').encode());offset=0;out={}
    for name,oid in zip(paths,ids):
        end=raw.index(b'\\n',offset);given,kind,size=raw[offset:end].decode().split();size=int(size);offset=end+1;data=raw[offset:offset+size];offset+=size
        require(given==oid and kind=='blob' and len(data)==size and raw[offset:offset+1]==b'\\n' and hashlib.sha1(('blob '+str(size)+'\\0').encode()+data).hexdigest()==oid,'Raw Git application source identity differs');offset+=1;out[name]=data
    require(offset==len(raw),'Expanded raw Git response');return out
'''+s[pos:]
put('prepare_proof.py',s)
s=(old/'run_stopped_proof.py').read_text()
s=change(s,'from proof_health import load_health','from proof_health import load_health\nfrom proof_app_sources import APP_PINS,validate_sources,sources_from_tree\nfrom proof_budget import capacity_probe_source,capacity_gate')
s=change(s,"evidence['comments'])","evidence['comments']);rule_authorities(evidence['rules'],evidence['r2Accepted'])")
s=change(s,"    for n in spec['applicationSourceFiles']:","    require(set(spec['applicationSourceFiles'])==set(APP_PINS) and spec.get('retryAllowed') is False,'Exact source graph and one attempt required')\n    derivation=validate_sources(sources_from_tree(pathlib.Path(BUILD_ROOT)/'source'),rows);require(derivation==spec['applicationCopyDerivation'],'Application copy derivation changed')\n    for n in spec['applicationSourceFiles']:")
s=change(s,"        disk.bind(db_bytes,assets['allocatedBytes']);installed", "        capacity_raw=subprocess.check_output(['/usr/bin/python3','-B','-'],input=capacity_probe_source(PRIOR_RAW_DATA,PRIOR_RAW_ASSETS,PRIOR_BACKUP,'RUNTIME_BIND'),timeout=45)\n        capacity=exact_json(capacity_raw);write_new(root/'fresh-r4-before-proof-copies.json',capacity);capacity_gate(capacity,'RUNTIME_BIND',0)\n        require(capacity['databaseReserveBytes']==db_bytes and capacity['assetReserveBytes']==assets['allocatedBytes'],'Fresh stat and fullhash input allocation differ')\n        disk.bind(db_bytes,assets['allocatedBytes']);installed")
put('run_stopped_proof.py',s)
s=(old/'proof_disk.py').read_text()
s=change(s,'from proof_budget import Budget,TABLE,DB_EQUIVALENTS,TOTAL_DB_COPIES','from proof_budget import Budget,TABLE,DB_EQUIVALENTS,TOTAL_DB_COPIES,ADDITIONAL_BYTES,collect_hardware,hardware_gate')
s=change(s,'self.required=FLOOR+LOG_RESERVE;','self.required=FLOOR+LOG_RESERVE+ADDITIONAL_BYTES;self.hardware_devices=None;')
s=change(s,"        require(all(pathlib.Path(p).is_dir() and not pathlib.Path(p).is_symlink() and shutil.disk_usage(p).free>=self.required for p in BOUND),'Measured/scaled reserve STOP')","        hardware=collect_hardware();free=hardware_gate(hardware);devices={p:r['device'] for p,r in hardware.items()}\n        if self.hardware_devices is None:self.hardware_devices=devices\n        require(devices==self.hardware_devices and free>=self.required,'Measured/scaled reserve STOP')")
put('proof_disk.py',s)
print(json.dumps({'sourceOnly':True,'newAuthorityRules':len(pins),'r2AcceptedSemanticSha256':accepted_sha,'operatorsExecuted':0}))

