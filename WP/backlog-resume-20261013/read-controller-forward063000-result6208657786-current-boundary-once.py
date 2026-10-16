"""Fresh actual result-review boundary, GitHub read-only; never replay."""
import datetime,hashlib,json,pathlib,subprocess
R=pathlib.Path(__file__).resolve().parents[2];S=R/'WP/batch-proof-controller-forward-step2-be837974-20261016';D=S/'controller-forward063000-result6208657786-current-boundary-once'
assert not D.exists();D.mkdir();reads=[]
queries=[['gh','api','--paginate','--slurp','repos/yigini/soilfer-lims/issues/162/comments?since=2026-10-16T04:37:05Z&per_page=100'],['gh','api','repos/yigini/soilfer-lims/commits/main'],['gh','api','repos/yigini/soilfer-lims/actions/runs/38772398721'],['gh','api','repos/yigini/soilfer-lims/issues/191']]
for i,args in enumerate(queries):
 prefix='api-'+str(i);(D/(prefix+'-command.json')).write_bytes(json.dumps(args).encode());r=subprocess.run(args,cwd=R,capture_output=True,timeout=90)
 (D/(prefix+'-stdout.json')).write_bytes(r.stdout);(D/(prefix+'-stderr.log')).write_bytes(r.stderr);(D/(prefix+'-exit.json')).write_bytes(json.dumps({'exitCode':r.returncode}).encode());assert r.returncode==0
 reads.append(json.loads(r.stdout))
comments=[x for page in reads[0] for x in page];own=[x for x in comments if x['id']==6208657786];assert len(own)==1 and own[0]['created_at']==own[0]['updated_at']=='2026-10-16T05:18:06Z'
assert hashlib.sha256(own[0]['body'].encode()).hexdigest()=='838132780e948302e56c9166ba4e75c481ce2fe253f2b90d312424af4161184e'
assert reads[1]['sha']=='be8379745bdfae52ce46496ff26514dc7d729640' and reads[2]['head_sha']==reads[1]['sha'] and reads[2]['status']=='completed' and reads[2]['conclusion']=='success' and reads[2]['run_attempt']==1 and reads[2]['event']=='push' and reads[3]['state']=='closed'
later=[{'id':x['id'],'created_at':x['created_at'],'updated_at':x['updated_at'],'body':x['body'],'performed_via_github_app':x.get('performed_via_github_app')} for x in comments if x['id']>6208657786]
record={'observedUtc':datetime.datetime.now(datetime.timezone.utc).isoformat(),'actualResultId':6208657786,'actualResultUneditedBodyExact':True,'laterActualComments':later,'mainAndCiStillClosedSuccess':True,'issue191Closed':True,'serverOperations':0}
(D/'verified-record.json').write_bytes(json.dumps(record,ensure_ascii=True,sort_keys=True).encode())
print(json.dumps({**record,'laterActualComments':[{k:v for k,v in x.items() if k!='body'} for x in later]},ensure_ascii=True))
