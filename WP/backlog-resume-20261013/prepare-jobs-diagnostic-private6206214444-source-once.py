"""Retain actual findings and create a distinct source-only privacy successor."""
import ast,datetime,hashlib,json,pathlib,subprocess,sys
R=pathlib.Path(__file__).resolve().parents[2]
OLD=R/'WP/jobs-row-diagnostic-be837974-20261016'
S=R/'WP/jobs-row-diagnostic-private-be837974-20261016'
D=S/'actual-findings6206214444-and-preparation-once'
BASE='3228b0b2857b915c5ba1f4945fcdd6d34f6f9bdf'
def sha(b):return hashlib.sha256(b).hexdigest()
def canonical(v):return json.dumps(v,sort_keys=True,separators=(',',':'),ensure_ascii=False).encode()
def git(*a):return subprocess.check_output(['git','-c','core.longpaths=true',*a],cwd=R)
assert git('rev-parse','HEAD').decode().strip()==BASE and not git('diff','--cached','--name-only').strip() and not S.exists()
S.mkdir();D.mkdir();A=D/'api-originals';A.mkdir();records=[]
sys.path.insert(0,str(OLD));import prepare_diagnostic as oldprep
original_command=oldprep.command
def capture(*args):
 if args[:2]!=('gh','api'):return original_command(*args)
 i=len(records);p=subprocess.run(args,cwd=R,capture_output=True,timeout=90)
 for suffix,b in [('stdout.json',p.stdout),('stderr',p.stderr),('command.json',canonical({'argv':args,'exitCode':p.returncode}))]:(A/(str(i).zfill(2)+'-'+suffix)).write_bytes(b)
 records.append(args);assert p.returncode==0,'Read failure is not no answer';return p.stdout
oldprep.command=capture
review=json.loads(capture('gh','api','repos/yigini/soilfer-lims/issues/comments/6206214444'))
assert review['id']==6206214444 and review['created_at']==review['updated_at']=='2026-10-16T01:51:11Z'
assert review['performed_via_github_app']['id']==1236702 and review['performed_via_github_app']['slug']=='claude'
assert review['body'].startswith('Source review: changes required (Step 1 row diagnostic at bb2d337dc4e39021bf413dbe31c2749bb02da65a)')
(D/'actual-findings-original.json').write_bytes(canonical(review)+b'\n');(D/'actual-findings-body.txt').write_bytes(review['body'].encode())
projection=oldprep.authority_projection(review);semantic=sha(canonical(projection))
index=json.loads((OLD/'exact-source-review80-git-aware-once/source-index.json').read_bytes());oldprep.published(index)
pub=json.loads((OLD/'source80-publication-once/publication-index.json').read_bytes());verified=[]
for pin in pub['bindings']:
 b=git('show',index['head']+':'+pin['path']);assert len(b)==pin['bytes'] and sha(b)==pin['sha256']
 verified.append({**pin,'blob':git('rev-parse',index['head']+':'+pin['path']).decode().strip()})
assert len(verified)+1==184
(D/'all184-prior-source-publication-verification.json').write_bytes(canonical({'sourceHead':index['head'],'bindings':verified,'indexSha256':sha((OLD/'source80-publication-once/publication-index.json').read_bytes()),'verifiedFilesIncludingIndex':184})+b'\n')
evidence=oldprep.current_evidence();assert any(c['id']==review['id'] and c['body']==review['body'] for c in evidence['sourceComments'])
(D/'fresh-current-authority.json').write_bytes(canonical(evidence)+b'\n')
for n in sorted(set(index['files'])|set(index['data'])):
 b=(OLD/n).read_bytes();(S/n).write_bytes(b)
 if n.endswith('.py'):(D/(n+'.before')).write_bytes(b)
pins=json.loads((S/'diagnostic-pins.json').read_bytes())
for pin in pins['applicationPins']:
 p=S/'application-source-originals'/pin['path'];p.parent.mkdir(parents=True,exist_ok=True);p.write_bytes(git('show',oldprep.CANDIDATE+':'+pin['path']))
def edit(n,old,new):
 p=S/n;s=p.read_text(encoding='utf-8');assert s.count(old)==1,(n,old[:100],s.count(old));p.write_bytes(s.replace(old,new).encode())
edit('diagnostic_contract.py','import json,hashlib,pathlib,re','import json,hashlib,hmac,pathlib,re')
edit('diagnostic_contract.py','20261016T020000Z','20261016T023000Z')
edit('diagnostic_contract.py','20261016t020000z','20261016t023000z')
edit('diagnostic_contract.py','def value_hash(v):return sha(canonical(projection(v)))', '''_value_key=None
def install_value_key(key):
    global _value_key
    require(_value_key is None and type(key) is bytes and len(key)==32,'Fresh 32-byte public hash key required')
    _value_key=key

def value_hash(v):
    require(type(_value_key) is bytes and len(_value_key)==32,'Public value hash key not initialized')
    return hmac.new(_value_key,canonical(projection(v)),hashlib.sha256).hexdigest()

def public_failure(error):
    # Only audited static messages and literal key names may be public text.
    # Dynamic parse/SQLite/OS exception text always remains keyed evidence.
    if type(error) is RuntimeError and str(error) in STATIC_REASONS:
        return {'errorType':'RuntimeError','reason':str(error)}
    if type(error) is KeyError and len(error.args)==1 and type(error.args[0]) is str and error.args[0] in LITERAL_KEYS:
        return {'errorType':'KeyError','reason':'Missing literal key: '+error.args[0]}
    return {'errorType':type(error).__name__,'errorHmacSha256':value_hash(str(error))}
''')
edit('diagnostic_contract.py',"'scopeAnswerId=6205842415'","'scopeAnswerId=6205842415','privacyFindingsId=6206214444'")
edit('diagnostic_contract.py',"'privateRawPublicHashes=true'","'privateRawPublicHashes=true','publicValueHash=HMAC-SHA256','freshPrivateKeyBytes=32','keyRetainedOnlyPrivate0400=true','staticRefusalReasonsPublic=true','sharedSinkControllerMemory=true','beforeRootSixStatOnly=true'")
edit('diagnostic_contract.py',"v.get('id',0)>6205842415","v.get('id',0)>6206214444")
edit('diagnostic_contract.py',"v['created_at']>'2026-10-16T01:20:31Z'","v['created_at']>'2026-10-16T01:51:11Z'")
edit('prepare_diagnostic.py',"REL=pathlib.Path('WP/jobs-row-diagnostic-be837974-20261016')","REL=pathlib.Path('WP/jobs-row-diagnostic-private-be837974-20261016')")
edit('prepare_diagnostic.py',"    out['issue191']=gh", "    out['privacyFindings']=gh('repos/yigini/soilfer-lims/issues/comments/6206214444');privacy_findings_authority(out['privacyFindings'])\n    out['issue191']=gh")
p=S/'diagnostic_authority.py'
p.write_bytes(p.read_bytes()+('''
PRIVACY_FINDINGS_SHA='''+repr(semantic)+'''
def privacy_findings_authority(v):
    require(v.get('id')==6206214444 and v.get('created_at')==v.get('updated_at')=='2026-10-16T01:51:11Z' and v.get('performed_via_github_app',{}).get('id')==1236702 and v.get('performed_via_github_app',{}).get('slug')=='claude' and sha(canonical(authority_projection(v)))==PRIVACY_FINDINGS_SHA,'Actual privacy source findings changed')
''').encode())
edit('diagnostic_compare.py',"        # Error messages are static classifications; NEVER include raw values.\n        public['refusalClassSha256']=value_hash(type(e).__name__+':'+str(e));public['classification']='UNEXPLAINED'", "        public['refusal']=public_failure(e);public['classification']='UNEXPLAINED'")
edit('run_diagnostic.py','from diagnostic_authority import diagnostic_scopes','from diagnostic_authority import diagnostic_scopes,privacy_findings_authority')
edit('run_diagnostic.py',"    evidence=strict((root/'current-evidence.json').read_bytes());diagnostic_scopes(evidence['diagnosticScopes'])", "    evidence=strict((root/'current-evidence.json').read_bytes());diagnostic_scopes(evidence['diagnosticScopes']);privacy_findings_authority(evidence['privacyFindings'])")
edit('run_diagnostic.py','def own_events(root,label):','def own_events(sink,label):')
edit('run_diagnostic.py',"    sink=Sink(root);sink.write('controller-memory-'", "    sink.write('controller-memory-'")
edit('run_diagnostic.py',"    package_check(root);sink=Sink(root);sink.write('diagnostic-intent.json'", "    package_check(root);sink=Sink(root);install_value_key(os.urandom(32))\n    sink.write('private-value-hmac-key.json',{'algorithm':'HMAC-SHA256','keyHex':_run_key_hex(),'withheld':True})\n    sink.write('diagnostic-intent.json'")
# Access to the key is a private function used only by the private file writer.
edit('diagnostic_contract.py','def value_hash(v):','def _run_key_hex():\n    require(type(_value_key) is bytes and len(_value_key)==32,\'Public value hash key not initialized\');return _value_key.hex()\n\ndef value_hash(v):')
edit('run_diagnostic.py','from diagnostic_contract import *','from diagnostic_contract import *\nfrom diagnostic_contract import _run_key_hex')
edit('run_diagnostic.py',"own_events(root,'before')","own_events(sink,'before')")
edit('run_diagnostic.py',"own_events(root,'after')","own_events(sink,'after')")
edit('run_diagnostic.py',"failure={'errorType':type(e).__name__,'errorSha256':value_hash(str(e))}","failure=public_failure(e)")
edit('run_diagnostic.py',"failure={'errorType':type(e).__name__,'errorSha256':value_hash(str(e)),'resultVoided':True}","failure={**public_failure(e),'resultVoided':True}")
edit('launch_diagnostic.py',"--property=InaccessiblePaths=/var/lib/docker/volumes /opt/lims/backups","--property=InaccessiblePaths=-/var/lib/docker/volumes -/opt/lims/backups")
edit('launch_diagnostic.py','import os,pathlib,subprocess,json','import os,pathlib,subprocess,json,stat')
edit('launch_diagnostic.py',"if C['phase']=='BEFORE_ROOT':assert not r.exists() and not r.is_symlink()",'''if C['phase']=='BEFORE_ROOT':
 assert not r.exists() and not r.is_symlink()
 root=pathlib.Path(C['oldRoot']);mains=C['mains'];pins=C['inputPins']
 expected={m+s for m in mains for s in ('','-wal','-shm')}
 assert len(mains)==2 and set(pins)==expected and len(expected)==6
 assert str(root)==str(root.resolve()) and all(not q.is_symlink() for q in [root,*root.parents])
 def snapshot():
  for m in mains:
   p=root/m
   assert {q.name for q in p.parent.glob(p.name+'*')}=={p.name,p.name+'-wal',p.name+'-shm'}
  values={};identities=set()
  for n in sorted(expected):
   p=root/n
   assert str(p)==str(p.resolve()) and all(not q.is_symlink() for q in [p,*p.parents])
   a=p.lstat();pin=pins[n]
   assert stat.S_ISREG(a.st_mode) and a.st_nlink==1 and (a.st_dev,a.st_ino) not in identities
   identities.add((a.st_dev,a.st_ino))
   v={'bytes':a.st_size,'allocatedBytes':a.st_blocks*512,'device':a.st_dev,'inode':a.st_ino,'mode':stat.S_IMODE(a.st_mode),'mtimeNs':a.st_mtime_ns}
   assert all(v[k]==pin[k] for k in v) and v['mode']==0o400
   if n.endswith('-wal'):assert v['bytes']==v['allocatedBytes']==0
   values[n]={**v,'nlink':a.st_nlink,'ctimeNs':a.st_ctime_ns}
  return values
 assert snapshot()==snapshot()
''')
edit('launch_diagnostic.py',"base={'root':str(ROOT),'oldRoot':str(OLD_ROOT),'unit':UNIT,'hashes':hashes}","base={'root':str(ROOT),'oldRoot':str(OLD_ROOT),'unit':UNIT,'hashes':hashes,'mains':MAINS,'inputPins':strict((REPO/REL/'diagnostic-pins.json').read_bytes())['inputPins']}")
edit('verify_diagnostic.py',"review={'id':6205842416,'created_at':'2026-10-16T01:20:32Z','updated_at':'2026-10-16T01:20:32Z'", "review={'id':6206214445,'created_at':'2026-10-16T01:51:12Z','updated_at':'2026-10-16T01:51:12Z'")
edit('verify_diagnostic.py','class MemorySink:',"def setUpModule():c.install_value_key(bytes(range(32)))\n\nclass MemorySink:")
# Seal the exact static text/key allowlist from this complete source revision.
reasons=set();keys=set()
for n in sorted(index['files']):
 tree=ast.parse((S/n).read_bytes())
 for node in ast.walk(tree):
  if isinstance(node,ast.Call) and isinstance(node.func,ast.Name) and node.func.id in ('require','RuntimeError'):
   pos=1 if node.func.id=='require' else 0
   if len(node.args)>pos and isinstance(node.args[pos],ast.Constant) and isinstance(node.args[pos].value,str):reasons.add(node.args[pos].value)
  if isinstance(node,ast.Subscript) and isinstance(node.slice,ast.Constant) and isinstance(node.slice.value,str):keys.add(node.slice.value)
p=S/'diagnostic_contract.py';p.write_bytes(p.read_bytes()+('\nSTATIC_REASONS=frozenset('+repr(sorted(reasons))+')\nLITERAL_KEYS=frozenset('+repr(sorted(keys))+')\n').encode())
for n in index['files']:compile((S/n).read_bytes(),n,'exec')
(D/'preparation-record.json').write_bytes(canonical({'status':'NEW_SOURCE_ONLY_PRIVACY_REVISION_PREPARED_NOT_TESTED_NOT_REVIEWED_NOT_EXECUTED','actualFindingsId':6206214444,'actualFindingsSemanticSha256':semantic,'beforeHead':BASE,'oldSourceUnchanged':True,'old184Verified':True,'newRoot':'/opt/lims/releases/workflow-batch-row-diagnostic-be837974-20261016T023000Z','actualDiagnosticSql':0,'operationalHostCalls':0,'sourceSha256':{n:sha((S/n).read_bytes()) for n in sorted(index['files'])},'dataByteIdentical':all((S/n).read_bytes()==(OLD/n).read_bytes() for n in index['data']),'utc':datetime.datetime.now(datetime.timezone.utc).isoformat()})+b'\n')
assert all(sha((OLD/n).read_bytes())==p['sha256'] for n,p in index['files'].items())
print(json.dumps({'status':'SOURCE_ONLY_PREPARED','findingsId':review['id'],'semanticSha256':semantic,'newSource':str(S),'actualDiagnosticSql':0}))
