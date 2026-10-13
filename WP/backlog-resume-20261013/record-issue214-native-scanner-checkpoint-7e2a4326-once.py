"""Retain the actual once-delivered progress checkpoint and OPEN full metadata."""
import datetime,hashlib,json,subprocess,sys
from pathlib import Path
sys.stdout.reconfigure(encoding='utf-8')
root=Path(__file__).resolve().parents[2];wp=Path(__file__).parent
dest=wp/'issue214-native-scanner-checkpoint-7e2a4326'
def git(*args,binary=False):
    result=subprocess.run(['git',*args],cwd=root,stdout=subprocess.PIPE,stderr=subprocess.PIPE)
    if result.returncode:raise RuntimeError(result.stderr.decode('utf-8','replace'))
    return result.stdout if binary else result.stdout.decode('utf-8').strip()
assert git('branch','--show-current')=='audit/release-eb6de2e8' and git('rev-parse','HEAD')=='7e2a4326a94db4142abe9e4911245241f0472182'
assert not git('diff','--cached','--name-only') and not (dest/'native-delivery-record.json').exists()
text=(dest/'native-actual-sent.txt').read_text(encoding='utf-8')
assert text.startswith('Claudio, #214 regression boundary:') and '7e2a4326a94db4142abe9e4911245241f0472182' in text
assert '14/14 suites,293/293 tests' in text and 'successor/session65892 is RUNNING' in text
full=wp/'issue214-scanner-call-form-full'
assert not (full/'summary.json').exists() and not (full/'exit-original.txt').exists()
frozen=json.loads((full/'source-before.json').read_bytes())
assert len(frozen)==415 and all(hashlib.sha256((root/path).read_bytes()).hexdigest()==digest for path,digest in frozen.items())
observed=datetime.datetime.now(datetime.UTC).isoformat()
record={'observedUtc':observed,'status':'ACTUAL_PROGRESS_CHECKPOINT_DELIVERED_ONCE_VISUALLY_VERIFIED',
        'actualTarget':'Claude / LIMS Audit / Lab workflow audit and plan','actualReturnedWindow':3408874,
        'actualApp':'Claude_pzs8sxrjxfjjc!Claude','freshWindowTargetAndEmptyComposersObserved':True,
        'rightComposerFocusCaretObserved':True,'draftHeadFailureTotalsCorrectedPassTotalsAndEndInspected':True,
        'returnCount':1,'deliveredBubbleAudit7e2aAndPriorFullTotalsObserved':True,
        'rightComposerEmptyAfterSend':True,'actualClaudioStateAfterSend':'Boogieing',
        'human103CardAndCentreComposerUntouched':True,'sourceCheckpoint':'7e2a4326a94db4142abe9e4911245241f0472182',
        'finalAuditRequest':False,'readyForAuditNotice':False,'productionOperations':0}
(dest/'native-delivery-record.json').write_bytes((json.dumps(record,indent=2)+'\n').encode())
metadata={'observedUtc':observed,'status':'OPEN_RUNNING_METADATA_ONLY','sessionId':65892,
          'helper':'verify-issue214-scanner-call-form-full-once.py','sourceCheckpoint':record['sourceCheckpoint'],
          'fullDiscoveredInventory':365,'frozenSourceAndFixturePaths':415,'expectedTests':5547,
          'actualFinalSummary':None,'activeLogsCapturedAsComplete':False,'productionOperations':0}
(dest/'full-open-metadata.json').write_bytes((json.dumps(metadata,indent=2)+'\n').encode())
lead=('## 2026-10-13 #214 corrected scanner checkpoint delivered once; full successor RUNNING\n\n'
      'Fresh actual Claude / LIMS Audit / Lab workflow audit and plan showed both composers empty. '
      'Pip delivered the7e2a4326 corrected fixture/scanner source and closed14/293 PASS boundary once, '
      'including the honestly retained full365/5547 one-failure result and focused14/293 one-failure predecessor. '
      'Right-composer focus/caret, draft head/end and corrected totals were inspected before one Return; '
      'actual sent bubble, empty right composer and Claudio Boogieing were visually verified. '
      'Exact actual text and record are at `WP/backlog-resume-20261013/issue214-native-scanner-checkpoint-7e2a4326/index.json`. '
      'Never repeat this progress acknowledgement. The one new full ordinary365-suite successor/session65892 '
      'is RUNNING on all415 frozen inputs, with both ordinary setups/assertions, single worker512MB, blank '
      'local NODE_OPTIONS and retained local visible storage fixture. OPEN metadata is not a final result; '
      'no active logs are captured as complete. Never edit source or replay a runner while it is active. '
      'No214 PR/realCI/final exact-head audit request/PASS/merge/kit/gate/production operation exists. '
      'Human103 card/drafts untouched; no production connection/apply go.\n\n')
readmes=['WP/audit-release-eb6de2e8/README.md','WP/runtime-recovery-kobo/README.md']
for path in readmes:(root/path).write_bytes(lead.encode()+(root/path).read_bytes())
evidence=[path.relative_to(root).as_posix() for path in dest.iterdir() if path.is_file()]
evidence.append(Path(__file__).relative_to(root).as_posix())
index={path:{'bytes':(root/path).stat().st_size,'sha256':hashlib.sha256((root/path).read_bytes()).hexdigest()} for path in evidence}
(dest/'index.json').write_bytes((json.dumps(index,indent=2)+'\n').encode())
owned=evidence+readmes+[(dest/'index.json').relative_to(root).as_posix()]
git('add','-f','--',*owned)
assert set(git('diff','--cached','--name-only').splitlines())<=set(owned)
git('commit','-m','Retain once-delivered corrected scanner progress and OPEN full boundary')
head=git('rev-parse','HEAD')
for path,row in index.items():assert hashlib.sha256(git('show',head+':'+path,binary=True)).hexdigest()==row['sha256'],path
git('push','origin','HEAD:refs/heads/audit/release-eb6de2e8')
assert git('ls-remote','origin','refs/heads/audit/release-eb6de2e8').split()[0]==head
print(json.dumps({'status':'NATIVE_PROGRESS_RETAINED_ONCE','auditCommit':head,'exactBlobsVerified':len(index),'fullState':'RUNNING','sessionId':65892,'productionOperations':0}))
