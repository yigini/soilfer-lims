"""Fresh actual GitHub authority read for the CLOSED startup-only proof handoff. No host operations."""
import datetime,json,pathlib,subprocess,sys
R=pathlib.Path(__file__).resolve().parents[2];S=R/'WP/batch-proof-memory-events-be837974-20261015';D=S/'proof233000-closed-current-authority-once'
assert not D.exists();D.mkdir()
sys.path.insert(0,str(S));from proof_contract import canonical,sha,approval
import prepare_proof as prep
original=prep.command;captures=[]
def capture(*args):
 if args[:2]!=('gh','api'):return original(*args)
 i=len(captures);prefix='api-original-'+str(i).zfill(2)
 with (D/(prefix+'-command.json')).open('xb') as f:f.write(canonical({'argv':args,'startedUtc':datetime.datetime.now(datetime.timezone.utc).isoformat()}))
 r=subprocess.run(args,cwd=R,capture_output=True,timeout=90)
 for suffix,raw in [('.json',r.stdout),('-stderr.log',r.stderr)]:
  with (D/(prefix+suffix)).open('xb') as f:f.write(raw)
 with (D/(prefix+'-exit.json')).open('xb') as f:f.write(canonical({'exitCode':r.returncode,'closedUtc':datetime.datetime.now(datetime.timezone.utc).isoformat()}))
 captures.append({'file':prefix+'.json','argv':args,'length':len(r.stdout),'sha256':sha(r.stdout)})
 assert r.returncode==0,'Read failure is not no answer; retain raw refusal, never replay helper'
 return r.stdout
prep.command=capture
review=json.loads(capture('gh','api','repos/yigini/soilfer-lims/issues/comments/6203833517'));index=json.loads((S/'proof233000-closed-memory-events-complete-originals-once/remote-originals/tooling-source-index.json').read_bytes());approval(review,index)
assert review==json.loads((S/'proof233000-closed-memory-events-complete-originals-once/remote-originals/source-review-original.json').read_bytes())
evidence=prep.current_evidence(review,index)
issue=json.loads(capture('gh','api','repos/yigini/soilfer-lims/issues/191'));assert issue['state']=='closed'
for n,v in [('api-command-index.json',captures),('current-authority-evidence.json',evidence),('verified-record.json',{'verifiedUtc':datetime.datetime.now(datetime.timezone.utc).isoformat(),'currentMainCi4Audits6Rules2PostRebootPinsR2Accepted':True,'actualSourceReviewStillExactAndUnedited':True,'issue191':'CLOSED','serverOperations':0})]:
 with (D/n).open('xb') as f:f.write(canonical(v)+b'\n')
new=[{k:c[k] for k in ['id','created_at','updated_at','body']} for c in evidence['sourceComments'] if c['updated_at']>='2026-10-15T23:11:00Z']
print(json.dumps({'verifiedUtc':datetime.datetime.now(datetime.timezone.utc).isoformat(),'rawApiReads':len(captures),'newCommentsSince2311':new},ensure_ascii=True))
