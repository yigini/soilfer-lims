"""SOURCE/retention only. No SSH, SQL, package preparation or operator."""
import ast,datetime,hashlib,json,pathlib,subprocess
R=pathlib.Path(__file__).resolve().parents[2]
S=R/'WP/batch-proof-jobs-intake-be837974-20261016'
D=R/'WP/jobs-row-diagnostic-be837974-20261016'
def raw(*a):return subprocess.check_output(a,cwd=R)
def canon(v):return json.dumps(v,sort_keys=True,separators=(',',':'),ensure_ascii=False).encode()
def sha(v):return hashlib.sha256(v).hexdigest()
assert raw('git','rev-parse','HEAD').decode().strip()=='00ada89acb5faf4909d8907a066bef2f38be569f'
assert raw('git','branch','--show-current').decode().strip()=='audit/release-eb6de2e8' and not raw('git','diff','--cached','--name-only').strip() and not D.exists()
D.mkdir();A=D/'scope-answer6205842415-originals-once';A.mkdir()
captures=[]
def gh(p):
 i=len(captures);result=subprocess.run(['gh','api',p],cwd=R,capture_output=True,timeout=90)
 for n,b in [('json',result.stdout),('stderr',result.stderr),('command.json',canon({'argv':['gh','api',p],'exitCode':result.returncode}))]:(A/('api-'+str(i).zfill(2)+'.'+n)).write_bytes(b)
 captures.append(p);assert result.returncode==0
 return json.loads(result.stdout)
answer=gh('repos/yigini/soilfer-lims/issues/comments/6205842415')
assert answer['created_at']==answer['updated_at']=='2026-10-16T01:20:31Z' and answer['performed_via_github_app']['id']==1236702 and answer['performed_via_github_app']['slug']=='claude'
assert answer['body'].startswith('Scope answer: Step 1 diagnostic may use the exact-empty-WAL exception')
(A/'actual-answer-original.json').write_bytes(canon(answer)+b'\n');(A/'actual-answer-readable.txt').write_bytes(answer['body'].encode())
oldscope=gh('repos/yigini/soilfer-lims/issues/comments/6205724552')
for v in [answer,oldscope]:
 assert v['created_at']==v['updated_at'] and v['performed_via_github_app']['id']==1236702
def projection(v):return {**{k:v[k] for k in ['id','body','created_at','updated_at']},'app':{k:v['performed_via_github_app'][k] for k in ['id','slug']}}
pins={str(v['id']):sha(canon(projection(v))) for v in [answer,oldscope]}
t=(S/'proof_contract.py').read_text();tree=ast.parse(t)
names={'OLD_INPUT_CANDIDATE','CANDIDATE','TREE','MAIN_CI','AUDITS','RULE_AUTHORITY_PINS','R2_ACCEPTED_SHA','POST_REBOOT_PINS','MEMORY_DIRECTION_SHA','JOBS_SCOPE_SHA'}
funcs={'require','sha','canonical','exact_json','first_line','authority_projection','current','rule_authorities','post_reboot_authorities','memory_authority','jobs_scope_authority'}
parts=['"""Fresh GitHub authority guards for a new diagnostic; pure on import."""','import hashlib,json,re']
for v in tree.body:
 if isinstance(v,ast.Assign) and any(isinstance(n,ast.Name) and n.id in names for n in v.targets) or isinstance(v,ast.FunctionDef) and v.name in funcs:parts.append(ast.get_source_segment(t,v))
parts.append('DIAGNOSTIC_SCOPE_PINS='+repr(pins))
parts.append('''
def diagnostic_scopes(values):
    require(set(values)==set(DIAGNOSTIC_SCOPE_PINS),'Both actual diagnostic directions required')
    for i,pin in DIAGNOSTIC_SCOPE_PINS.items():
        v=values[i];require(v['id']==int(i) and v['created_at']==v['updated_at'] and v.get('performed_via_github_app',{}).get('id')==1236702 and v.get('performed_via_github_app',{}).get('slug')=='claude' and sha(canonical(authority_projection(v)))==pin,'Diagnostic scope changed')
''')
(D/'diagnostic_authority.py').write_bytes(('\n\n'.join(parts)+'\n').encode())
ret=json.loads((S/'actual-result-accepted6205724552-empty-wal-boundary-once/scope-boundary-record.json').read_bytes())
O=S/'jobs003000-closed-row-refusal-originals-once/remote-originals'
records={}
for n in ['upstream-first-completion.json','startup-1-stopped-seal/logical-state.json']:
 b=(O/n).read_bytes();p=D/('first-fetch-original.json' if n.startswith('upstream') else 'baseline-logical-original.json');p.write_bytes(b)
 records[p.name]={'bytes':len(b),'sha256':sha(b),'originPath':str((O/n).relative_to(R)).replace('\\','/'),'originCommit':'b73a299bc10f79e41b6e52d78d65c7cce4e8ece7'}
sourcePins=ret['appSourceComparison']
for n in sourcePins:
 b=raw('git','show','be8379745bdfae52ce46496ff26514dc7d729640:'+n['path']);assert sha(b)==n['sha256']
 p=D/'application-source-originals'/n['path'];p.parent.mkdir(parents=True,exist_ok=True);p.write_bytes(b)
data={'inputPins':ret['sixInputFilePinsFromOriginalClosedRetention'],'recordPins':records,'applicationPins':sourcePins,'scopePins':pins,'scopeId':6205842415,'scopeIsNotSourcePass':True}
(D/'diagnostic-pins.json').write_bytes(canon(data)+b'\n')
frozen=json.loads((R/'WP/startup-order-readiness-20261015/full-pinned-copy-retention-bound-ordinary-once/source-before.json').read_bytes());assert len(frozen)==1333 and all(sha((R/n).read_bytes())==h for n,h in frozen.items())
old=O/'tooling-source-index.json';idx=json.loads(old.read_bytes());assert len(idx['files'])==26
assert all(sha((S/n).read_bytes())==v['sha256'] for n,v in idx['files'].items())
(A/'retention-record.json').write_bytes(canon({'retainedUtc':datetime.datetime.now(datetime.timezone.utc).isoformat(),'scopeBodySha256':sha(answer['body'].encode()),'scopeSemanticSha256':pins['6205842415'],'scopePins':pins,'all26And1333Unchanged':True,'hostCalls':0,'sqlConnections':0,'operatorCalls':0,'sourceOnly':True,'earlierReadOnlyConsoleUnicodeError':'One source inspection printed a non-ASCII arrow to cp1252 and failed locally before later source reads; no host/SQL/action ran. Subsequent JSON-safe inspection completed.'})+b'\n')
print(json.dumps({'status':'SCOPE_RETAINED_NEW_DIAGNOSTIC_SOURCE_SEED_ONLY','scope':answer['id'],'scopePin':pins['6205842415'],'filesCreated':len(list(D.rglob('*'))),'hostCalls':0,'sqlConnections':0}))
