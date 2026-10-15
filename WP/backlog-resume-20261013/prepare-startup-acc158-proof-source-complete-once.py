"""SOURCE ONLY: create a new proof graph, retaining every predecessor byte."""
import ast, hashlib, json, pathlib, re, subprocess, sys
sys.stdout.reconfigure(encoding='utf-8')
repo=pathlib.Path(__file__).resolve().parents[2]
old=repo/'WP/batch-proof-health-transitions-cde8-20261015'
new=repo/'WP/batch-proof-startup-be837974-20261015'
assert not new.exists(), 'New source namespace consumed'
new.mkdir()
before=new/'source-preparation-before';before.mkdir()
names=['proof_budget.py','proof_contract.py','proof_disk.py','proof_docker.py','proof_files.py','proof_health.py','proof_inputs.py','proof_startup.py','run_stopped_proof.py','prepare_proof.py','launch_proof.py','verify_proof_guards.py']
sources={n:(old/n).read_bytes() for n in names}
for n,b in sources.items():(before/n).write_bytes(b)
def put(n,s):
    if n.endswith('.py'):compile(s,n,'exec')
    (new/n).write_bytes(s.encode())
def change(s,a,b):
    assert a in s,a[:100]
    return s.replace(a,b)
head='be8379745bdfae52ce46496ff26514dc7d729640'
tree='676b01e71211786d1aeace50f19a0b2c9f9c482e'
image='sha256:acc158447f5571068bf150fc0e8fa6f0889aeb38f9aec8be08978d903bd5be6a'
s=sources['proof_contract.py'].decode()
for a,b in [("CANDIDATE='cde8c8896f5f9d5f1ab07b0ae16b1a765e0a6367'","OLD_INPUT_CANDIDATE='cde8c8896f5f9d5f1ab07b0ae16b1a765e0a6367'\nCANDIDATE="+repr(head)),("TREE='638580d50f61254609de3abd42d93afc676a5727'","OLD_INPUT_TREE='638580d50f61254609de3abd42d93afc676a5727'\nTREE="+repr(tree)),("IMAGE='sha256:b5ab0a0a57aeec4fe24dd8095126f3502cbc0c8629a7f4c1ef9e55034893c6fb'","OLD_INPUT_IMAGE='sha256:b5ab0a0a57aeec4fe24dd8095126f3502cbc0c8629a7f4c1ef9e55034893c6fb'\nIMAGE="+repr(image)),('workflow-batch-build-cde8c889-20261015T010000Z','workflow-batch-build-be837974-20261015T190000Z'),('c03ca0cd16395a451a12f1606655166f0dfe0b3f78516212034b548888c7a3fd','cd3a2757d8ecb0bf933f49231031eb7fb61eb5abaac17d05f3585c1baaf89f0a'),('6608548a58dd4bf581da4330f1cd7b0f68a86973','4de3e334d8e498783a4cf20df4a5f93acfdbeb21'),('BUILD_PASS=6181452519','BUILD_PASS=6200145007'),('b1d68199ec356d744950f801515874e6a7096474','5f86a1966af536f83a345ebdb02983bbe2a166ad'),('workflow-batch-startup-forward-cde8c889-20261015T100000Z','workflow-batch-startup-be837974-20261015T230000Z'),('MAIN_CI=38636615469','MAIN_CI=38772398721'),("'cde8c8896f5f9d5f1ab07b0ae16b1a765e0a6367',CANDIDATE)","'cde8c8896f5f9d5f1ab07b0ae16b1a765e0a6367',CANDIDATE)")]:
    if a!=b:s=change(s,a,b)
s=change(s,"'6bd516c42a07332d0b0653ed150d1526bf7e424e',CANDIDATE)]","'6bd516c42a07332d0b0653ed150d1526bf7e424e',OLD_INPUT_CANDIDATE),(298,6195167175,'eba02837eaa2ab797cad0572fecada686f660346',CANDIDATE)]")
s=change(s,"'proof_contract.py'})","'proof_contract.py','proof_app_sources.py','proof_render.py'})")
s=change(s,"review.get('id',0)>6188190365 and review.get('performed_via_github_app',{}).get('slug')=='claude'","review.get('id',0)>6202252017 and review.get('performed_via_github_app',{}).get('id')==1236702 and review.get('performed_via_github_app',{}).get('slug')=='claude'")
s=change(s,"review['created_at']>'2026-10-15T08:47:44Z'","review['created_at']>'2026-10-15T21:04:54Z'")
s=change(s,"v.get('performed_via_github_app',{}).get('slug')=='claude'","v.get('performed_via_github_app',{}).get('id')==1236702 and v.get('performed_via_github_app',{}).get('slug')=='claude'")
s=change(s,'BUILT_AFTER_EXCLUDED_ACCOUNTING_FAILURE_NOT_PROVED_OR_DEPLOYED','NEW_STARTUP_APP_IMAGE_BUILT_NOT_PROVED_OR_DEPLOYED')
s=change(s,'==414679214','==414683521')
s=change(s,"'containerMountComparison=EXACT_OBJECTS_UNORDERED_NO_DUPLICATES']","'containerMountComparison=EXACT_OBJECTS_UNORDERED_NO_DUPLICATES','r4AdditionalHeadroomBytes=10000000000','futurePackageChargedBeforeRootOnly=true','fixedStartupSchemaAndMarkersBudgeted=true','applicationCopySourcesSha256='+APP_PINS_SHA,'applicationPolicySnapshotMaximumPerStartup=8','newImageSeparateFromOldInputAuthority=true','oneProofAttemptNoRetry=true','renderAllRemoteTemplatesBeforeAnySsh=true','r2AcceptedComment=6202252017','r2CompleteNoFurtherPrune=true']")
s=change(s,'from proof_budget import TABLE', 'from proof_app_sources import APP_PINS_SHA\nfrom proof_budget import TABLE')
put('proof_contract.py',s)
s=sources['proof_inputs.py'].decode()
s=change(s,"spec['head']==CANDIDATE and spec['tree']==TREE and spec['image']==IMAGE","spec['head']==OLD_INPUT_CANDIDATE and spec['tree']==OLD_INPUT_TREE and spec['image']==OLD_INPUT_IMAGE")
put('proof_inputs.py',s)
for n in ['proof_files.py','proof_health.py','proof_startup.py']:
    put(n,sources[n].decode())
put('proof_docker.py',sources['proof_docker.py'].decode().replace('Only NEW b5 containers','Only NEW qualified acc158 containers'))
# Pin the startup entrypoints, every installer/CLI/utility, and their complete
# literal relative-require closure. Source hashes are authority; regex inventories
# additionally explain the conservative call bound without assuming cache hits.
rows=subprocess.check_output(['git','ls-tree','-rz',head],cwd=repo).split(b'\0')
allrows={r.split(b'\t')[1].decode():r.split(b'\t')[0].decode().split() for r in rows if r}
paths={n for n in allrows if n in ['Dockerfile','docker-entrypoint.sh','server/index.js','server/prisma/schema.prisma'] or n.startswith(('server/scripts/','server/utils/')) and n.endswith(('.js','.json','.sql'))}
raws={}
pending=list(paths)
while pending:
    n=pending.pop()
    if n in raws:continue
    b=subprocess.check_output(['git','cat-file','blob',allrows[n][2]],cwd=repo);raws[n]=b
    if not n.endswith('.js'):continue
    for target in re.findall(r"require\(\s*['\"](\.[^'\"]+)['\"]\s*\)",b.decode()):
        base=(pathlib.PurePosixPath(n).parent/target).as_posix()
        # PurePosixPath preserves '..'; normalize without touching the filesystem.
        import posixpath
        base=posixpath.normpath(base)
        candidates=[base,base+'.js',base+'.json',base+'/index.js']
        found=next((p for p in candidates if p in allrows),None)
        if found and found not in raws:paths.add(found);pending.append(found)
pins={n:{'bytes':len(b),'sha256':hashlib.sha256(b).hexdigest(),'blob':allrows[n][2],'mode':allrows[n][0]} for n,b in sorted(raws.items())}
fixtures=new/'application-source-fixtures';fixtures.mkdir()
for n,b in raws.items():
    dest=fixtures/n;dest.parent.mkdir(parents=True,exist_ok=True);dest.write_bytes(b)
app='''"""Exact new application sources and conservative startup snapshot derivation."""
import hashlib,json,pathlib,re
APP_PINS=PINS_LITERAL
APP_PINS_SHA=hashlib.sha256(json.dumps(APP_PINS,sort_keys=True,separators=(',',':')).encode()).hexdigest()
SCHEMA_BYTES=APP_PINS['server/prisma/schema.prisma']['bytes']
POLICY_MAX_PER_STARTUP=8
def need(ok,message):
    if not ok:raise RuntimeError(message)
def validate_sources(raws,manifest=None):
    need(set(raws)==set(APP_PINS),'Complete application copy-source graph required')
    for n,p in APP_PINS.items():
        b=raws[n];need(isinstance(b,bytes) and len(b)==p['bytes'] and hashlib.sha256(b).hexdigest()==p['sha256'] and hashlib.sha1(('blob '+str(len(b))+'\\0').encode()+b).hexdigest()==p['blob'],'Application source changed '+n)
        if manifest is not None:
            r=manifest.get(n,{});need(all(r.get(k)==p[k] for k in ['bytes','sha256','blob','mode']),'Qualified application manifest source differs '+n)
    text={n:b.decode('utf-8') for n,b in raws.items()}
    index=text['server/index.js'];entry=text['docker-entrypoint.sh']
    calls=re.findall(r"require\\(['\\\"]\\./scripts/([^'\\\"]+)['\\\"]\\)\\.assert[A-Za-z]+StartupReady\\(dbPath, startupContext\\)",index)
    events=re.findall(r"event\\s*:\\s*'([^']+_STARTUP_READY)'",index)
    cli=re.findall(r'^\\s*node scripts/([A-Za-z0-9_]+\\.js)\\b',entry,re.M)
    weights={'install_lab_policy_schema':1,'install_control_charts':1,'install_order_revisions':2}
    need(len(calls)==26 and len(set(calls))==26 and len(events)==len(set(events))==26,'All26 READY calls must share the private context')
    need(all('server/scripts/'+n+'.js' in raws for n in calls) and all('server/scripts/'+n in raws for n in cli),'Unbound CLI/READY source')
    need(sum(weights.get(n,0) for n in calls)==4 and sum(weights.get(n[:-3],0) for n in cli)==4,'Conservative entrypoint plus READY policy snapshot maximum changed')
    policy=text['server/scripts/install_lab_policy_schema.js'];charts=text['server/scripts/install_control_charts.js'];orders=text['server/scripts/install_order_revisions.js']
    need("for (const suffix of ['', '-wal', '-shm'])" in policy and policy.count('fs.copyFileSync(')==1 and policy.count('fs.mkdtempSync(')==1,'One policy DB triple producer required')
    need(charts.count('assertLabPolicyStartupReady(')==1 and orders.count('assertLabPolicyStartupReady(')==1 and orders.count('assertControlChartStartupReady(')==1,'Nested policy snapshot edges changed')
    producers=[n for n,s in text.items() if n.startswith('server/scripts/install_') and re.search(r'\\b(?:copyFileSync|copyFile|mkdtempSync|mkdtemp|backup)\\s*\\(',s)]
    need(producers==['server/scripts/install_lab_policy_schema.js'],'Undeclared installer copy producer')
    need('cp /app/server/.schema-backup/schema.prisma prisma/schema.prisma' in entry and SCHEMA_BYTES==89556,'Fixed schema copy budget changed')
    need('JWT_SECRET' in entry and '.seed_complete' in entry,'Startup fixed file paths changed')
    return {'entrypointPolicySnapshots':4,'readyPolicySnapshots':4,'maximumPolicyDbTriplesPerStartup':8,'cacheHitAssumed':False,'schemaCopyBytesPerStartup':SCHEMA_BYTES,'readyEvents':events,'readyModules':calls,'entrypointModules':cli,'sourceFiles':len(APP_PINS),'sourceGraphSha256':APP_PINS_SHA}
def sources_from_tree(root):
    root=pathlib.Path(root);out={}
    for n in APP_PINS:
        p=root/n
        for a in [p,*p.parents]:need(not a.is_symlink(),'Application source path alias')
        need(p.is_file(),'Application source missing '+n);out[n]=p.read_bytes()
    return out
'''.replace('PINS_LITERAL',repr(pins))
put('proof_app_sources.py',app)
# Bound synthetic input records are local/host guard-test fixtures, not proof inputs.
records=new/'bound-input-records';records.mkdir()
for p in (old/'bound-input-records').iterdir():
    if p.is_file():(records/p.name).write_bytes(p.read_bytes())
(new/'compose-source.yml').write_bytes((old/'compose-source.yml').read_bytes())
put('source-preparation-record.json',json.dumps({'sourceOnly':True,'oldSource':'a748b9dc5d3e5309fe3ef2b5cf4a6c5e7d796ef2','oldSourceBytes':{n:{'bytes':len(b),'sha256':hashlib.sha256(b).hexdigest()} for n,b in sources.items()},'newApp':head,'appPinnedFiles':len(pins),'operatorsExecuted':0,'serverOperations':0},indent=2)+'\n')
print(json.dumps({'newSource':str(new),'applicationPins':len(pins),'oldFilesRetained':len(sources),'operatorsExecuted':0}))
