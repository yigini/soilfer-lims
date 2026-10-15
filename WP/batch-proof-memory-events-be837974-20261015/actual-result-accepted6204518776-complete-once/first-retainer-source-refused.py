"""One new read-only acceptance retention; never runs a proof or old helper."""
import datetime, hashlib, json, pathlib, subprocess, sys
W=pathlib.Path(__file__).resolve().parents[2]
B=W/'WP/batch-proof-memory-events-be837974-20261015'
D=B/'actual-result-accepted6204518776-once'
assert not D.exists()
def cmd(*a,input=None):return subprocess.check_output(a,cwd=W,input=input)
def enc(v):return json.dumps(v,sort_keys=True,separators=(',',':'),ensure_ascii=False).encode()
raw=cmd('gh','api','repos/yigini/soilfer-lims/issues/comments/6204518776')
v=json.loads(raw)
assert v['id']==6204518776 and v['created_at']==v['updated_at']=='2026-10-15T23:36:01Z'
assert v['performed_via_github_app']['id']==1236702 and v['performed_via_github_app']['slug']=='claude'
assert v['body'].splitlines()[0]=='Proof result review: ACCEPTED (233000, startup-only, jobs-OFF)'
assert all(t in v['body'] for t in ['4007ee6117c5e084e502cb174137de2ac5cc4c8a','dd14f90814b7994bf06598623dae095b29d04f0b','6203833517','same memory.events policy','Main merges stay held'])
pub='4007ee6117c5e084e502cb174137de2ac5cc4c8a'
ip='WP/batch-proof-memory-events-be837974-20261015/proof233000-closed-memory-events-publication-once/publication-index.json'
ir=cmd('git','show',pub+':'+ip);idx=json.loads(ir);rows=idx['files'];assert len(rows)==8328
tree={x.split(b'\t')[1].decode():x.split(b'\t')[0].decode().split()[2] for x in cmd('git','ls-tree','-rz',pub).split(b'\0') if x}
assert len({r['path'] for r in rows})==len(rows)
oids=[]
for r in rows:
 assert tree[r['path']]==r['gitBlobOid'];oids.append(r['gitBlobOid'])
out=cmd('git','cat-file','--batch',input=('\n'.join(oids)+'\n').encode());at=0
for r in rows:
 end=out.index(b'\n',at);oid,kind,n=out[at:end].decode().split();n=int(n);at=end+1;b=out[at:at+n];at+=n
 assert kind=='blob' and oid==r['gitBlobOid'] and n==r['length'] and out[at:at+1]==b'\n';at+=1
 assert hashlib.sha256(b).hexdigest()==r['sha256'] and hashlib.sha1(('blob '+str(n)+'\0').encode()+b).hexdigest()==oid
 assert (W/r['path']).read_bytes()==b
assert at==len(out) and (W/ip).read_bytes()==ir
sys.path.insert(0,str(B))
import prepare_proof as prep
e=prep.current_evidence()
index=json.loads((B/'actual-source-pass6203833517-once/tooling-source-index.json').read_bytes())
for name,p in index['files'].items():
 b=(B/name).read_bytes();assert hashlib.sha256(b).hexdigest()==p['sha256'] and len(b)==p['bytes']
projection={k:v[k] for k in ['id','body','created_at','updated_at']};projection['app']={k:v['performed_via_github_app'][k] for k in ['id','slug']}
D.mkdir()
for name,b in {'review-original.json':raw,'review-body-original.txt':v['body'].encode(),'current-authority-original.json':enc(e)+b'\n','publication-index-original.json':ir,'retainer-source-at-attempt.py':pathlib.Path(__file__).read_bytes()}.items():(D/name).write_bytes(b)
record={'observedAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),'reviewId':v['id'],'reviewSemanticSha256':hashlib.sha256(enc(projection)).hexdigest(),'reviewBodySha256':hashlib.sha256(v['body'].encode()).hexdigest(),'publicationCommit':pub,'allPublicationEntriesRawGitOidSha256LengthAndLocalBytesVerified':len(rows),'publicationIndexAdditionallyVerified':True,'reviewedSourcesUnchanged':15,'startupOnlyAcceptedNotReleaseQualified':True,'newJobsOnSourceScopeOnly':True,'newOperators':0,'newSourceGraphImplemented':False,'noDuplicateAcknowledgementSent':True,'reviewerMemoryChargeExplanationIsHisInferenceNotIndependentDiagnosis':True,'restartDowntimeInferenceMustBeDisclosedInFutureKit':True}
(D/'accepted-result-derived-record.json').write_bytes(enc(record)+b'\n')
print(json.dumps(record,ensure_ascii=True))
