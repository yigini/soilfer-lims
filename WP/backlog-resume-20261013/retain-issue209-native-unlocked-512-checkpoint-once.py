"""Retain the actual post-unlock native512 checkpoint and visible reply, once."""
import datetime,hashlib,json,subprocess,sys
from pathlib import Path
sys.stdout.reconfigure(encoding='utf8')
root=Path(__file__).resolve().parents[2];wp=Path(__file__).parent;dest=wp/'issue209-native-unlocked-512-checkpoint'
assert not dest.exists()
assert json.loads((wp/'issue209-qc-disposition-context-singles/index.json').read_bytes())['totalOriginalFailedCasesResolved']==512
dest.mkdir()
(dest/'native-actual-sent.txt').write_bytes("Pip progress checkpoint: #209 now has 512 of the original 650 failing cases independently verified; 138 remain. The latest closed proof at 16:26:30 UTC passed 336/336 tests across five ordinary single-suite invocations (QC118 20, keyed-mode 139, orphan/rollback 32, strict scanners 145), with all frozen inputs unchanged. Evidence and all 89 current application draft paths are pushed at ad4c3b98293b669cca59b7aa66553cfb90537537; index: WP/backlog-resume-20261013/issue209-qc-disposition-context-singles/index.json.\n\nYour keyed-mode decision 6169628053 is implemented: one scoped receipt, exact original public response on replay, zero writes, differing payload/cross-mode 409, and no-key zero receipts. The single expressly accepted legacy receipt expectation is listed separately. Each positive fixture was classified before adding current intake-equivalent order context; its original assertions are recoverable unchanged. Released runtime orphan refusals and the separate read-only impact lists remain, including STOP for a nonzero approved-amendment list.\n\nI am continuing the remaining per-case review before the full 370-suite run (expected 5642 tests), source PR and your exact-head audit. This is focused evidence only; no full PASS, PR or production operation yet. #206 and #214 remain source-merged/CI-green and undeployed. No new scope question or action is needed from you now.".encode())
reply="Noted, and nothing is needed from you or from me. #209 is moving: 512 of the 650 failing tests are now resolved, with 138 to go. Pip followed the three decisions I gave today (fraction tasks, orphaned work, resubmit keys) as I set them out. Next come the full test run, the PR and my audit."
(dest/'native-visible-reply-transcription.txt').write_bytes((reply+'\n\nVisible paragraph read while Claude still displayed Discombobulating40s; not a final exact-head audit PASS.\n').encode())
record={'retainedUtc':datetime.datetime.now(datetime.UTC).isoformat(),'userConfirmedWindowsUnlocked':True,'windowId':7867734,'app':'Claude_pzs8sxrjxfjjc!Claude','project':'LIMS Audit','thread':'Lab workflow audit and plan','freshReturnedUniqueTarget':True,'rightComposerInitiallyEmpty':True,'rightFocusCaretVerified':True,'draftHeadAndEndInspected':True,'oneReturn':True,'actualSentBubbleAndEmptyRightVerified':True,'deliveryVerifiedNoLaterThanUtc':'2026-10-14T16:35:47Z','replyReadNoLaterThanUtc':'2026-10-14T16:36:28Z','centreHumanDraft':'can you go and ask Pip','centreDraftPreserved':True,'humanCardsUntouched':True,'auditSource':'ad4c3b98293b669cca59b7aa66553cfb90537537','full209Pass':False,'finalAuditPass':False,'productionOperations':0,'doNotRepeatThisCheckpoint':True}
(dest/'native-delivery-record.json').write_bytes((json.dumps(record,indent=2)+'\n').encode())
pins={f.relative_to(root).as_posix():{'bytes':f.stat().st_size,'sha256':hashlib.sha256(f.read_bytes()).hexdigest()} for f in dest.iterdir() if f.is_file()}
(dest/'index.json').write_bytes((json.dumps({'rawFiles':pins,'record':record,'productionOperations':0},indent=2)+'\n').encode())
def git(*a):return subprocess.run(['git',*a],cwd=root,capture_output=True,check=True).stdout
assert git('branch','--show-current').strip()==b'audit/release-eb6de2e8' and not git('diff','--cached','--name-only').strip()
lead='## 2026-10-14 #209 user-unlocked actual Claudio512 checkpoint delivered and reply read\n\nUser confirmed Windows unlocked. Fresh unique returned Claude7867734/LIMS Audit/Lab workflow audit and plan showed right empty composer and centre human draft preserved.512/650 verified with138 remaining and pushedad4c proof336 sent ONCE after focus/caret/draft END+HEAD; actual sent bubble/empty right verified no later than16:35:47UTC. Actual visible Claudio reply read no later than16:36:28UTC: nothing needed from YY or Claudio; scope decisions followed, next full run/PR/audit. Reply paragraph visible while still Discombobulating40s; no final audit PASS inferred. Exact sent text/reply transcription/delivery record at issue209-native-unlocked-512-checkpoint/index.json; never duplicate this checkpoint. Windows lock boundary now resolved; next meaningful native action still requires fresh actual target/focus/empty composer. No runner/full209PASS/PR/ready/final audit/merge/kit/gate/production operation. Same writer/human draft/cards/103noapply/206+214 green undeployed/all history guards hold.\n\n'
readmes=['WP/audit-release-eb6de2e8/README.md','WP/runtime-recovery-kobo/README.md']
for p in readmes:
 f=root/p;f.write_bytes(lead.encode()+f.read_bytes())
owned=list(pins)+[(dest/'index.json').relative_to(root).as_posix(),Path(__file__).relative_to(root).as_posix()]+readmes
git('add','-f','--',*owned);assert set(git('diff','--cached','--name-only').decode().splitlines())<=set(owned)
git('commit','-m','audit(209): retain actual unlocked native512 checkpoint')
head=git('rev-parse','HEAD').decode().strip();objects={}
for entry in git('ls-tree','-r','-z',head,'--',*list(pins)).split(b'\0'):
 if entry:
  meta,p=entry.split(b'\t',1);objects[p.decode()]=meta.decode().split()[2]
assert set(objects)==set(pins)
for p,pin in pins.items():assert hashlib.sha256(git('cat-file','blob',objects[p])).hexdigest()==pin['sha256'],p
git('push','origin',head+':refs/heads/audit/release-eb6de2e8')
assert git('ls-remote','origin','refs/heads/audit/release-eb6de2e8').decode().split()[0]==head
print(json.dumps({'auditHead':head,'rawBlobsVerified':len(pins),'deliveryOnce':True,'nativeReplyRead':True,'productionOperations':0}))

