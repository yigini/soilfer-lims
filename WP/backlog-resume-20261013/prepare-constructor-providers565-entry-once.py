from pathlib import Path
import datetime,json,subprocess,sys
from concurrent.futures import ThreadPoolExecutor
w=Path(__file__).resolve().parents[2];h=w/'WP/backlog-resume-20261013';k=w/'WP/batch-release-kit-be837974-20261016'
e=h/'constructor-providers565-entry-1430-once';e.mkdir()
def capture(label,argv):
 r=subprocess.run(argv,cwd=w,capture_output=True)
 (e/(label+'-stdout-original.txt')).write_bytes(r.stdout);(e/(label+'-stderr-original.txt')).write_bytes(r.stderr)
 (e/(label+'-exit-original.json')).write_text(json.dumps({'exitCode':r.returncode})+'\n',encoding='utf8')
 return r
guard=capture('guard',[sys.executable,'-B',str(h/'verify-lims-heartbeat-input-guard.py')]);assert guard.returncode==0
commands={'head':['git','rev-parse','HEAD'],'staged':['git','diff','--cached','--name-only'],'kit-delta':['git','diff','--name-only','--',str(k.relative_to(w))],'release-comments':['gh','api','repos/yigini/soilfer-lims/issues/162/comments?since=2026-10-17T04:00:22Z&per_page=100'],'issue191':['gh','api','repos/yigini/soilfer-lims/issues/191']}
with ThreadPoolExecutor(max_workers=4) as pool:results=dict(zip(commands,pool.map(lambda q:capture(q,commands[q]),commands)))
assert all(r.returncode==0 for r in results.values())
assert results['head'].stdout.decode().strip()=='7af83f48e1df7725717d667c5b01582e7e8dc989'
assert not results['staged'].stdout.strip() and not results['kit-delta'].stdout.strip()
current=json.loads(results['release-comments'].stdout);prior=json.loads((k/'reader-entry565-source-publication-once/api-release-comments-original.json').read_bytes())
expected={r['id']:r for r in prior};assert len(current)<100
for item in current:
 if item['id'] not in expected:print(json.dumps(item,ensure_ascii=True))
assert set(expected)=={6229374245,6229865723} and {r['id'] for r in current}==set(expected)
for item in current:
 old=expected[item['id']];assert item['body']==old['body'] and item['created_at']==item['updated_at']==old['created_at']==old['updated_at']
assert json.loads(results['issue191'].stdout)['state']=='closed'
record={'recordedUtc':datetime.datetime.now(datetime.timezone.utc).isoformat(),'actualAutomaticWakeObservedUtc':'2026-10-17T14:30:48.400Z','head':results['head'].stdout.decode().strip(),'stagedEmpty':True,'trackedKitDeltaEmpty':True,'freshOriginalsRetainedBeforePredicates':True,'newReleaseComments':[],'issue191Closed':True,'hostCalls':0,'productionSql':0,'oldPrivatePayloadsRead':False,'sameWriter':True}
(e/'entry-boundary.json').write_text(json.dumps(record,sort_keys=True)+'\n',encoding='utf8');print(json.dumps(record))
