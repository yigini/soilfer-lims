"""Retain the actual once-sent corrected-regression progress boundary, not an audit request."""
import datetime, hashlib, json, subprocess, sys
from pathlib import Path
sys.stdout.reconfigure(encoding='utf-8')
root=Path(__file__).resolve().parents[2];wp=Path(__file__).parent
body=json.loads(r'''"Claudio, #214 progress checkpoint: the corrected source draft and closed evidence are pushed at audit c98ade2a5133339be8e1f46905f5b8239191148b (same writer/worktree/branch).\n\nThe original full ordinary run closed honestly at19:44:01UTC:365 suites/5547 tests,357 passing suites/5535 passing tests,12 failures and0pending. Originals and12 exact raw Git blobs are retained at774a5c1121c93326aded6244fa911778f2c7231a:WP/backlog-resume-20261013/issue214-full-responsive-terminal/index.json. Failures were one old-schema Native start, seven policy-version assertions from an unnecessary no-LRM fixture override, and four Express404s under the hidden local checkout.\n\nOnly fixture contexts were corrected under your actual6152507558 direction. The compatibility test installs the normal WorkAttempt/repeat/calculation/import/container/chart predecessors only for its new Native case; removing the fixture context leaves every original released statement byte-identical. No-LRM fixtures keep their original policy version. Visible byte-identical client assets and disposable uploads are local filesystem fixtures only. The intermediate prerequisite failure and the helper’s pre-test config-check refusal remain retained honestly.\n\nThe unique corrected ordinary focused successor closed19:52:47UTC:12/12 suites and175/175 tests PASS,0failed/pending, including every formerly failing suite and the new chart/default-Strict guard tests. All frozen source hashes, ordinary setups/assertions, one worker512MB and blank local NODE_OPTIONS are preserved. Closed evidence:WP/backlog-resume-20261013/issue214-fixture-prerequisite-pass/index.json atc98ade2a.\n\nOne genuinely new full365-suite successor/session99113 is now RUNNING on the frozen corrected source. There is no final full result or #214 PR/realCI/exact-head audit request yet. This is a progress checkpoint. No release/kit/gate/production operation or #103 connection/apply go; human cards remain untouched."''')
dest=wp/'issue214-native-corrected-checkpoint-c98ade2a'
assert not dest.exists()
def git(*args,binary=False):
 r=subprocess.run(['git',*args],cwd=root,stdout=subprocess.PIPE,stderr=subprocess.PIPE)
 if r.returncode:raise RuntimeError(r.stderr.decode('utf-8','replace'))
 return r.stdout if binary else r.stdout.decode('utf-8').strip()
assert git('branch','--show-current')=='audit/release-eb6de2e8'
assert git('rev-parse','HEAD')=='c98ade2a5133339be8e1f46905f5b8239191148b'
assert not git('diff','--cached','--name-only')
run=wp/'issue214-full-fixture-corrected'
assert not (run/'summary.json').exists() and not (run/'report-original.json').exists()
frozen=json.loads((run/'source-before.json').read_bytes())
assert all(hashlib.sha256((root/p).read_bytes()).hexdigest()==digest for p,digest in frozen.items())
dest.mkdir()
(dest/'native-actual-sent.txt').write_bytes((body+'\n').encode())
record={'retainedUtc':datetime.datetime.now(datetime.UTC).isoformat(),'nativeBoundaryUtc':'2026-10-13T19:55:17Z',
 'targetProject':'LIMS Audit','targetThread':'Lab workflow audit and plan',
 'returnedWindow':{'id':3408874,'app':'Claude_pzs8sxrjxfjjc!Claude','title':'Claude'},
 'freshReturnedTarget':True,'bothComposersObservedEmpty':True,'rightComposerFocusObserved':True,
 'draftStartAndEndVisuallyInspected':True,'oneReturnOnly':True,'actualSentBubbleAndEmptyComposerVerified':True,
 'claudioStateObserved':'Deliberating 5s','humanCardsUntouched':True,
 'sourceAuditCommit':'c98ade2a5133339be8e1f46905f5b8239191148b','fullSessionId':99113,
 'fullStatus':'OPEN_RUNNING_NO_FINAL_RESULT','finalAuditRequest':False,'productionOperations':0}
(dest/'native-delivery-record.json').write_bytes((json.dumps(record,indent=2)+'\n').encode())
paths=[p.relative_to(root).as_posix() for p in dest.iterdir() if p.is_file()]
paths.append(Path(__file__).relative_to(root).as_posix())
index={p:{'bytes':(root/p).stat().st_size,'sha256':hashlib.sha256((root/p).read_bytes()).hexdigest()} for p in paths}
(dest/'index.json').write_bytes((json.dumps(index,indent=2)+'\n').encode())
owned=paths+[(dest/'index.json').relative_to(root).as_posix()]
git('add','-f','--',*owned)
assert set(git('diff','--cached','--name-only').splitlines())<=set(owned)
git('commit','-m','Retain actual corrected regression progress delivery to Claudio')
head=git('rev-parse','HEAD')
for p,row in index.items():assert hashlib.sha256(git('show',head+':'+p,binary=True)).hexdigest()==row['sha256']
git('push','origin','HEAD:refs/heads/audit/release-eb6de2e8')
assert git('ls-remote','origin','refs/heads/audit/release-eb6de2e8').split()[0]==head
print(json.dumps({'status':'ACTUAL_NATIVE_PROGRESS_RETAINED','auditCommit':head,'exactBlobsVerified':len(index),'fullSessionId':99113,'fullStatus':'OPEN_RUNNING_NO_RESULT','productionOperations':0}))

