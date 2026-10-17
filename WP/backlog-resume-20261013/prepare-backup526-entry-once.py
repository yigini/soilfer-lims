from pathlib import Path
import subprocess,json,hashlib,sys,datetime
from concurrent.futures import ThreadPoolExecutor
w=Path(__file__).resolve().parents[2];h=w/'WP/backlog-resume-20261013';k=w/'WP/batch-release-kit-be837974-20261016';out=h/'backup526-entry-1153-once';out.mkdir()
def capture(label,argv):
 r=subprocess.run(argv,cwd=w,capture_output=True);(out/(label+'-stdout-original.txt')).write_bytes(r.stdout);(out/(label+'-stderr-original.txt')).write_bytes(r.stderr);(out/(label+'-exit-original.json')).write_text(json.dumps({'exitCode':r.returncode})+'\n',encoding='utf8');return r
guard=capture('guard',[sys.executable,'-B',str(h/'verify-lims-heartbeat-input-guard.py')]);assert guard.returncode==0
commands={'head':['git','rev-parse','HEAD'],'staged':['git','diff','--cached','--name-only'],'release-comments':['gh','api','repos/yigini/soilfer-lims/issues/162/comments?since=2026-10-17T04:00:22Z&per_page=100'],'issue191':['gh','api','repos/yigini/soilfer-lims/issues/191']}
with ThreadPoolExecutor(max_workers=4) as pool:results=dict(zip(commands,pool.map(lambda q:capture(q,commands[q]),commands)))
assert all(r.returncode==0 for r in results.values());assert results['head'].stdout.decode().strip()=='96d632efa7270f90f7f7d311beb26c33b4357d3b' and not results['staged'].stdout.strip()
rows=json.loads(results['release-comments'].stdout);prior=json.loads((k/'record-profile526-publication-once/api-release-comments-original.json').read_bytes());expected={r['id']:r for r in prior};assert len(rows)<100
new=[r for r in rows if r['id'] not in expected]
for r in rows:
 if r['id'] in expected:assert r['body']==expected[r['id']]['body'] and r['created_at']==r['updated_at']==expected[r['id']]['created_at']==expected[r['id']]['updated_at']

for original in new: print(json.dumps(original,ensure_ascii=True))
assert not new and {r['id'] for r in rows}=={6229374245,6229865723};assert json.loads(results['issue191'].stdout)['state']=='closed'
value={'recordedUtc':datetime.datetime.now(datetime.timezone.utc).isoformat(),'actualAutomaticWakeObservedUtc':'2026-10-17T11:53:16.923Z','head':results['head'].stdout.decode().strip(),'stagedEmpty':True,'freshOriginalsRetainedBeforePredicates':True,'newReleaseComments':[],'issue191Closed':True,'hostCalls':0,'productionSql':0,'oldPrivatePayloadsRead':False,'sameWriter':True}
(out/'entry-boundary.json').write_text(json.dumps(value,sort_keys=True)+'\n',encoding='utf8');print(json.dumps(value))

(out/'exploratory-read-diagnostic-transcription.json').write_text(json.dumps({'type':'TOOL OUTPUT TRANSCRIPTION ONLY','independentlyRetainedOriginalDiagnostic':False,'guessedNonexistentPublicSourcePaths':['kit_live_backup.py','kit_live_backup_journal.py'],'noSourceOrProofEdits':True,'noInferredContents':True},sort_keys=True)+'\n',encoding='utf8')
