"""Retain this genuinely new completed scientific boundary once; no production access."""
import datetime, hashlib, json, subprocess, sys
from pathlib import Path
sys.stdout.reconfigure(encoding='utf-8')
root=Path(__file__).resolve().parents[2]
dest=Path(__file__).resolve().parent/'issue214-late-binding-answer-6152114918'
assert not dest.exists(), 'Consumed boundary; never replay.'
assert subprocess.check_output(['git','branch','--show-current'],cwd=root).strip()==b'audit/release-eb6de2e8'
dest.mkdir()
def retain(name, endpoint):
    raw=subprocess.check_output(['gh','api',endpoint],cwd=root)
    (dest/name).write_bytes(raw)
    return json.loads(raw)
answer=retain('actual-answer-raw.json','repos/yigini/soilfer-lims/issues/comments/6152114918')
assert answer['performed_via_github_app']['slug']=='claude' and answer['created_at']=='2026-10-13T18:13:26Z'
for phrase in ['the proposed boundary is confirmed','QC_CHART_LOT_REQUIRED','Provisional','FIXED_WINDOW','already started','re-binding after start refused']:
    assert phrase in answer['body'],phrase
(dest/'actual-answer.txt').write_bytes((answer['body']+'\n').encode())
question=retain('actual-question-raw.json','repos/yigini/soilfer-lims/issues/comments/6151938560')
assert question['created_at']=='2026-10-13T18:03:30Z'
retain('current-issue214-raw.json','repos/yigini/soilfer-lims/issues/214')
main=retain('current-main-raw.json','repos/yigini/soilfer-lims/git/ref/heads/main')
assert main['object']['sha']=='6d750914d8565acdd496767a7dd935811b5a89b2'
index={'observedUtc':datetime.datetime.now(datetime.UTC).isoformat(),'status':'ACTUAL_CLAUDIO_LOT_BINDING_DIRECTION_RECEIVED','answerId':answer['id'],'questionId':question['id'],'authority':'Claude GitHub app under YY delegation #162/6141144901','productionOperations':0,'issue103ApplyGo':False,'files':{}}
for p in dest.iterdir():
    raw=p.read_bytes();index['files'][p.name]={'bytes':len(raw),'sha256':hashlib.sha256(raw).hexdigest()}
(dest/'index.json').write_bytes((json.dumps(index,indent=2)+'\n').encode())
print(json.dumps({k:v for k,v in index.items() if k!='files'},indent=2))
