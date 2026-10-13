import datetime,hashlib,json,subprocess
from pathlib import Path
root=Path(__file__).resolve().parents[2]
dest=Path(__file__).resolve().parent/'issue214-late-binding-boundary'
assert not dest.exists()
dest.mkdir()
def read(name,endpoint):
 r=subprocess.run(['gh','api',endpoint],cwd=root,capture_output=True)
 (dest/name).write_bytes(r.stdout);(dest/(name+'.stderr')).write_bytes(r.stderr)
 assert r.returncode==0
 return json.loads(r.stdout)
authority=read('authority-6148143929.json','repos/yigini/soilfer-lims/issues/comments/6148143929')
assert 'Freezing' in authority['body']
body='''@claude #214 integration boundary discovered during implementation

Your scientific decisions 6148143929 are retained and govern the draft. No release or production operation has occurred.

The existing Native contract permits a run to start with an unbound LRM and bind its lot at first measurement entry (`audit_2_3_native_runs.test.js`, the atomic partial-entry/late-reference case). A chart series needs its lot, approved-set/provisional basis and history frozen at first start. With no lot at start, those inputs cannot be frozen without guessing or reading a later baseline.

Please confirm this proposed integration boundary: for a newly started analyte in CONTROL_CHART mode, require each served LRM lot to be bound before start and return a stable 4xx otherwise. Keep existing FIXED_WINDOW late binding and already-started runs on their original behaviour; no past criteria/evaluations are changed. This would intentionally update the new chart-mode contract rather than silently freeze its history at edit time.

If you want late binding retained in chart mode too, please specify the frozen basis/history rule for that case. I am holding this dependent behaviour while continuing the proposal/approval, review and UI checks. No human card has been answered and #103 still has no apply go.
'''
request=dest/'request.json';request.write_bytes((json.dumps({'body':body})+'\n').encode())
(dest/'mutation-started.json').write_bytes((json.dumps({'observedUtc':datetime.datetime.now(datetime.UTC).isoformat(),'action':'ONE POST new late-binding boundary','neverRetry':True})+'\n').encode())
r=subprocess.run(['gh','api','repos/yigini/soilfer-lims/issues/214/comments','--method','POST','--input',str(request)],cwd=root,capture_output=True)
(dest/'response.json').write_bytes(r.stdout);(dest/'response.stderr').write_bytes(r.stderr)
assert r.returncode==0,'Inspect actual outcome; do not retry.'
posted=json.loads(r.stdout);assert posted['body']==body
actual=read('actual-posted.json','repos/yigini/soilfer-lims/issues/comments/'+str(posted['id']))
assert actual['body']==body
record={'status':'POSTED_ONCE_AWAITING_CLAUDIO','commentId':actual['id'],'url':actual['html_url'],'createdAt':actual['created_at'],'productionOperations':0,'files':{}}
for p in dest.iterdir():
 data=p.read_bytes();record['files'][p.name]={'bytes':len(data),'sha256':hashlib.sha256(data).hexdigest()}
(dest/'index.json').write_bytes((json.dumps(record,indent=2)+'\n').encode())
print(json.dumps({k:v for k,v in record.items() if k!='files'},indent=2))
